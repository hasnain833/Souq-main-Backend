const Rating = require('../../../../db/models/ratingModel');
const EscrowTransaction = require('../../../../db/models/escrowTransactionModel');
const User = require('../../../../db/models/userModel');
const Product = require('../../../../db/models/productModel');

/**
 * Submit a rating for a transaction
 */
exports.submitRating = async (req, res) => {
  try {
    const userId = req.user.id;
    const { transactionId } = req.params;
    const {
      rating,
      review,
      categories,
      ratingType
    } = req.body;

    // Validate required fields
    if (!rating || !ratingType) {
      return res.status(400).json({
        success: false,
        error: 'Rating and rating type are required'
      });
    }

    // Validate rating value
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be an integer between 1 and 5'
      });
    }

    // Find the transaction using utility function
    const { findEscrowTransaction, findStandardPayment } = require('../../../../utils/transactionUtils');

    const transactionType = req.query.type || 'escrow';
    console.log(`🔍 Looking for ${transactionType} transaction: ${transactionId}`);

    let transaction;

    if (transactionType === 'standard') {
      transaction = await findStandardPayment(transactionId, true);
    } else {
      transaction = await findEscrowTransaction(transactionId, true);
    }

    if (!transaction) {
      console.log(`❌ Transaction not found: ${transactionId}`);
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }




    // Verify user is part of this transaction using ObjectIds
    const userObjectId = req.user._id; // MongoDB ObjectId
    const isBuyer = transaction.buyer._id.toString() === userObjectId.toString();
    const isSeller = transaction.seller._id.toString() === userObjectId.toString();

    if (!isBuyer && !isSeller) {
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to rate this transaction'
      });
    }

      


    // Validate rating type matches user role
    if ((isBuyer && ratingType !== 'buyer_to_seller') || 
        (isSeller && ratingType !== 'seller_to_buyer')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid rating type for your role in this transaction'
      });
    }

    // Check if transaction is completed or funds are held (payment successful)
    const validStatuses = ['completed', 'funds_held', 'payment_processing', 'processing'];
    if (!validStatuses.includes(transaction.status)) {
      return res.status(400).json({
        success: false,
        error: 'You can only rate transactions where payment has been processed'
      });
    }

    // Determine who is being rated
    const ratedUserId = isBuyer ? transaction.seller._id : transaction.buyer._id;

    // Check if rating already exists using ObjectIds
    const ratingQuery = {
      ratedBy: userObjectId,
      ratingType: ratingType
    };

    // Set the appropriate transaction field based on type
    if (transactionType === 'escrow') {
      ratingQuery.escrowTransaction = transaction._id;
    } else {
      ratingQuery.standardPayment = transaction._id;
    }

    const existingRating = await Rating.findOne(ratingQuery);

    if (existingRating) {
      return res.status(400).json({
        success: false,
        error: 'You have already rated this transaction'
      });
    }
    // Create the rating using ObjectIds
    const ratingData = {
      product: transaction.product._id,
      ratedBy: userObjectId,
      ratedUser: ratedUserId,
      ratingType: ratingType,
      rating: rating,
      review: review || '',
      categories: categories || {},
      status: 'published',
      metadata: {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip
      }
    };

    // Set the appropriate transaction field based on type
    if (transactionType === 'escrow') {
      ratingData.escrowTransaction = transaction._id;
    } else {
      ratingData.standardPayment = transaction._id;
    }

    const newRating = new Rating(ratingData);

    await newRating.save();
    console.log('Rating created successfully:', newRating);

    // Populate the rating for response
    await newRating.populate([
      { path: 'ratedBy', select: 'firstName lastName profile' },
      { path: 'ratedUser', select: 'firstName lastName profile' },
      { path: 'product', select: 'title product_photos' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Rating submitted successfully',
      data: {
        rating: newRating
      }
    });

  } catch (error) {
    console.error('Error submitting rating:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit rating'
    });
  }
};

/**
 * Submit a rating for a product (without transaction)
 */
