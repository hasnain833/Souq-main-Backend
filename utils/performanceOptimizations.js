// Performance optimization utilities for API endpoints
const mongoose = require('mongoose');

/**
 * Optimized database query builder with performance enhancements
 */
class OptimizedQueryBuilder {
  constructor() {
    this.query = {};
    this.populateOptions = [];
    this.sortOptions = {};
    this.selectOptions = {};
    this.aggregationPipeline = [];
  }

  /**
   * Add text search with MongoDB text index optimization
   */
  addTextSearch(searchTerm, fields = ['title', 'description', 'brand']) {
    if (!searchTerm || searchTerm.trim() === '') return this;
    
    const keywords = searchTerm.trim().split(/\s+/);
    
    // Use $text search if text index exists, otherwise fallback to regex
    if (keywords.length === 1 && keywords[0].length > 2) {
      this.query.$text = { $search: keywords[0] };
    } else {
      const regexQueries = keywords.map(word => {
        const regex = new RegExp(word, 'i');
        return {
          $or: fields.map(field => ({ [field]: { $regex: regex } }))
        };
      });
      this.query.$and = regexQueries;
    }
    
    return this;
  }

  /**
   * Add category filter with optimized lookup
   */
  addCategoryFilter(categoryId) {
    if (!categoryId) return this;
    
    // Use direct ObjectId match for better performance
    this.query.category = mongoose.Types.ObjectId.isValid(categoryId) 
      ? new mongoose.Types.ObjectId(categoryId) 
      : categoryId;
    
    return this;
  }

  /**
   * Add price range filter with index optimization
   */
  addPriceRange(minPrice, maxPrice) {
    if (minPrice || maxPrice) {
      this.query.price = {};
      if (minPrice) this.query.price.$gte = parseFloat(minPrice);
      if (maxPrice) this.query.price.$lte = parseFloat(maxPrice);
    }
    return this;
  }

  /**
   * Add date range filter for recent products
   */
  addDateRange(days) {
    if (days && days > 0) {
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      this.query.createdAt = { $gte: cutoff };
    }
    return this;
  }

  /**
   * Build optimized aggregation pipeline
   */
  buildAggregationPipeline(skip = 0, limit = 20) {
    const pipeline = [
      // Stage 1: Match documents
      { $match: this.query },
      
      // Stage 2: Optimized lookup with minimal fields
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'user',
          pipeline: [
            { $project: { 
              userName: 1, 
              firstName: 1, 
              lastName: 1, 
              profile: 1, 
              city: 1, 
              country: 1,
              lastLoginAt: 1,
              deletedAt: 1
            }}
          ]
        }
      },
      
      // Stage 3: Filter out deleted users
      {
        $match: {
          $or: [
            { 'user': { $eq: null } },
            { 'user.deletedAt': null },
            { 'user.deletedAt': { $exists: false } }
          ]
        }
      },
      
      // Stage 4: Unwind user array
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      
      // Stage 5: Lookup categories (only if needed)
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'category',
          pipeline: [{ $project: { name: 1, _id: 1 } }]
        }
      },
      
      // Stage 6: Unwind category array
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      
      // Stage 7: Sort
      { $sort: this.sortOptions },
      
      // Stage 8: Facet for pagination and count
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                title: 1,
                description: 1,
                brand: 1,
                size: 1,
                colors: 1,
                material: 1,
                condition: 1,
                price: 1,
                shipping_cost: 1,
                package_size: 1,
                product_photos: 1,
                status: 1,
                hide: 1,
                views: 1,
                favoritedBy: 1,
                createdAt: 1,
                updatedAt: 1,
                user: 1,
                category: 1
              }
            }
          ]
        }
      }
    ];

    return pipeline;
  }

  /**
   * Set sort options
   */
  setSort(sortBy = 'createdAt', order = -1) {
    this.sortOptions = { [sortBy]: order };
    return this;
  }

  /**
   * Get the final query
   */
  getQuery() {
    return this.query;
  }
}

