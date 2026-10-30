const Rating = require('../../../../db/models/ratingModel');
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');

/**
 * Get all ratings with pagination and filters
 */
exports.getAllRatings = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      rating = '',
      ratingType = '',
      status = '',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      dateFrom = '',
      dateTo = ''
    } = req.query;

    const skip = (page - 1) * limit;
    const query = {};

    // Search filter (search in review text)
    if (search) {
      query.review = { $regex: search, $options: 'i' };
    }

    // Rating filter
    if (rating) {
      query.rating = parseInt(rating);
    }

    // Rating type filter
    if (ratingType) {
      query.ratingType = ratingType;
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // Date range filter
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    // Sort configuration
    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get ratings with populated data
    const ratings = await Rating.find(query)
      .populate('ratedBy', 'firstName lastName email username profile_picture')
      .populate('ratedUser', 'firstName lastName email username profile_picture')
      .populate('product', 'title price product_photos')
      .populate('standardPayment', 'transactionId')
      .populate('escrowTransaction', 'transactionId')
      .sort(sortConfig)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await Rating.countDocuments(query);

    // Calculate pagination
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return successResponse(res, 'Ratings retrieved successfully', {
      ratings,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalRatings: total,
        hasNext,
        hasPrev,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get all ratings error:', error);
    return errorResponse(res, 'Failed to retrieve ratings', 500);
  }
};

/**
 * Get rating statistics
 */
exports.getRatingStats = async (req, res) => {
  try {
    // Get total ratings
    const totalRatings = await Rating.countDocuments();

    // Get ratings by type
    const buyerToSellerRatings = await Rating.countDocuments({ ratingType: 'buyer_to_seller' });
    const sellerToBuyerRatings = await Rating.countDocuments({ ratingType: 'seller_to_buyer' });

    // Get ratings by status
    const statusStats = await Rating.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get average rating
    const averageRatingStats = await Rating.aggregate([
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalRatings: { $sum: 1 }
        }
      }
    ]);

    // Get rating distribution
    const ratingDistribution = await Rating.aggregate([
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);

    // Get recent ratings (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentRatings = await Rating.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    // Get monthly rating trends (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyTrends = await Rating.aggregate([
      {
        $match: {
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 },
          averageRating: { $avg: '$rating' }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    // Get moderated ratings count
    const moderatedRatings = await Rating.countDocuments({ isModerated: true });

    return successResponse(res, 'Rating statistics retrieved successfully', {
      totalRatings,
      ratingTypes: {
        buyerToSeller: buyerToSellerRatings,
        sellerToBuyer: sellerToBuyerRatings
      },
      statusBreakdown: statusStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {}),
      averageRating: averageRatingStats[0]?.averageRating || 0,
      ratingDistribution: ratingDistribution.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {}),
      recentRatings,
      moderatedRatings,
      monthlyTrends
    });

  } catch (error) {
    console.error('Get rating stats error:', error);
    return errorResponse(res, 'Failed to retrieve rating statistics', 500);
  }
};

/**
 * Get rating by ID
 */
exports.getRatingById = async (req, res) => {
  try {
    const { ratingId } = req.params;

    const rating = await Rating.findById(ratingId)
      .populate('ratedBy', 'firstName lastName email username profile_picture')
      .populate('ratedUser', 'firstName lastName email username profile_picture')
      .populate('product', 'title price product_photos description')
      .populate('standardPayment', 'transactionId')
      .populate('escrowTransaction', 'transactionId');

    if (!rating) {
      return errorResponse(res, 'Rating not found', 404);
    }

    return successResponse(res, 'Rating retrieved successfully', { rating });

  } catch (error) {
    console.error('Get rating by ID error:', error);
    return errorResponse(res, 'Failed to retrieve rating', 500);
  }
};

/**
 * Update rating status (moderate rating)
 */
exports.updateRatingStatus = async (req, res) => {
  try {
    const { ratingId } = req.params;
    const { status, moderationNotes } = req.body;

    // Validate ratingId
    if (!ratingId || ratingId === 'undefined' || ratingId === 'unknown') {
      return errorResponse(res, 'Invalid rating ID provided', 400);
    }

    // Validate ObjectId format
    if (!ratingId.match(/^[0-9a-fA-F]{24}$/)) {
      return errorResponse(res, 'Invalid rating ID format', 400);
    }

    const validStatuses = ['pending', 'submitted', 'published', 'hidden'];

    if (!validStatuses.includes(status)) {
      return errorResponse(res, 'Invalid rating status', 400);
    }

    const rating = await Rating.findById(ratingId);
    if (!rating) {
      return errorResponse(res, 'Rating not found', 404);
    }

    // Update rating status
    rating.status = status;
    rating.isModerated = true;
    if (moderationNotes) {
      rating.moderationNotes = moderationNotes;
    }

    await rating.save();

    return successResponse(res, 'Rating status updated successfully', { rating });

  } catch (error) {
    console.error('Update rating status error:', error);
    return errorResponse(res, 'Failed to update rating status', 500);
  }
};

/**
 * Delete rating
 */
exports.deleteRating = async (req, res) => {
  try {
    const { ratingId } = req.params;

    // Validate ratingId
    if (!ratingId || ratingId === 'undefined' || ratingId === 'unknown') {
      return errorResponse(res, 'Invalid rating ID provided', 400);
    }

    // Validate ObjectId format
    if (!ratingId.match(/^[0-9a-fA-F]{24}$/)) {
      return errorResponse(res, 'Invalid rating ID format', 400);
    }

    const rating = await Rating.findById(ratingId);
    if (!rating) {
      return errorResponse(res, 'Rating not found', 404);
    }

    await Rating.findByIdAndDelete(ratingId);

    return successResponse(res, 'Rating deleted successfully');

  } catch (error) {
    console.error('Delete rating error:', error);
    return errorResponse(res, 'Failed to delete rating', 500);
  }
};
