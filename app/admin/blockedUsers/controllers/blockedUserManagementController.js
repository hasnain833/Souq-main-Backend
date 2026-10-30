const BlockedUser = require('../../../../db/models/blockedUserModel');
const User = require('../../../../db/models/userModel');
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');

// Get all blocked users with pagination and filters
exports.getAllBlockedUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      reason,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    const query = {};

    // Apply filters
    if (reason && reason !== '') query.reason = reason;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get blocked users with population
    let blockedUsers = await BlockedUser.find(query)
      .populate('blocker', 'userName firstName lastName email profile')
      .populate('blocked', 'userName firstName lastName email profile')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Apply search filter after population if needed
    if (search) {
      blockedUsers = blockedUsers.filter(block => 
        block.blocker?.userName?.toLowerCase().includes(search.toLowerCase()) ||
        block.blocker?.firstName?.toLowerCase().includes(search.toLowerCase()) ||
        block.blocker?.lastName?.toLowerCase().includes(search.toLowerCase()) ||
        block.blocked?.userName?.toLowerCase().includes(search.toLowerCase()) ||
        block.blocked?.firstName?.toLowerCase().includes(search.toLowerCase()) ||
        block.blocked?.lastName?.toLowerCase().includes(search.toLowerCase()) ||
        block.notes?.toLowerCase().includes(search.toLowerCase())
      );
    }

    const total = await BlockedUser.countDocuments(query);

    // Get statistics
    const stats = await BlockedUser.aggregate([
      {
        $group: {
          _id: null,
          totalBlocks: { $sum: 1 }
        }
      }
    ]);

    const reasonStats = await BlockedUser.aggregate([
      {
        $group: {
          _id: '$reason',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const statistics = {
      totalBlocks: stats[0]?.totalBlocks || 0,
      reasonDistribution: reasonStats
    };

    return successResponse(res, 'Blocked users retrieved successfully', {
      blockedUsers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
      },
      statistics
    });

  } catch (error) {
    console.error('Get blocked users error:', error);
    return errorResponse(res, 'Failed to retrieve blocked users', 500);
  }
};

// Get blocked user by ID
exports.getBlockedUserById = async (req, res) => {
  try {
    const { blockId } = req.params;

    const blockedUser = await BlockedUser.findById(blockId)
      .populate('blocker', 'userName firstName lastName email profile')
      .populate('blocked', 'userName firstName lastName email profile');

    if (!blockedUser) {
      return errorResponse(res, 'Blocked user record not found', 404);
    }

    return successResponse(res, 'Blocked user retrieved successfully', { blockedUser });

  } catch (error) {
    console.error('Get blocked user by ID error:', error);
    return errorResponse(res, 'Failed to retrieve blocked user', 500);
  }
};

// Update blocked user record
exports.updateBlockedUser = async (req, res) => {
  try {
    const { blockId } = req.params;
    const { reason, notes } = req.body;

    const updateData = {};
    if (reason) updateData.reason = reason;
    if (notes !== undefined) updateData.notes = notes;

    const blockedUser = await BlockedUser.findByIdAndUpdate(
      blockId,
      updateData,
      { new: true, runValidators: true }
    ).populate('blocker', 'userName firstName lastName email profile')
     .populate('blocked', 'userName firstName lastName email profile');

    if (!blockedUser) {
      return errorResponse(res, 'Blocked user record not found', 404);
    }

    return successResponse(res, 'Blocked user record updated successfully', { blockedUser });

  } catch (error) {
    console.error('Update blocked user error:', error);
    return errorResponse(res, 'Failed to update blocked user record', 500);
  }
};

// Unblock user (delete blocked user record)
exports.unblockUser = async (req, res) => {
  try {
    const { blockId } = req.params;

    const blockedUser = await BlockedUser.findByIdAndDelete(blockId)
      .populate('blocker', 'userName firstName lastName email profile')
      .populate('blocked', 'userName firstName lastName email profile');

    if (!blockedUser) {
      return errorResponse(res, 'Blocked user record not found', 404);
    }

    return successResponse(res, 'User unblocked successfully', { blockedUser });

  } catch (error) {
    console.error('Unblock user error:', error);
    return errorResponse(res, 'Failed to unblock user', 500);
  }
};

// Get blocked user statistics
exports.getBlockedUserStats = async (req, res) => {
  try {
    const stats = await BlockedUser.aggregate([
      {
        $group: {
          _id: null,
          totalBlocks: { $sum: 1 }
        }
      }
    ]);

    const reasonStats = await BlockedUser.aggregate([
      {
        $group: {
          _id: '$reason',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const monthlyStats = await BlockedUser.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    const topBlockers = await BlockedUser.aggregate([
      {
        $group: {
          _id: '$blocker',
          blockCount: { $sum: 1 }
        }
      },
      { $sort: { blockCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          blockCount: 1,
          user: {
            userName: 1,
            firstName: 1,
            lastName: 1,
            email: 1
          }
        }
      }
    ]);

    const statistics = {
      totalBlocks: stats[0]?.totalBlocks || 0,
      reasonDistribution: reasonStats,
      monthlyTrend: monthlyStats,
      topBlockers
    };

    return successResponse(res, 'Blocked user statistics retrieved successfully', statistics);

  } catch (error) {
    console.error('Get blocked user stats error:', error);
    return errorResponse(res, 'Failed to retrieve blocked user statistics', 500);
  }
};

// Bulk operations
exports.bulkOperations = async (req, res) => {
  try {
    const { operation, blockIds, updateData } = req.body;

    if (!operation || !blockIds || !Array.isArray(blockIds)) {
      return errorResponse(res, 'Invalid bulk operation parameters', 400);
    }

    let result;

    switch (operation) {
      case 'unblock':
        result = await BlockedUser.deleteMany({ _id: { $in: blockIds } });
        break;

      case 'update':
        if (!updateData) {
          return errorResponse(res, 'Update data is required for bulk update', 400);
        }
        result = await BlockedUser.updateMany(
          { _id: { $in: blockIds } },
          { $set: updateData }
        );
        break;

      default:
        return errorResponse(res, 'Invalid bulk operation', 400);
    }

    return successResponse(res, `Bulk ${operation} completed successfully`, {
      modifiedCount: result.modifiedCount || result.deletedCount,
      operation
    });

  } catch (error) {
    console.error('Bulk operations error:', error);
    return errorResponse(res, 'Failed to perform bulk operation', 500);
  }
};
