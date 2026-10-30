const mongoose = require("mongoose");
const Product = require("../../../../db/models/productModel");
const SizeChart = require("../../../../db/models/sizeChartModel");
const {
  successResponse,
  errorResponse,
} = require("../../../../utils/responseHandler");
const {
  buildProductReq,
  buildProductRes,
  updateProductRes,
  getAllProductRes,
  productRes,
  buildSearchQuery,
  buildProductQuery,
  buildGetUserProductQuery,
} = require("../dto/product.dto");
const User = require("../../../../db/models/userModel");
const Rating = require("../../../../db/models/ratingModel");
let Personalization = null;
try {
  Personalization = require("../../../../db/models/Personalization");
} catch (e) {
  console.warn('⚠️ Personalization model not found, continuing without it');
}
const { UserRes } = require("../../profile/dto/user.dto");
// const { paginateQuery } = require('../../../../utils/pagination');
const NotificationService = require("../../../../services/NotificationService");
const { resolveS3Url } = require('../../../../utils/urlResolver');
// const cache = require('../../../../utils/cache'); // Temporarily disabled

// Debug cache import
// console.log('Cache imported in productController:', typeof cache);

// Create product with S3 image URLs
exports.createProduct = async (req, res) => {
  try {
    console.log('=== PRODUCT UPLOAD START ===');
    console.log('Request body:', req.body);
    console.log('Request files:', req.files ? req.files.length : 'No files');

    const { title, description, price, category, quantity, brand, size, colors, material, condition, shipping_cost, package_size, currency } = req.body;

    // Validate required fields
    if (!title || !description || !price || !quantity) {
      console.error('Missing required fields:', { title: !!title, description: !!description, price: !!price, quantity: !!quantity });
      return res.status(400).json({
        success: false,
        error: "Missing required fields: title, description, price, and quantity are required"
      });
    }

    if (!req.files || req.files.length === 0) {
      console.error('No files uploaded');
      return res.status(400).json({
        success: false,
        error: "No images uploaded. Please upload at least one image."
      });
    }

    console.log('Processing files:', req.files.map(f => ({
      originalname: f.originalname,
      location: f.location,
      key: f.key,
      size: f.size
    })));

    // Extract S3 URLs from uploaded files and resolve them
    const imageUrls = req.files.map(file => {
      const url = file.location || resolveS3Url(file.key);
      console.log('File URL resolution:', {
        originalname: file.originalname,
        location: file.location,
        key: file.key,
        resolved: url
      });
      return url;
    }).filter(Boolean);

    if (imageUrls.length === 0) {
      console.error('No valid image URLs generated');
      return res.status(400).json({
        success: false,
        error: "No valid images uploaded. Please check your file format."
      });
    }

    console.log('Final image URLs:', imageUrls);

    const product = new Product({
      title,
      description,
      price: parseFloat(price),
      category,
      quantity: parseInt(quantity),
      brand,
      size,
      colors,
      material,
      condition,
      shipping_cost: shipping_cost ? parseFloat(shipping_cost) : undefined,
      package_size,
      currency: currency || 'USD',
      product_photos: imageUrls,
      user: req.user._id,
    });

    console.log('Saving product:', {
      title: product.title,
      price: product.price,
      quantity: product.quantity,
      imageCount: product.product_photos.length
    });

    await product.save();

    console.log('Product saved successfully:', product._id);

    return res.status(200).json({
      success: true,
      message: "Product uploaded successfully",
      data: {
        id: product._id,
        title: product.title,
        price: product.price,
        quantity: product.quantity,
        product_photos: product.product_photos,
        createdAt: product.createdAt
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error during product upload",
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

exports.sellProduct = async (req, res) => {
  try {
    const product = await Product.createProduct(req.user._id, req.body);
    res.status(201).json({ message: "Product listed successfully", product });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Public: Get sizes for a child category (by ID or slug)
// Returns empty sizes array when not found to avoid frontend crashes
exports.getSizesForChildCategory = async (req, res) => {
  try {
    const { childCategoryId, slug } = req.params;

    let chart = null;
    if (childCategoryId) {
      chart = await SizeChart.findOne({ "childCategory._id": childCategoryId }).lean();
    } else if (slug) {
      chart = await SizeChart.findOne({ "childCategory.slug": slug }).lean();
    }

    if (!chart) {
      return successResponse(res, "No sizes available for this category", { sizes: [] });
    }

    return successResponse(res, "Sizes fetched successfully", { sizes: chart.sizes || [] });
  } catch (error) {
    // Fail-safe: return empty sizes to keep UI stable
    return successResponse(res, "Failed to fetch sizes; returning empty list", { sizes: [] });
  }
};

exports.updateProductStatus = async (req, res) => {
  try {
    const { id } = req.params; // productId from URL
    const { status } = req.body; // "sold" or other

    // Validate product ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, "Invalid product ID", 400);
    }

    // Find product and update
    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!updatedProduct) {
      return errorResponse(res, "Product not found", 404);
    }

    // Format the product response
    const responseData = updateProductRes(updatedProduct);

    return successResponse(res, "Product status updated successfully", {
      item: responseData,
    });
  } catch (error) {
    return errorResponse(
      res,
      "Failed to update product status",
      500,
      error.message
    );
  }
};
exports.sellProductByFormdata = async (req, res) => {
  try {
    // Basic validation
    const { title, description } = req.body || {};
    let { price, quantity, shipping_cost } = req.body || {};
    // Coerce numeric fields
    price = price !== undefined ? Number(price) : undefined;
    quantity = quantity !== undefined ? parseInt(quantity, 10) : undefined;
    shipping_cost = shipping_cost !== undefined ? Number(shipping_cost) : undefined;

    if (!title || !description) {
      return errorResponse(res, "Missing required fields: title, description", 400);
    }
    if (price === undefined || Number.isNaN(price)) {
      return errorResponse(res, "Missing or invalid price", 400);
    }
    if (quantity === undefined || Number.isNaN(quantity) || quantity <= 0) {
      return errorResponse(res, "Missing or invalid quantity", 400);
    }

    const hasFiles = Array.isArray(req.files) && req.files.length > 0;
    if (!hasFiles && !req.body.product_photos) {
      return errorResponse(res, "At least one product photo is required", 400);
    }


    // Build payload with image buffers
    const productPayload = buildProductReq(req.user._id, {
      ...req.body,
      price,
      quantity,
      shipping_cost,
    }, req.files);
    const createdProduct = await Product.create(productPayload);
    const product = await Product.findById(createdProduct._id).populate(
      "user",
      "name email"
    );
    const responseData = buildProductRes(createdProduct);

    return successResponse(res, "Product created successfully", {
      items: responseData,
    });
  } catch (error) {
    return errorResponse(res, "Failed to create product", 500, error.message);
  }
};

exports.getMyProducts = async (req, res) => {
  try {
    const userId = req.user._id;

    // Extract pagination params
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build query: only user’s visible (not hidden) products
    const query = {
      user: userId,
      hidden: { $ne: true }, // ✅ Exclude hidden products
    };

    const [products, total] = await Promise.all([
      Product.find(query)
        .populate("category")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }), // default: Newest first
      Product.countDocuments(query),
    ]);

    const responseData = products.map(productRes);

    return successResponse(res, "Products fetched successfully", {
      items: responseData,
      totalItems: total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      hasNextPage: skip + products.length < total,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getUserWithProducts = async (req, res) => {
  try {
    const userId = req.params.id;

    // Pagination & Sorting
    const { sortBy = "relevance", page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Sort Options
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
      case "Relevance":
      default:
        sortOptions = { createdAt: -1 };
        break;
    }

    // Build query with filters and user
    const productQuery = await buildGetUserProductQuery(req.query); // This handles filters like category, brand, etc.
    productQuery.user = userId; // Filter by specific user
    productQuery.hide = false; // Only show visible products

    // Fetch user details
    const user = await User.findById(userId).select(
      "userName email profile lastLoginAt city country"
    );
    if (!user) return errorResponse(res, "User not found", 404);

    // Fetch user's filtered & paginated products
    const [products, total] = await Promise.all([
      Product.find(productQuery)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      Product.countDocuments(productQuery),
    ]);

    // Response formatting
    const userData = UserRes(user);
    const items = products.map(productRes);

    return successResponse(res, "Products fetched successfully", {
      user: userData,
      items,
      totalItems: total,
      total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      hasNextPage: skip + products.length < total,
    });
  } catch (error) {
    return errorResponse(
      res,
      "Failed to fetch user and products",
      500,
      error.message
    );
  }
};

// Removed duplicate getAllProducts function - using the more comprehensive one below

// Removed duplicate getProduct function - using the more comprehensive one below

exports.getProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const userId = req.user?._id; // Get current user ID if authenticated

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format",
      });
    }

    const responseProduct = await Product.findByIdAndUpdate(
      productId,
      { $inc: { views: 1 } },
      { new: true }
    )
      // Populate all necessary user fields, including city and country
      .populate(
        "user",
        "userName email profile city country lastLoginAt firstName lastName cityShow paypalEmail stripeAccountId"
      );

    if (!responseProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }
    // Determine if current user is the seller
    const isSeller = userId && responseProduct.user &&
      userId.toString() === responseProduct.user._id.toString();

    // Determine view type
    const viewType = isSeller ? 'seller' : 'buyer';

    // Get seller's rating data
    let sellerRatings = null;
    if (responseProduct.user && responseProduct.user._id) {
      const ratings = await Rating.find({
        ratedUser: responseProduct.user._id,
      });

      if (ratings.length > 0) {
        const totalRatings = ratings.length;
        const averageRating =
          ratings.reduce((sum, rating) => sum + rating.rating, 0) /
          totalRatings;

        // Calculate rating distribution
        const ratingDistribution = {
          5: ratings.filter((r) => r.rating === 5).length,
          4: ratings.filter((r) => r.rating === 4).length,
          3: ratings.filter((r) => r.rating === 3).length,
          2: ratings.filter((r) => r.rating === 2).length,
          1: ratings.filter((r) => r.rating === 1).length,
        };

        sellerRatings = {
          averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal place
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
    }

    const responseData = buildProductRes(responseProduct);

    // Add seller ratings to response
    if (sellerRatings) {
      responseData.sellerRatings = sellerRatings;
    }

    // Add view type and seller info
    responseData.viewType = viewType;
    responseData.isSeller = isSeller;
    responseData.canPurchase = !isSeller && responseProduct.quantity > 0;
    responseData.stockStatus = responseProduct.quantity > 0 ? 'in_stock' : 'out_of_stock';
    responseData.availableQuantity = responseProduct.quantity;

    // Resolve S3 URLs for product images
    if (responseData.product_photos) {
      responseData.product_photos = responseData.product_photos.map(url => resolveS3Url(url));
    }

    return successResponse(res, "Product fetched successfully", {
      item: responseData,
    });
  } catch (error) {
    return errorResponse(res, "Failed to fetch product", 500, error.message);
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return errorResponse(res, "Product not found", 404);

    const updatedPayload = buildProductReq(req.user._id, req.body, req.files);

    // Update product fields
    Object.assign(product, updatedPayload);
    await product.save();

    const updatedProduct = await Product.findById(product._id);
    const responseData = updateProductRes(updatedProduct);

    return successResponse(res, "Product updated successfully", {
      items: responseData,
    });
  } catch (error) {
    return errorResponse(res, "Failed to update product", 500, error.message);
  }
};

// Stream a specific product image by product id and image index
exports.streamProductImage = async (req, res) => {
  try {
    const { productId, index } = req.params;
    const product = await Product.findById(productId).select('images product_photos');
    if (!product) return res.status(404).send('Not found');

    const idx = parseInt(index, 10);
    if (Number.isNaN(idx) || idx < 0) return res.status(400).send('Invalid index');

    // Prefer new in-DB images
    if (Array.isArray(product.images) && product.images[idx] && product.images[idx].data) {
      res.contentType(product.images[idx].contentType || 'image/jpeg');
      return res.send(product.images[idx].data);
    }

    // Fallback: redirect legacy file path/URL if exists
    if (Array.isArray(product.product_photos) && product.product_photos[idx]) {
      return res.redirect(302, product.product_photos[idx]);
    }

    return res.status(404).send('Image not found');
  } catch (error) {
    return res.status(500).send('Server error');
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return errorResponse(res, "Product not found", 404);
    }

    await product.deleteOne();
    return successResponse(res, "Product deleted successfully");
  } catch (error) {
    return errorResponse(res, "Failed to delete product", 500, error.message);
  }
};

exports.toggleFavorite = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId } = req.params;
    if (!productId) {
      return errorResponse(res, "Product ID is required", 400);
    }

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const index = product.favoritedBy.indexOf(userId);

    if (index > -1) {
      // Already favorited — remove
      product.favoritedBy.splice(index, 1);
      await product.save();
      return successResponse(res, "Removed from favorites", {
        favoriteCount: product.favoritedBy.length,
      });
    } else {
      // Not favorited — add
      product.favoritedBy.push(userId);
      await product.save();

      // Get user and product owner details for notification
      try {
        const user = await User.findById(userId);
        const productOwner = await User.findById(product.user);

        // Only send notification if the product owner is not the same as the user liking it
        if (productOwner && user && !productOwner._id.equals(user._id)) {
          await NotificationService.notifyProductLiked(
            product,
            user,
            productOwner
          );
        }
      } catch (notificationError) {
        // Don't fail the favorite action if notification fails
      }

      return successResponse(res, "Added to favorites", {
        favoriteCount: product.favoritedBy.length,
      });
    }
  } catch (error) {
    return errorResponse(res, "Server error", 500, error.message);
  }
};