exports.submitProductRating = async (req, res) => {
  try {
    // Validate user authentication data first
    if (!req.user) {
      console.error('❌ No user object in request');
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    const userId = req.user.id; // UUID
    const userObjectId = req.user._id; // MongoDB ObjectId
    const { productId } = req.params;
    const {
      rating,
      review,
      categories,
      ratingType = 'buyer_to_seller'
    } = req.body;

    console.log('🌟 Submitting product rating:', {
      userId,
      userObjectId,
      productId,
      rating,
      ratingType,
      userEmail: req.user.email,
      userName: req.user.userName
    });

    // Additional validation for user data
    if (!userObjectId) {
      console.error('❌ User ObjectId is missing from req.user:', req.user);
      return res.status(400).json({
        success: false,
        error: 'User authentication data is incomplete'
      });
    }

    // Validate productId
    if (!productId) {
      console.error('❌ Product ID is missing');
      return res.status(400).json({
        success: false,
        error: 'Product ID is required'
      });
    }

    // Validate MongoDB ObjectId format
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      console.error('❌ Invalid product ID format:', productId);
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID format'
      });
    }

    // Validate required fields
    if (!rating) {
      return res.status(400).json({
        success: false,
        error: 'Rating is required'
      });
    }

    // Validate rating value
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be an integer between 1 and 5'
      });
    }

    // Get product details
    const Product = require('../../../../db/models/productModel');

    console.log('🔍 Looking for product with ID:', productId);

    const product = await Product.findById(productId).populate('user', 'firstName lastName');

    if (!product) {
      console.error('❌ Product not found with ID:', productId);
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    console.log('✅ Product found:', {
      productId: product._id,
      productTitle: product.title,
      sellerId: product.user._id,
      sellerName: `${product.user.firstName} ${product.user.lastName}`
    });

    // Prevent self-rating
    if (product.user._id.toString() === userObjectId.toString()) {
      console.log('❌ User trying to rate their own product');
      return res.status(400).json({
        success: false,
        error: 'You cannot rate your own product'
      });
    }

    // Check if user has already rated this product
    console.log('🔍 Checking for existing rating...');
    const existingRating = await Rating.findOne({
      product: productId,
      ratedBy: userObjectId,
      ratingType: ratingType
    });

    if (existingRating) {
      console.log('❌ User has already rated this product');
      return res.status(400).json({
        success: false,
        error: 'You have already rated this product'
      });
    }

    // Create the rating
    const ratingData = {
      product: productId,
      ratedBy: userObjectId,
      ratedUser: product.user._id,
      ratingType: ratingType,
      rating: rating,
      review: review || '',
      categories: categories || {},
      status: 'published',
      metadata: {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip
      }
    };

    console.log('📝 Creating rating with data:', {
      product: productId,
      ratedBy: userObjectId,
      ratedUser: product.user._id,
      ratingType: ratingType,
      rating: rating
    });

    const newRating = new Rating(ratingData);
    await newRating.save();

    console.log('✅ Product rating created successfully:', newRating._id);

    // Populate the rating for response
    await newRating.populate([
      { path: 'ratedBy', select: 'firstName lastName profile' },
      { path: 'ratedUser', select: 'firstName lastName profile' },
      { path: 'product', select: 'title product_photos' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Product rating submitted successfully',
      data: {
        rating: newRating
      }
    });

  } catch (error) {
    console.error('❌ Error submitting product rating:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error details:', {
      message: error.message,
      name: error.name,
      code: error.code
    });
    res.status(500).json({
      success: false,
      error: 'Failed to submit product rating',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get ratings for a specific user
 */
exports.getUserRatings = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, type = 'received' } = req.query;

    // Validate userId
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    // Validate MongoDB ObjectId format
    const mongoose = require('mongoose');
    let queryUserId = userId;
    
    // If userId is not a valid ObjectId, try to find user by UUID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      const User = require('../../../../db/models/userModel');
      const user = await User.findOne({ id: userId }).select('_id');
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }
      queryUserId = user._id;
    }

    const query = type === 'received'
      ? { ratedUser: queryUserId, status: 'published' }
      : { ratedBy: queryUserId, status: 'published' };

    // Use Promise.all for parallel execution
    const [ratings, totalRatings, averageRating] = await Promise.all([
      Rating.find(query)
        .populate('ratedBy', 'firstName lastName profile')
        .populate('ratedUser', 'firstName lastName profile')
        .populate('product', 'title product_photos')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit))
        .lean(), // Use lean() for better performance
      Rating.countDocuments(query),
      Rating.getUserAverageRating(queryUserId).catch(() => ({ averageRating: 0, totalRatings: 0 }))
    ]);

    const response = {
      success: true,
      data: {
        ratings,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalRatings / limit),
          totalRatings,
          hasNext: page * limit < totalRatings,
          hasPrev: page > 1
        },
        averageRating: averageRating || { averageRating: 0, totalRatings: 0 }
      }
    };

    res.json(response);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user ratings',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get ratings for a specific product
 */
