const Product = require('../../../../db/models/productModel');
const Category = require('../../../../db/models/categoryModel');
let Personalization = null;
try {
  Personalization = require('../../../../db/models/Personalization');
} catch (e) {
  console.warn('⚠️ Personalization model not found, continuing without it');
}
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');
const cache = require('../../../../utils/cache');
const { 
  OptimizedQueryBuilder, 
  CacheKeyGenerator, 
  QueryMonitor, 
  ResponseOptimizer 
} = require('../../../../utils/performanceOptimizations');
const mongoose = require('mongoose');

/**
 * Optimized getAllProducts endpoint with significant performance improvements
 */
exports.getAllProductsOptimized = async (req, res) => {
  const timer = QueryMonitor.startTimer();
  
  try {
    const { 
      sortBy = "relevance", 
      page = 1, 
      limit = 20,
      q: searchTerm,
      search,
      category,
      brand,
      size,
      color,
      condition,
      material,
      package_size,
      minPrice,
      maxPrice,
      days
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const isAuthenticated = !!req.user;

    // Generate cache key
    const cacheKey = !isAuthenticated 
      ? CacheKeyGenerator.generateProductKey(req.query)
      : null;

    // Check cache first
    if (cacheKey) {
      const cached = cache.get(cacheKey);
      if (cached) {
        const executionTime = QueryMonitor.endTimer(timer);
        console.log(`📦 Cache hit for products: ${executionTime.toFixed(2)}ms`);
        return successResponse(res, "Products fetched successfully (cached)", cached);
      }
    }

    // Build optimized query
    const queryBuilder = new OptimizedQueryBuilder();
    
    // Add filters
    queryBuilder
      .addTextSearch(searchTerm || search)
      .addCategoryFilter(category)
      .addPriceRange(minPrice, maxPrice)
      .addDateRange(days);

    // Add other filters
    const query = queryBuilder.getQuery();
    // Include active and sold (exclude only hidden)
    query.status = { $in: ['active', 'sold'] };
    query.hide = false;
    
    if (brand) query.brand = brand;
    if (size) query.size = size;
    if (color) query.colors = color;
    if (condition) query.condition = condition;
    if (material) query.material = material;
    if (package_size) query.package_size = package_size;

    // Handle personalization for authenticated users
    if (Personalization && isAuthenticated && mongoose.Types.ObjectId.isValid(req.user?.id)) {
      try {
        const personalization = await Personalization.findOne({
          user: req.user.id
        }).select('followedCategories followedBrands').lean();

        if (personalization) {
          const { followedCategories = [], followedBrands = [] } = personalization;

          if (followedCategories.length || followedBrands.length) {
            query.$or = [
              ...(followedCategories.length ? [{ category: { $in: followedCategories } }] : []),
              ...(followedBrands.length ? [{ brand: { $in: followedBrands } }] : [])
            ];
          }
        }
      } catch (personalizationError) {
        console.warn('⚠️ Personalization query failed:', personalizationError.message);
        // Continue without personalization
      }
    }

    // Set sort options
    let sortOptions = {};
    switch (sortBy) {
      case "Price: Low to High":
        sortOptions = { price: 1 };
        break;
      case "Price: High to Low":
        sortOptions = { price: -1 };
        break;
      case "Oldest first":
        sortOptions = { createdAt: 1 };
        break;
      case "Newest first":
        sortOptions = { createdAt: -1 };
        break;
      default:
        sortOptions = { createdAt: -1 };
        break;
    }

    // Build aggregation pipeline
    const pipeline = queryBuilder.buildAggregationPipeline(skip, parseInt(limit));
    
    // Update the match stage with our query
    pipeline[0].$match = query;
    
    // Update sort stage
    pipeline[6].$sort = sortOptions;

    // Execute aggregation with performance monitoring
    const aggregationTimer = QueryMonitor.startTimer();
    const result = await Product.aggregate(pipeline)
      .option({ allowDiskUse: true })
      .maxTimeMS(10000) // 10 second timeout
      .exec();
    
    const aggregationTime = QueryMonitor.endTimer(aggregationTimer);
    QueryMonitor.logSlowQuery(pipeline, aggregationTime, 500);

    const products = result[0]?.data || [];
    const total = result[0]?.metadata?.[0]?.total || 0;

    // Optimize response data
    const optimizedProducts = ResponseOptimizer.optimizeProductResponse(products);
    const payload = ResponseOptimizer.addPaginationMetadata(
      optimizedProducts, 
      total, 
      page, 
      limit
    );

    // Cache the result
    if (cacheKey) {
      cache.set(cacheKey, payload, 60_000); // 1 minute cache for public requests
    }

    const executionTime = QueryMonitor.endTimer(timer);
    console.log(`📦 Products fetched: ${products.length} items in ${executionTime.toFixed(2)}ms (agg: ${aggregationTime.toFixed(2)}ms)`);

    return successResponse(res, "Products fetched successfully", payload);

  } catch (error) {
    const executionTime = QueryMonitor.endTimer(timer);
    console.error(`❌ Product fetch error after ${executionTime.toFixed(2)}ms:`, error.message);
    
    return errorResponse(res, "Failed to fetch products", 500, error.message);
  }
};

/**
 * Optimized getProduct endpoint
 */
exports.getProductOptimized = async (req, res) => {
  const timer = QueryMonitor.startTimer();
  
  try {
    const productId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return errorResponse(res, "Invalid product ID format", 400);
    }

    // Check cache first
    const cacheKey = `product:${productId}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      const executionTime = QueryMonitor.endTimer(timer);
      console.log(`📦 Cache hit for product: ${executionTime.toFixed(2)}ms`);
      return successResponse(res, "Product fetched successfully (cached)", cached);
    }

    // Optimized product query with minimal population
    const product = await Product.findByIdAndUpdate(
      productId,
      { $inc: { views: 1 } },
      { new: true }
    )
    .populate('user', 'userName email profile city country lastLoginAt firstName lastName cityShow')
    .populate('category', 'name _id')
    .lean()
    .maxTimeMS(5000); // 5 second timeout

    if (!product) {
      return errorResponse(res, "Product not found", 404);
    }

    // Get seller ratings efficiently
    let sellerRatings = null;
    if (product.user && product.user._id) {
      try {
        const Rating = require('../../../../db/models/ratingModel');
        const ratings = await Rating.find({
          ratedUser: product.user._id
        }).select('rating').lean();

        if (ratings.length > 0) {
          const totalRatings = ratings.length;
          const averageRating = ratings.reduce((sum, rating) => sum + rating.rating, 0) / totalRatings;

          const ratingDistribution = {
            5: ratings.filter(r => r.rating === 5).length,
            4: ratings.filter(r => r.rating === 4).length,
            3: ratings.filter(r => r.rating === 3).length,
            2: ratings.filter(r => r.rating === 2).length,
            1: ratings.filter(r => r.rating === 1).length,
          };

          sellerRatings = {
            averageRating: Math.round(averageRating * 10) / 10,
            totalRatings,
            ratingDistribution,
          };
        } else {
          sellerRatings = {
            averageRating: 0,
            totalRatings: 0,
            ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
          };
        }
      } catch (ratingError) {
        console.warn('⚠️ Rating query failed:', ratingError.message);
        sellerRatings = {
          averageRating: 0,
          totalRatings: 0,
          ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        };
      }
    }

    // Build response
    const responseData = {
      id: product._id,
      title: product.title,
      description: product.description,
      brand: product.brand,
      size: product.size,
      colors: product.colors,
      material: product.material,
      condition: product.condition,
      price: product.price,
      shipping_cost: product.shipping_cost,
      package_size: product.package_size,
      product_photos: product.product_photos || [],
      status: product.status,
      hide: product.hide,
      views: product.views || 0,
      favoriteCount: product.favoritedBy?.length || 0,
      createdAt: product.createdAt,
      user: product.user ? {
        id: product.user._id,
        userName: product.user.userName,
        email: product.user.email,
        profile: product.user.profile,
        city: product.user.city,
        country: product.user.country,
        firstName: product.user.firstName,
        lastName: product.user.lastName,
        cityShow: product.user.cityShow
      } : null,
      category: product.category ? {
        id: product.category._id,
        name: product.category.name
      } : null,
      sellerRatings
    };

    // Cache the result
    cache.set(cacheKey, responseData, 300_000); // 5 minute cache

    const executionTime = QueryMonitor.endTimer(timer);
    console.log(`📦 Product fetched in ${executionTime.toFixed(2)}ms`);

    return successResponse(res, "Product fetched successfully", { item: responseData });

  } catch (error) {
    const executionTime = QueryMonitor.endTimer(timer);
    console.error(`❌ Product fetch error after ${executionTime.toFixed(2)}ms:`, error.message);
    
    return errorResponse(res, "Failed to fetch product", 500, error.message);
  }
};

/**
 * Optimized getAllCategories endpoint
 */
exports.getAllCategoriesOptimized = async (req, res) => {
  const timer = QueryMonitor.startTimer();
  
  try {
    const cacheKey = CacheKeyGenerator.generateCategoryKey();
    let categories = cache.get(cacheKey);
    
    if (!categories) {
      categories = await Category.find({}, {
        name: 1,
        subCategories: 1,
        createdAt: 1
      })
      .lean()
      .maxTimeMS(3000); // 3 second timeout
      
      cache.set(cacheKey, categories, 300_000); // 5 minute cache
    }

    const executionTime = QueryMonitor.endTimer(timer);
    console.log(`📦 Categories fetched in ${executionTime.toFixed(2)}ms`);

    return successResponse(res, 'Categories fetched', categories);
  } catch (error) {
    const executionTime = QueryMonitor.endTimer(timer);
    console.error(`❌ Categories fetch error after ${executionTime.toFixed(2)}ms:`, error.message);
    
    return errorResponse(res, 'Failed to fetch categories', 500, error.message);
  }
};

/**
 * Health check endpoint for performance monitoring
 */
exports.getPerformanceHealth = async (req, res) => {
  try {
    const healthData = {
      timestamp: new Date().toISOString(),
      cache: {
        size: cache.map?.size || 0,
        maxSize: 1000
      },
      database: {
        connectionState: mongoose.connection.readyState,
        host: mongoose.connection.host,
        name: mongoose.connection.name
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024)
      }
    };

    return successResponse(res, 'Performance health check', healthData);
  } catch (error) {
    return errorResponse(res, 'Health check failed', 500, error.message);
  }
};