exports.getProductWithFavorites = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId)
      .populate("user", "name email")
      .lean();

    if (!product) return res.status(404).json({ message: "Product not found" });

    product.favoriteCount = product.favoritedBy?.length || 0;
    return successResponse(res, "products count retrieved successfully", {
      items: productRes(product),
    });
  } catch (err) {
    return errorResponse(res, "Server error", 500, err.message);
  }
};

exports.filterProducts = async (req, res) => {
  try {
    const {
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
      sortBy = "createdAt",
      order = "desc",
      page = 1,
      limit = 10,
    } = req.query;

    const query = {};

    // Text search
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Filters
    if (category) query.category = category;
    if (brand) query.brand = brand;
    if (size) query.size = size;
    if (color) query.colors = color;
    if (condition) query.condition = condition;
    if (material) query.material = material;
    if (package_size) query.package_size = package_size;

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Sorting
    const sortOptions = {};
    sortOptions[sortBy] = order === "asc" ? 1 : -1;

    const total = await Product.countDocuments(query);

    const products = await Product.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const responseItems = products.map((product) => ({
      id: product._id,
      title: product.title,
      description: product.description,
      brand: product.brand,
      size: product.size,
      colors: product.colors,
      condition: product.condition,
      material: product.material,
      price: product.price,
      shipping_cost: product.shipping_cost,
      package_size: product.package_size,
      views: product.views || 0,
      favoriteCount: product.favoriteCount || 0,
      product_photos: product.product_photos.map((photo) => {
        const str = String(photo || '');
        return /^(https?:)?\/\//i.test(str) ? str : `${process.env.BASE_URL}/uploads/${str.replace(/^\/+/, '')}`;
      }),
      createdAt: product.createdAt,
    }));

    return successResponse(res, "Filtered products fetched successfully", {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      items: responseItems,
    });
  } catch (error) {
    return errorResponse(res, "Failed to filter products", 500, error.message);
  }
};