exports.getProductRatings = async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const ratings = await Rating.find({
      product: productId,
      status: 'published'
    })
      .populate('ratedBy', 'firstName lastName profile')
      .populate('ratedUser', 'firstName lastName profile')
      .populate('escrowTransaction', 'transactionId createdAt')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const totalRatings = await Rating.countDocuments({
      product: productId,
      status: 'published'
    });

    // Get product's average rating
    const averageRating = await Rating.getProductAverageRating(productId);

    res.json({
      success: true,
      data: {
        ratings,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalRatings / limit),
          totalRatings,
          hasNext: page * limit < totalRatings,
          hasPrev: page > 1
        },
        averageRating
      }
    });

  } catch (error) {
    console.error('Error fetching product ratings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product ratings'
    });
  }
};

/**
 * Get pending ratings for a user (ratings they need to submit)
 */
exports.getPendingRatings = async (req, res) => {
  try {
    const userId = req.user.id; // This is the UUID from the user
    const userObjectId = req.user._id; // This is the MongoDB ObjectId

    console.log(`🌟 Getting pending ratings for user: ${userId} (ObjectId: ${userObjectId})`);

    // Find completed or funds_held transactions where user hasn't rated yet
    // Use the MongoDB ObjectId for querying EscrowTransaction
    const completedTransactions = await EscrowTransaction.find({
      $or: [
        { buyer: userObjectId },
        { seller: userObjectId }
      ],
      status: { $in: ['completed', 'funds_held'] }
    })
      .populate('buyer', 'firstName lastName profile')
      .populate('seller', 'firstName lastName profile')
      .populate('product', 'title product_photos')
      .sort({ updatedAt: -1 });

    console.log(`📦 Found ${completedTransactions.length} completed transactions`);

    const pendingRatings = [];

    for (const transaction of completedTransactions) {
      const isBuyer = transaction.buyer._id.toString() === userObjectId.toString();
      const ratingType = isBuyer ? 'buyer_to_seller' : 'seller_to_buyer';

      console.log(`🔍 Checking transaction ${transaction.transactionId}: isBuyer=${isBuyer}, ratingType=${ratingType}`);

      // Check if user has already rated this transaction
      // Use the MongoDB ObjectId for querying Rating
      const existingRating = await Rating.findOne({
        escrowTransaction: transaction._id,
        ratedBy: userObjectId,
        ratingType: ratingType
      });

      if (!existingRating) {
        console.log(`✅ Pending rating found for transaction: ${transaction.transactionId}`);
        pendingRatings.push({
          transaction,
          ratingType,
          ratedUser: isBuyer ? transaction.seller : transaction.buyer
        });
      } else {
        console.log(`⚠️ Rating already exists for transaction: ${transaction.transactionId}`);
      }
    }

    console.log(`🌟 Total pending ratings: ${pendingRatings.length}`);

    res.json({
      success: true,
      data: {
        ratings: pendingRatings, // Changed from pendingRatings to ratings for consistency
        totalPending: pendingRatings.length
      }
    });

  } catch (error) {
    console.error('❌ Error fetching pending ratings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending ratings'
    });
  }
};

/**
 * Get existing rating for a transaction by the current user
 */
exports.getTransactionRating = async (req, res) => {
  try {
    const userId = req.user.id; // UUID
    const userObjectId = req.user._id; // MongoDB ObjectId
    const { transactionId } = req.params;
    const transactionType = req.query.type || 'escrow';

    console.log(`🌟 Getting rating for transaction: ${transactionId} (type: ${transactionType})`);

    // Use the transaction utility to safely find the transaction
    const { findEscrowTransaction, findStandardPayment } = require('../../../../utils/transactionUtils');

    let transaction;
    if (transactionType === 'escrow') {
      transaction = await findEscrowTransaction(transactionId, true);
    } else {
      transaction = await findStandardPayment(transactionId, true);
    }

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    // Determine user role and rating type
    const isBuyer = transaction.buyer._id.toString() === userObjectId.toString();
    const ratingType = isBuyer ? 'buyer_to_seller' : 'seller_to_buyer';

    // Find existing rating
    const ratingQuery = {
      ratedBy: userObjectId,
      ratingType: ratingType
    };

    if (transactionType === 'escrow') {
      ratingQuery.escrowTransaction = transaction._id;
    } else {
      ratingQuery.standardPayment = transaction._id;
    }

    const existingRating = await Rating.findOne(ratingQuery)
      .populate('ratedBy', 'firstName lastName profile')
      .populate('ratedUser', 'firstName lastName profile')
      .populate('product', 'title product_photos');

    if (existingRating) {
      console.log(`✅ Found existing rating for transaction: ${transactionId}`);
      return res.json({
        success: true,
        data: {
          hasRating: true,
          rating: existingRating
        }
      });
    } else {
      console.log(`ℹ️ No existing rating found for transaction: ${transactionId}`);
      return res.json({
        success: true,
        data: {
          hasRating: false,
          rating: null
        }
      });
    }

  } catch (error) {
    console.error('❌ Error getting transaction rating:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get transaction rating'
    });
  }
};

