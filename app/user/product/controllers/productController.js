const mongoose = require('mongoose');
const Product = require('../../../../db/models/productModel');
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');
const { buildProductReq, buildProductRes, updateProductRes, getAllProductRes, productRes, buildSearchQuery, buildProductQuery, buildGetUserProductQuery } = require('../dto/product.dto')
const User = require('../../../../db/models/userModel');
const Rating = require('../../../../db/models/ratingModel');
const Personalization = require("../../../../db/models/Personalization");
const { UserRes } = require('../../profile/dto/user.dto');
const { paginateQuery } = require('../../../../utils/pagination');
const NotificationService = require('../../../../services/NotificationService');

exports.sellProduct = async (req, res) => {
  try {
    const product = await Product.createProduct(req.user._id, req.body);
    res.status(201).json({ message: 'Product listed successfully', product });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateProductStatus = async (req, res) => {
  try {
    const { id } = req.params; // productId from URL
    const { status } = req.body; // "sold" or other

    // Validate product ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 'Invalid product ID', 400);
    }

    // Find product and update
    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!updatedProduct) {
      return errorResponse(res, 'Product not found', 404);
    }

    // Format the product response
    const responseData = updateProductRes(updatedProduct);

    return successResponse(res, 'Product status updated successfully', {
      item: responseData
    });

  } catch (error) {
    return errorResponse(res, 'Failed to update product status', 500, error.message);
  }
};
exports.sellProductByFormdata = async (req, res) => {
  try {
    const productPayload = buildProductReq(req.user._id, req.body, req.files);
    const createdProduct = await Product.create(productPayload);
    // const product = await Product.findById(createdProduct._id).populate('user', 'name email');
    const responseData = buildProductRes(createdProduct)

    return successResponse(res, 'Product created successfully', { items: responseData });
  } catch (error) {
    return errorResponse(res, 'Failed to create product', 500, error.message);
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
        .populate('category')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }), // default: Newest first
      Product.countDocuments(query)
    ]);

    const responseData = products.map(productRes);

    return successResponse(res, 'Products fetched successfully', {
      items: responseData,
      totalItems: total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      hasNextPage: skip + products.length < total
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getUserWithProducts = async (req, res) => {
  try {
    const userId = req.params.id;

    // Pagination & Sorting
    const {
      sortBy = 'relevance',
      page = 1,
      limit = 20
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Sort Options
    let sortOptions = {};
    switch (sortBy) {
      case 'Price: Low to High':
        sortOptions = { price: 1 };
        break;
      case 'Price: High to Low':
        sortOptions = { price: -1 };
        break;
      case 'Oldest first':
        sortOptions = { createdAt: 1 };
        break;
      case 'Newest first':
        sortOptions = { createdAt: -1 };
        break;
      case 'Relevance':
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
      'userName email profile lastLoginAt city country'
    );
    if (!user) return errorResponse(res, 'User not found', 404);

    // Fetch user's filtered & paginated products
    const [products, total] = await Promise.all([
      Product.find(productQuery)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      Product.countDocuments(productQuery)
    ]);

    // Response formatting
    const userData = UserRes(user);
    const items = products.map(productRes);

    return successResponse(res, 'Products fetched successfully', {
      user: userData,
      items,
      totalItems: total,
      total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      hasNextPage: skip + products.length < total
    });

  } catch (error) {
    return errorResponse(res, 'Failed to fetch user and products', 500, error.message);
  }
};



// exports.getAllProducts = async (req, res) => {
//   try {
//     const responseProducts = await Product.find({ status: 'active' }).populate('user', 'userName firstName lastName profile lastLoginAt city country');

//     const responseData = responseProducts.map(getAllProductRes); // Format response
//     // console.log('Fetched products:', responseProducts);

//     return successResponse(res, 'Active products fetched successfully', { items: responseData });
//   } catch (error) {
//     return errorResponse(res, 'Failed to fetch products', 500, error.message);
//   }
// };





// exports.getProduct = async (req, res) => {
//   try {
//     const productId = req.params.id; // or whatever param you use
//     // const responseProduct = await Product.findById(productId).populate('user', 'userName email profile');
//     // Increment view count by 1 and return updated product
//     const responseProduct = await Product.findByIdAndUpdate(
//       productId,
//       { $inc: { views: 1 } },
//       { new: true }
//     ).populate('user', 'userName email profile');


//     if (!responseProduct) {
//       return res.status(404).json({ message: 'Product not found' });
//     }

//     const responseData = buildProductRes(responseProduct);

//     return successResponse(res, 'Product fetched successfully', { item: responseData });
//   } catch (error) {
//     return errorResponse(res, 'Failed to fetch product', 500, error.message);
//   }
// };


exports.getProduct = async (req, res) => {
  try {
    const productId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format',
      });
    }

    const responseProduct = await Product.findByIdAndUpdate(
      productId,
      { $inc: { views: 1 } },
      { new: true }
    )
      // Populate all necessary user fields, including city and country
      .populate('user', 'userName email profile city country lastLoginAt firstName lastName cityShow');

    if (!responseProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Get seller's rating data
    let sellerRatings = null;
    if (responseProduct.user && responseProduct.user._id) {
      const ratings = await Rating.find({ ratedUser: responseProduct.user._id });

      if (ratings.length > 0) {
        const totalRatings = ratings.length;
        const averageRating = ratings.reduce((sum, rating) => sum + rating.rating, 0) / totalRatings;

        // Calculate rating distribution
        const ratingDistribution = {
          5: ratings.filter(r => r.rating === 5).length,
          4: ratings.filter(r => r.rating === 4).length,
          3: ratings.filter(r => r.rating === 3).length,
          2: ratings.filter(r => r.rating === 2).length,
          1: ratings.filter(r => r.rating === 1).length
        };

        sellerRatings = {
          averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal place
          totalRatings,
          ratingDistribution
        };
      } else {
        sellerRatings = {
          averageRating: 0,
          totalRatings: 0,
          ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
        };
      }
    }

    const responseData = buildProductRes(responseProduct);

    // Add seller ratings to response
    if (sellerRatings) {
      responseData.sellerRatings = sellerRatings;
    }

    return successResponse(res, 'Product fetched successfully', { item: responseData });

  } catch (error) {
    return errorResponse(res, 'Failed to fetch product', 500, error.message);
  }
};



exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return errorResponse(res, 'Product not found', 404);

    const updatedPayload = buildProductReq(req.user._id, req.body, req.files);

    // Update product fields
    Object.assign(product, updatedPayload);
    await product.save();

    const updatedProduct = await Product.findById(product._id);
    const responseData = updateProductRes(updatedProduct);

    return successResponse(res, 'Product updated successfully', { items: responseData });
  } catch (error) {
    return errorResponse(res, 'Failed to update product', 500, error.message);
  }
};


exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return errorResponse(res, 'Product not found', 404);
    }

    await product.deleteOne();

    return successResponse(res, 'Product deleted successfully');
  } catch (error) {
    return errorResponse(res, 'Failed to delete product', 500, error.message);
  }
};

exports.toggleFavorite = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId } = req.params;

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const index = product.favoritedBy.indexOf(userId);

    if (index > -1) {
      // Already favorited — remove
      product.favoritedBy.splice(index, 1);
      await product.save();
      return successResponse(res, 'Removed from favorites', { favoriteCount: product.favoritedBy.length });
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
          await NotificationService.notifyProductLiked(product, user, productOwner);
        }
      } catch (notificationError) {
        console.error('Error sending product liked notification:', notificationError);
        // Don't fail the favorite action if notification fails
      }

      return successResponse(res, 'Added to favorites', { favoriteCount: product.favoritedBy.length });
    }

  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Server error', 500, error.message);
  }
};

exports.getProductWithFavorites = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId)
      .populate('user', 'name email')
      .lean();

    if (!product) return res.status(404).json({ message: 'Product not found' });

    product.favoriteCount = product.favoritedBy?.length || 0;
    return successResponse(res, 'products count retrieved successfully', {
      items: productRes(product),
    });
  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Server error', 500, err.message);
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
      sortBy = 'createdAt',
      order = 'desc',
      page = 1,
      limit = 10
    } = req.query;

    const query = {};

    // Text search
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
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
    sortOptions[sortBy] = order === 'asc' ? 1 : -1;

    const total = await Product.countDocuments(query);

    const products = await Product.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const responseItems = products.map(product => ({
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
      product_photos: product.product_photos.map(photo =>
        `${process.env.BASE_URL}/${photo}`
      ),
      createdAt: product.createdAt
    }));

    return successResponse(res, 'Filtered products fetched successfully', {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      items: responseItems
    });
  } catch (error) {
    return errorResponse(res, 'Failed to filter products', 500, error.message);
  }
};