exports.searchProducts = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim() === "") {
      return errorResponse(res, "Search query is required", 400);
    }

    const keywords = q.trim().split(/\s+/); // split into words like ['zara', 'shirt']
    const regexQueries = keywords.map((word) => {
      const regex = new RegExp(word, "i"); // case-insensitive regex
      return {
        $or: [
          { title: { $regex: regex } },
          { description: { $regex: regex } },
          { brand: { $regex: regex } },
        ],
      };
    });

    const products = await Product.find({
      $and: regexQueries, // all words should be matched in any field
    })
      .populate({
        path: "user",
        select: "userName profile_photo",
      })
      .populate({
        path: "category",
        select: "name",
      });

    const responseData = products.map(buildProductRes);
    return successResponse(res, "Products found", { items: responseData });
  } catch (error) {
    return errorResponse(res, "Failed to search products", 500, error.message);
  }
};

// Get All Product With Search & Filter
// controller

// Get all active products for homepage
// const Product = require('../../../../db/models/productModel');
const Category = require('../../../../db/models/categoryModel');
// const { resolveS3Url } = require('../../../../utils/s3Utils');

exports.getAllProducts = async (req, res) => {
  try {
    const { page = 1, limit = 20, sortBy = "newest", category: categorySlugOrId, brand, condition, color, minPrice, maxPrice, material, size, title } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = { status: "active", hide: false };

    if (categorySlugOrId) {
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(categorySlugOrId);

      // Find category that contains this id/slug anywhere in its tree
      const categoryDoc = await Category.findOne({
        $or: isObjectId
          ? [
            { _id: categorySlugOrId },
            { "subCategories._id": categorySlugOrId },
            { "subCategories.childCategories._id": categorySlugOrId },
            { "subCategories.childCategories.items._id": categorySlugOrId },
          ]
          : [
            { slug: categorySlugOrId },
            { "subCategories.slug": categorySlugOrId },
            { "subCategories.childCategories.slug": categorySlugOrId },
            { "subCategories.childCategories.items.slug": categorySlugOrId },
          ],
      });

      if (!categoryDoc) {
        return res.status(404).json({ success: false, message: "Category not found" });
      }

      // === Build targeted set of category IDs ===
      const categoryIds = new Set();

      // 1️⃣ Check if it's a top-level category
      if (
        categoryDoc._id.toString() === categorySlugOrId ||
        categoryDoc.slug === categorySlugOrId
      ) {
        categoryIds.add(categoryDoc._id.toString());
        categoryDoc.subCategories.forEach(sub => {
          categoryIds.add(sub._id.toString());
          sub.childCategories.forEach(child => {
            categoryIds.add(child._id.toString());
            child.items.forEach(item => categoryIds.add(item._id.toString()));
          });
        });
      }

      // 2️⃣ Check if it's a subcategory
      categoryDoc.subCategories.forEach(sub => {
        if (sub._id.toString() === categorySlugOrId || sub.slug === categorySlugOrId) {
          categoryIds.add(sub._id.toString());
          sub.childCategories.forEach(child => {
            categoryIds.add(child._id.toString());
            child.items.forEach(item => categoryIds.add(item._id.toString()));
          });
        }

        // 3️⃣ Check if it's a child category
        sub.childCategories.forEach(child => {
          if (child._id.toString() === categorySlugOrId || child.slug === categorySlugOrId) {
            categoryIds.add(child._id.toString());
            child.items.forEach(item => categoryIds.add(item._id.toString()));
          }

          // 4️⃣ Check if it's a leaf item
          child.items.forEach(item => {
            if (item._id.toString() === categorySlugOrId || item.slug === categorySlugOrId) {
              categoryIds.add(item._id.toString());
            }
          });
        });
      });

      query.category = { $in: Array.from(categoryIds) };
    }
    if (brand) {
      query.brand = { $regex: new RegExp(brand, "i") };
    }
    if (condition) {
      query.condition = condition;
    }
    if (color) {
      query.colors = color;
    }
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }
    if(material){
      query.material = material;
    }
    if(size){
      query.size = size;
    }
    if(title){
      // Search in product name/title, description, and brand using regex for partial matching
      const keywords = title.trim().split(/\s+/);
      const regexQueries = keywords.map(word => {
        const regex = new RegExp(word, 'i'); // case-insensitive
        return {
          $or: [
            { title: { $regex: regex } },
            { description: { $regex: regex } },
            { brand: { $regex: regex } }
          ]
        };
      });
      query.$and = regexQueries;
    }


    // Sorting
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
      default:
        sortOptions = { createdAt: -1 };
        break;
    }

    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .populate("user", "userName profile firstName lastName")
      .populate("category", "name")
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const productsWithResolvedUrls = products.map(p => ({
      ...p,
      product_photos: p.product_photos?.map(url => resolveS3Url(url)) || [],
    }));

    return res.json({
      success: true,
      message: "Products fetched successfully",
      data: {
        items: productsWithResolvedUrls,
        totalItems: productsWithResolvedUrls.length,
        total,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        hasNextPage: skip + productsWithResolvedUrls.length < total,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};


// Simple test function
exports.getAllProductsTest = async (req, res) => {
  try {
    const products = await Product.find({ status: "active" }).limit(5).lean();

    return res.json({
      success: true,
      message: 'Products fetched successfully',
      data: {
        items: products,
        totalItems: products.length
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Get seller's other products (Member's Items)
exports.getSellerProducts = async (req, res) => {
  try {
    const { sellerId } = req.params;
    const { productId } = req.query; // Exclude current product
    const { limit = 10 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(sellerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid seller ID format",
      });
    }

    // Build query to get seller's other products (including sold)
    const query = {
      user: sellerId,
      status: { $in: ["active", "sold"] },
      hide: false
    };

    // Exclude current product if provided
    if (productId && mongoose.Types.ObjectId.isValid(productId)) {
      query._id = { $ne: productId };
    }

    const products = await Product.find(query)
      .populate('user', 'userName profile firstName lastName, stripeAccountId, paypalEmail')
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    // Resolve S3 URLs for product images
    const productsWithResolvedUrls = products.map(product => ({
      ...product,
      product_photos: product.product_photos ? product.product_photos.map(url => resolveS3Url(url)) : []
    }));

    return res.json({
      success: true,
      message: 'Seller products fetched successfully',
      data: {
        items: productsWithResolvedUrls,
        totalItems: productsWithResolvedUrls.length
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

exports.getUserFavoriteProducts = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get page and limit from query with default values
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Total favorite products count with status and hide check (including sold)
    const total = await Product.countDocuments({
      favoritedBy: userId,
      status: { $in: ["active", "sold"] },
      hide: false,
    });

    // Paginated favorite products (including sold)
    const favoriteProducts = await Product.find({
      favoritedBy: userId,
      status: { $in: ["active", "sold"] },
      hide: false,
    })
      .lean()
      .skip(skip)
      .limit(limit);

    const enriched = favoriteProducts.map((product) => {
      const { _id, __v, ...rest } = product;
      return {
        id: _id,
        ...rest,
        favoriteCount: product.favoritedBy?.length || 0,
      };
    });

    return successResponse(res, "Favorite products fetched successfully", {
      favorites: enriched,
      totalItems: total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      hasNextPage: skip + enriched.length < total,
    });
  } catch (err) {
    return errorResponse(res, "Server error", 500, err.message);
  }
};

exports.toggleProductVisibility = async (req, res) => {
  const { productId } = req.params;
  const { hide } = req.body;

  try {
    const product = await Product.findOne({
      _id: productId,
      user: req.user._id.toString(),
    });

    if (!product) {
      return res
        .status(404)
        .json({ message: "Product not found or not authorized" });
    }

    product.hide = hide;
    await product.save();

    res.status(200).json({
      message: `Product ${hide ? "hidden" : "unhidden"} successfully`,
      product,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Bump product functionality
exports.bumpProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id;

    const product = await Product.findOne({ _id: productId, user: userId });

    if (!product) {
      return errorResponse(res, "Product not found or not authorized", 404);
    }

    // Check if product can be bumped (not sold, reserved, or cancelled)
    if (["sold", "reserved", "cancelled"].includes(product.status)) {
      return errorResponse(res, `Cannot bump a ${product.status} product`, 400);
    }

    // Check if product was bumped recently (e.g., within last 24 hours)
    const lastBumpTime = product.bumpedAt;
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    if (lastBumpTime && lastBumpTime > twentyFourHoursAgo) {
      const timeLeft = Math.ceil(
        (lastBumpTime.getTime() + 24 * 60 * 60 * 1000 - now.getTime()) /
        (60 * 60 * 1000)
      );
      return errorResponse(
        res,
        `You can bump this product again in ${timeLeft} hours`,
        400
      );
    }

    await product.bumpProduct(userId);

    return successResponse(res, "Product bumped successfully", {
      product: {
        id: product._id,
        bumpedAt: product.bumpedAt,
        bumpCount: product.bumpCount,
      },
    });
  } catch (error) {
    return errorResponse(res, "Failed to bump product", 500, error.message);
  }
};

// Mark product as sold
exports.markAsSold = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id;

    const product = await Product.findOne({ _id: productId, user: userId });

    if (!product) {
      return errorResponse(res, "Product not found or not authorized", 404);
    }

    if (product.status === "sold") {
      return errorResponse(res, "Product is already marked as sold", 400);
    }

    await product.updateStatus(
      "sold",
      userId,
      "Product marked as sold by owner"
    );

    return successResponse(res, "Product marked as sold successfully", {
      product: {
        id: product._id,
        status: product.status,
        updatedAt: product.updatedAt,
      },
    });
  } catch (error) {
    return errorResponse(
      res,
      "Failed to mark product as sold",
      500,
      error.message
    );
  }
};

// Mark product as reserved
exports.markAsReserved = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id;

    const product = await Product.findOne({ _id: productId, user: userId });

    if (!product) {
      return errorResponse(res, "Product not found or not authorized", 404);
    }

    if (product.status === "reserved") {
      return errorResponse(res, "Product is already marked as reserved", 400);
    }

    if (product.status === "sold") {
      return errorResponse(res, "Cannot reserve a sold product", 400);
    }

    await product.updateStatus(
      "reserved",
      userId,
      "Product marked as reserved by owner"
    );

    return successResponse(res, "Product marked as reserved successfully", {
      product: {
        id: product._id,
        status: product.status,
        updatedAt: product.updatedAt,
      },
    });
  } catch (error) {
    return errorResponse(
      res,
      "Failed to mark product as reserved",
      500,
      error.message
    );
  }
};

// Reactivate product (unmark sold/reserved)
exports.reactivateProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id;

    const product = await Product.findOne({ _id: productId, user: userId });

    if (!product) {
      return errorResponse(res, "Product not found or not authorized", 404);
    }

    if (product.status === "active") {
      return errorResponse(res, "Product is already active", 400);
    }

    if (!["sold", "reserved"].includes(product.status)) {
      return errorResponse(
        res,
        "Can only reactivate sold or reserved products",
        400
      );
    }

    await product.updateStatus(
      "active",
      userId,
      "Product reactivated by owner"
    );

    return successResponse(res, "Product reactivated successfully", {
      product: {
        id: product._id,
        status: product.status,
        updatedAt: product.updatedAt,
      },
    });
  } catch (error) {
    return errorResponse(
      res,
      "Failed to reactivate product",
      500,
      error.message
    );
  }
};

// Update product quantity (for sellers to restock)
exports.updateProductQuantity = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;
    const userId = req.user._id;

    // Validate quantity
    if (!quantity || quantity < 0) {
      return errorResponse(res, "Valid quantity is required", 400);
    }

    const numericQuantity = parseInt(quantity);
    if (isNaN(numericQuantity) || numericQuantity < 0) {
      return errorResponse(res, "Quantity must be a valid non-negative number", 400);
    }

    // Find product and verify ownership
    const product = await Product.findOne({ _id: id, user: userId });
    if (!product) {
      return errorResponse(res, "Product not found or not authorized", 404);
    }

    // Update quantity and status
    const oldQuantity = product.quantity;
    product.quantity = numericQuantity;

    // Update status based on quantity
    if (numericQuantity === 0) {
      product.status = 'out_of_stock';
    } else if (product.status === 'out_of_stock' && numericQuantity > 0) {
      product.status = 'active';
    }

    await product.save();

    return successResponse(res, "Product quantity updated successfully", {
      product: {
        id: product._id,
        title: product.title,
        quantity: product.quantity,
        status: product.status,
        oldQuantity: oldQuantity,
        updatedAt: product.updatedAt,
      },
    });
  } catch (error) {
    return errorResponse(
      res,
      "Failed to update product quantity",
      500,
      error.message
    );
  }
};