/**
 * Check if user can rate a specific transaction
 */
exports.canRateTransaction = async (req, res) => {
  try {
    const userId = req.user.id; // UUID
    const userObjectId = req.user._id; // MongoDB ObjectId
    const { transactionId } = req.params;
    const transactionType = req.query.type || 'escrow';

    console.log(`🌟 Checking if user ${userId} can rate transaction: ${transactionId} (type: ${transactionType})`);

    // Use the transaction utility to safely find the transaction
    const { findEscrowTransaction, findStandardPayment } = require('../../../../utils/transactionUtils');

    // Find transaction based on type
    let transaction;
    if (transactionType === 'escrow') {
      transaction = await findEscrowTransaction(transactionId, true);
    } else {
      transaction = await findStandardPayment(transactionId, true);
    }

    if (!transaction) {
      console.log(`❌ Transaction not found: ${transactionId}`);
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    console.log(`✅ Found ${transactionType} transaction: ${transaction.transactionId} (status: ${transaction.status})`);

    // Compare using MongoDB ObjectIds, not UUIDs
    const isBuyer = transaction.buyer._id.toString() === userObjectId.toString();
    const isSeller = transaction.seller._id.toString() === userObjectId.toString();

    console.log(`👤 User role check: isBuyer=${isBuyer}, isSeller=${isSeller}`);

    if (!isBuyer && !isSeller) {
      console.log(`❌ User not authorized for transaction: ${transactionId}`);
      return res.json({
        success: true,
        data: { canRate: false, reason: 'Not part of transaction' }
      });
    }

    // Check if transaction is ready for rating
    // Note: 'paid' is included as a temporary fix - it should be 'funds_held' according to the escrow model
    const validStatuses = ['completed', 'funds_held', 'paid', 'processing', 'payment_processing', 'pending_payment'];
    if (!validStatuses.includes(transaction.status)) {
      console.log(`⚠️ Transaction not ready for rating. Status: ${transaction.status}`);
      return res.json({
        success: true,
        data: { canRate: false, reason: 'Transaction payment not processed' }
      });
    }

    const ratingType = isBuyer ? 'buyer_to_seller' : 'seller_to_buyer';

    // Check for existing rating based on transaction type
    const ratingQuery = {
      ratedBy: userObjectId,
      ratingType: ratingType
    };

    if (transactionType === 'escrow') {
      ratingQuery.escrowTransaction = transaction._id;
    } else {
      ratingQuery.standardPayment = transaction._id;
    }

    const existingRating = await Rating.findOne(ratingQuery);

    if (existingRating) {
      console.log(`⚠️ Rating already exists for transaction: ${transactionId}`);
      return res.json({
        success: true,
        data: { canRate: false, reason: 'Already rated' }
      });
    }

    console.log(`✅ User can rate transaction: ${transactionId} (type: ${ratingType})`);

    res.json({
      success: true,
      data: {
        canRate: true,
        ratingType,
        userRole: isBuyer ? 'buyer' : 'seller',
        transactionType
      }
    });

  } catch (error) {
    console.error('❌ Error checking rating eligibility:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check rating eligibility'
    });
  }
};

/**
 * Test endpoint to debug user ID issues
 */
exports.debugUserIds = async (req, res) => {
  try {
    const userId = req.user.id; // UUID
    const userObjectId = req.user._id; // MongoDB ObjectId

    console.log(`🧪 Debug User IDs:`);
    console.log(`  - UUID (req.user.id): ${userId}`);
    console.log(`  - ObjectId (req.user._id): ${userObjectId}`);
    console.log(`  - User object:`, req.user);

    res.json({
      success: true,
      data: {
        userId: userId,
        userObjectId: userObjectId.toString(),
        userType: typeof userId,
        objectIdType: typeof userObjectId,
        isValidObjectId: userObjectId.toString().match(/^[0-9a-fA-F]{24}$/) ? true : false
      }
    });

  } catch (error) {
    console.error('❌ Error in debug endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Debug failed'
    });
  }
};