/**
 * Cache key generator for consistent caching
 */
class CacheKeyGenerator {
  static generateProductKey(params, userId = null) {
    const baseKey = 'products';
    const version = 'v3';
    const paramsHash = this.hashParams(params);
    const userPrefix = userId ? `user_${userId}` : 'public';
    
    return `${baseKey}:${version}:${userPrefix}:${paramsHash}`;
  }

  static generateCategoryKey() {
    return 'categories:v2';
  }

  static hashParams(params) {
    const sorted = Object.keys(params)
      .sort()
      .reduce((result, key) => {
        result[key] = params[key];
        return result;
      }, {});
    
    return Buffer.from(JSON.stringify(sorted)).toString('base64').substring(0, 16);
  }
}

/**
 * Database index recommendations
 */
const INDEX_RECOMMENDATIONS = {
  products: [
    // Compound indexes for common queries
    { status: 1, createdAt: -1 },
    { status: 1, price: 1 },
    { status: 1, category: 1, createdAt: -1 },
    { user: 1, status: 1, createdAt: -1 },
    { brand: 1, status: 1 },
    { condition: 1, status: 1 },
    
    // Text index for search
    { title: 'text', description: 'text', brand: 'text' },
    
    // Single field indexes
    { category: 1 },
    { price: 1 },
    { createdAt: -1 },
    { views: -1 }
  ],
  
  users: [
    { email: 1 },
    { userName: 1 },
    { deletedAt: 1 },
    { lastLoginAt: -1 }
  ],
  
  categories: [
    { name: 1 },
    { parentCategory: 1 },
    { isActive: 1 }
  ]
};

/**
 * Query performance monitoring
 */
class QueryMonitor {
  static startTimer() {
    return process.hrtime();
  }

  static endTimer(startTime) {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    return seconds * 1000 + nanoseconds / 1e6; // Convert to milliseconds
  }

  static logSlowQuery(query, executionTime, threshold = 1000) {
    if (executionTime > threshold) {
      console.warn(`🐌 Slow query detected: ${executionTime.toFixed(2)}ms`, {
        query: JSON.stringify(query).substring(0, 200),
        executionTime: `${executionTime.toFixed(2)}ms`
      });
    }
  }
}

/**
 * Response optimization utilities
 */
class ResponseOptimizer {
  /**
   * Optimize product response data
   */
  static optimizeProductResponse(products) {
    return products.map(product => ({
      id: product._id,
      title: product.title,
      description: product.description?.substring(0, 200), // Truncate long descriptions
      brand: product.brand,
      size: product.size,
      colors: product.colors,
      material: product.material,
      condition: product.condition,
      price: product.price,
      shipping_cost: product.shipping_cost,
      package_size: product.package_size,
      product_photos: Array.isArray(product.product_photos) 
        ? product.product_photos.slice(0, 3) // Limit to first 3 photos
        : [],
      status: product.status,
      hide: product.hide,
      views: product.views || 0,
      favoriteCount: product.favoritedBy?.length || 0,
      createdAt: product.createdAt,
      user: product.user ? {
        id: product.user._id,
        userName: product.user.userName,
        firstName: product.user.firstName,
        lastName: product.user.lastName,
        profile: product.user.profile,
        city: product.user.city,
        country: product.user.country
      } : null,
      category: product.category ? {
        id: product.category._id,
        name: product.category.name
      } : null
    }));
  }

  /**
   * Add pagination metadata
   */
  static addPaginationMetadata(data, total, page, limit) {
    return {
      items: data,
      totalItems: data.length,
      total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      hasNextPage: data.length === parseInt(limit) && (parseInt(page) * parseInt(limit)) < total
    };
  }
}

module.exports = {
  OptimizedQueryBuilder,
  CacheKeyGenerator,
  INDEX_RECOMMENDATIONS,
  QueryMonitor,
  ResponseOptimizer
};