exports.searchProducts = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim() === '') {
      return errorResponse(res, 'Search query is required', 400);
    }

    const keywords = q.trim().split(/\s+/); // split into words like ['zara', 'shirt']
    const regexQueries = keywords.map((word) => {
      const regex = new RegExp(word, 'i'); // case-insensitive regex
      return {
        $or: [
          { title: { $regex: regex } },
          { description: { $regex: regex } },
          { brand: { $regex: regex } }
        ]
      };
    });

    const products = await Product.find({
      $and: regexQueries // all words should be matched in any field
    })
    // .populate({
    //   path: 'user',
    //   select: 'userName profile_photo'
    // })
    // .populate({
    //   path: 'category',
    //   select: 'name'
    // });

    const responseData = products.map(buildProductRes);
    return successResponse(res, 'Products found', { items: responseData });

  } catch (error) {
    return errorResponse(res, 'Failed to search products', 500, error.message);
  }
};





// Get All Product With Search & Filter 
// controller

exports.getAllProducts = async (req, res) => {
  try {
    const {
      sortBy = "relevance",
      page = 1,
      limit = 20
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const isAuthenticated = !!req.user;

    let query = await buildProductQuery(req.query);

    // ✅ Safe personalization check
    if (isAuthenticated && mongoose.Types.ObjectId.isValid(req.user?.id)) {
      const userObjectId = new mongoose.Types.ObjectId(req.user.id);

      const personalization = await Personalization.findOne({ user: userObjectId });

      if (personalization) {
        const { followedCategories = [], followedBrands = [] } = personalization;

        if (followedCategories.length || followedBrands.length) {
          query = {
            ...query,
            $or: [
              ...(followedCategories.length ? [{ category: { $in: followedCategories } }] : []),
              ...(followedBrands.length ? [{ brand: { $in: followedBrands } }] : [])
            ]
          };
        }
      }
    }

    // 📦 Sort Options
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

    // ✅ Aggregation pipeline to filter out products whose user is deleted/null
    const pipeline = [
      { $match: query },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "user"
        }
      },
      { $unwind: "$user" },
      { $match: { "user.deletedAt": null } }, // only active users
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "category"
        }
      },
      { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
      { $sort: sortOptions },
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [{ $skip: skip }, { $limit: parseInt(limit) }]
        }
      }
    ];

    const result = await Product.aggregate(pipeline);

    const products = result[0].data || [];
    const total = result[0].metadata.length ? result[0].metadata[0].total : 0;

    const responseData = products.map(getAllProductRes);

    return successResponse(res, "Products fetched successfully", {
      items: responseData,
      totalItems: responseData.length,
      total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      hasNextPage: skip + responseData.length < total
    });
  } catch (error) {
    return errorResponse(res, "Failed to fetch products", 500, error.message);
  }
};

exports.getUserFavoriteProducts = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get page and limit from query with default values
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Total favorite products count with status and hide check
    const total = await Product.countDocuments({
      favoritedBy: userId,
      status: 'active',
      hide: false,
    });

    // Paginated favorite products
    const favoriteProducts = await Product.find({
      favoritedBy: userId,
      status: 'active',
      hide: false,
    })
      .lean()
      .skip(skip)
      .limit(limit);

    const enriched = favoriteProducts.map(product => {
      const { _id, __v, ...rest } = product;
      return {
        id: _id,
        ...rest,
        favoriteCount: product.favoritedBy?.length || 0,
      };
    });

    return successResponse(res, 'Favorite products fetched successfully', {
      favorites: enriched,
      totalItems: total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      hasNextPage: skip + enriched.length < total,
    });

  } catch (err) {
    console.error('Error fetching favorites:', err);
    return errorResponse(res, 'Server error', 500, err.message);
  }
};

exports.toggleProductVisibility = async (req, res) => {
  const { productId } = req.params;
  const { hide } = req.body;

  try {
    console.log('Toggle request:', { productId, userId: req.user._id });

    const product = await Product.findOne({ _id: productId, user: req.user._id.toString() });

    if (!product) {
      return res.status(404).json({ message: 'Product not found or not authorized' });
    }

    product.hide = hide;
    await product.save();

    res.status(200).json({
      message: `Product ${hide ? 'hidden' : 'unhidden'} successfully`,
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
      return errorResponse(res, 'Product not found or not authorized', 404);
    }

    // Check if product can be bumped (not sold, reserved, or cancelled)
    if (['sold', 'reserved', 'cancelled'].includes(product.status)) {
      return errorResponse(res, `Cannot bump a ${product.status} product`, 400);
    }

    // Check if product was bumped recently (e.g., within last 24 hours)
    const lastBumpTime = product.bumpedAt;
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    if (lastBumpTime && lastBumpTime > twentyFourHoursAgo) {
      const timeLeft = Math.ceil((lastBumpTime.getTime() + 24 * 60 * 60 * 1000 - now.getTime()) / (60 * 60 * 1000));
      return errorResponse(res, `You can bump this product again in ${timeLeft} hours`, 400);
    }

    await product.bumpProduct(userId);

    return successResponse(res, 'Product bumped successfully', {
      product: {
        id: product._id,
        bumpedAt: product.bumpedAt,
        bumpCount: product.bumpCount
      }
    });
  } catch (error) {
    return errorResponse(res, 'Failed to bump product', 500, error.message);
  }
};

// Mark product as sold
exports.markAsSold = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id;

    const product = await Product.findOne({ _id: productId, user: userId });

    if (!product) {
      return errorResponse(res, 'Product not found or not authorized', 404);
    }

    if (product.status === 'sold') {
      return errorResponse(res, 'Product is already marked as sold', 400);
    }

    await product.updateStatus('sold', userId, 'Product marked as sold by owner');

    return successResponse(res, 'Product marked as sold successfully', {
      product: {
        id: product._id,
        status: product.status,
        updatedAt: product.updatedAt
      }
    });
  } catch (error) {
    return errorResponse(res, 'Failed to mark product as sold', 500, error.message);
  }
};

// Mark product as reserved
exports.markAsReserved = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id;

    const product = await Product.findOne({ _id: productId, user: userId });

    if (!product) {
      return errorResponse(res, 'Product not found or not authorized', 404);
    }

    if (product.status === 'reserved') {
      return errorResponse(res, 'Product is already marked as reserved', 400);
    }

    if (product.status === 'sold') {
      return errorResponse(res, 'Cannot reserve a sold product', 400);
    }

    await product.updateStatus('reserved', userId, 'Product marked as reserved by owner');

    return successResponse(res, 'Product marked as reserved successfully', {
      product: {
        id: product._id,
        status: product.status,
        updatedAt: product.updatedAt
      }
    });
  } catch (error) {
    return errorResponse(res, 'Failed to mark product as reserved', 500, error.message);
  }
};

// Reactivate product (unmark sold/reserved)
exports.reactivateProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id;

    const product = await Product.findOne({ _id: productId, user: userId });

    if (!product) {
      return errorResponse(res, 'Product not found or not authorized', 404);
    }

    if (product.status === 'active') {
      return errorResponse(res, 'Product is already active', 400);
    }

    if (!['sold', 'reserved'].includes(product.status)) {
      return errorResponse(res, 'Can only reactivate sold or reserved products', 400);
    }

    await product.updateStatus('active', userId, 'Product reactivated by owner');

    return successResponse(res, 'Product reactivated successfully', {
      product: {
        id: product._id,
        status: product.status,
        updatedAt: product.updatedAt
      }
    });
  } catch (error) {
    return errorResponse(res, 'Failed to reactivate product', 500, error.message);
  }
};

