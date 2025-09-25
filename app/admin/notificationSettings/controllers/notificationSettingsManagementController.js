const NotificationSettings = require('../../../../db/models/notificationSettingsModel');
const User = require('../../../../db/models/userModel');
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');

// Get all notification settings with pagination and filters
exports.getAllNotificationSettings = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      emailEnabled,
      dailyLimit,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    const query = {};

    // Apply filters
    if (emailEnabled !== undefined && emailEnabled !== '') query.emailEnabled = emailEnabled === 'true';
    if (dailyLimit !== undefined && dailyLimit !== '') query.dailyLimit = parseInt(dailyLimit);

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get notification settings with user population
    let notificationSettings = await NotificationSettings.find(query)
      .populate('user', 'userName firstName lastName email profile')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Apply search filter after population if needed
    if (search) {
      notificationSettings = notificationSettings.filter(setting => 
        setting.user?.userName?.toLowerCase().includes(search.toLowerCase()) ||
        setting.user?.firstName?.toLowerCase().includes(search.toLowerCase()) ||
        setting.user?.lastName?.toLowerCase().includes(search.toLowerCase()) ||
        setting.user?.email?.toLowerCase().includes(search.toLowerCase())
      );
    }

    const total = await NotificationSettings.countDocuments(query);

    // Get statistics
    const stats = await NotificationSettings.aggregate([
      {
        $group: {
          _id: null,
          totalSettings: { $sum: 1 },
          emailEnabledCount: { $sum: { $cond: ['$emailEnabled', 1, 0] } },
          quietHoursEnabledCount: { $sum: { $cond: ['$quietHours.enabled', 1, 0] } }
        }
      }
    ]);

    const dailyLimitStats = await NotificationSettings.aggregate([
      {
        $group: {
          _id: '$dailyLimit',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const statistics = {
      totalSettings: stats[0]?.totalSettings || 0,
      emailEnabledCount: stats[0]?.emailEnabledCount || 0,
      quietHoursEnabledCount: stats[0]?.quietHoursEnabledCount || 0,
      dailyLimitDistribution: dailyLimitStats
    };

    return successResponse(res, 'Notification settings retrieved successfully', {
      notificationSettings,
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
    console.error('Get notification settings error:', error);
    return errorResponse(res, 'Failed to retrieve notification settings', 500);
  }
};

// Get notification settings by ID
exports.getNotificationSettingsById = async (req, res) => {
  try {
    const { settingsId } = req.params;

    const notificationSettings = await NotificationSettings.findById(settingsId)
      .populate('user', 'userName firstName lastName email profile');

    if (!notificationSettings) {
      return errorResponse(res, 'Notification settings not found', 404);
    }

    return successResponse(res, 'Notification settings retrieved successfully', { notificationSettings });

  } catch (error) {
    console.error('Get notification settings by ID error:', error);
    return errorResponse(res, 'Failed to retrieve notification settings', 500);
  }
};

// Update notification settings
exports.updateNotificationSettings = async (req, res) => {
  try {
    const { settingsId } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData.user;
    delete updateData._id;
    delete updateData.__v;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    const notificationSettings = await NotificationSettings.findByIdAndUpdate(
      settingsId,
      updateData,
      { new: true, runValidators: true }
    ).populate('user', 'userName firstName lastName email profile');

    if (!notificationSettings) {
      return errorResponse(res, 'Notification settings not found', 404);
    }

    return successResponse(res, 'Notification settings updated successfully', { notificationSettings });

  } catch (error) {
    console.error('Update notification settings error:', error);
    return errorResponse(res, 'Failed to update notification settings', 500);
  }
};

// Delete notification settings
exports.deleteNotificationSettings = async (req, res) => {
  try {
    const { settingsId } = req.params;

    const notificationSettings = await NotificationSettings.findByIdAndDelete(settingsId);

    if (!notificationSettings) {
      return errorResponse(res, 'Notification settings not found', 404);
    }

    return successResponse(res, 'Notification settings deleted successfully', { notificationSettings });

  } catch (error) {
    console.error('Delete notification settings error:', error);
    return errorResponse(res, 'Failed to delete notification settings', 500);
  }
};

// Get notification settings statistics
exports.getNotificationSettingsStats = async (req, res) => {
  try {
    const stats = await NotificationSettings.aggregate([
      {
        $group: {
          _id: null,
          totalSettings: { $sum: 1 },
          emailEnabledCount: { $sum: { $cond: ['$emailEnabled', 1, 0] } },
          quietHoursEnabledCount: { $sum: { $cond: ['$quietHours.enabled', 1, 0] } },
          inAppEnabledCount: { $sum: { $cond: ['$deliveryPreferences.inApp', 1, 0] } },
          pushEnabledCount: { $sum: { $cond: ['$deliveryPreferences.push', 1, 0] } }
        }
      }
    ]);

    const dailyLimitStats = await NotificationSettings.aggregate([
      {
        $group: {
          _id: '$dailyLimit',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const notificationTypeStats = await NotificationSettings.aggregate([
      {
        $project: {
          highPriorityEnabled: {
            $add: [
              { $cond: ['$highPriority.newMessages', 1, 0] },
              { $cond: ['$highPriority.newFeedback', 1, 0] },
              { $cond: ['$highPriority.discountedItems', 1, 0] }
            ]
          },
          otherEnabled: {
            $add: [
              { $cond: ['$other.favoritedItems', 1, 0] },
              { $cond: ['$other.newFollowers', 1, 0] },
              { $cond: ['$other.newProducts', 1, 0] }
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgHighPriorityEnabled: { $avg: '$highPriorityEnabled' },
          avgOtherEnabled: { $avg: '$otherEnabled' }
        }
      }
    ]);

    const statistics = {
      overview: stats[0] || {
        totalSettings: 0,
        emailEnabledCount: 0,
        quietHoursEnabledCount: 0,
        inAppEnabledCount: 0,
        pushEnabledCount: 0
      },
      dailyLimitDistribution: dailyLimitStats,
      notificationTypeStats: notificationTypeStats[0] || {
        avgHighPriorityEnabled: 0,
        avgOtherEnabled: 0
      }
    };

    return successResponse(res, 'Notification settings statistics retrieved successfully', statistics);

  } catch (error) {
    console.error('Get notification settings stats error:', error);
    return errorResponse(res, 'Failed to retrieve notification settings statistics', 500);
  }
};

// Bulk operations
exports.bulkOperations = async (req, res) => {
  try {
    const { operation, settingsIds, updateData } = req.body;

    if (!operation || !settingsIds || !Array.isArray(settingsIds)) {
      return errorResponse(res, 'Invalid bulk operation parameters', 400);
    }

    let result;

    switch (operation) {
      case 'enableEmail':
        result = await NotificationSettings.updateMany(
          { _id: { $in: settingsIds } },
          { $set: { emailEnabled: true } }
        );
        break;

      case 'disableEmail':
        result = await NotificationSettings.updateMany(
          { _id: { $in: settingsIds } },
          { $set: { emailEnabled: false } }
        );
        break;

      case 'delete':
        result = await NotificationSettings.deleteMany({ _id: { $in: settingsIds } });
        break;

      case 'update':
        if (!updateData) {
          return errorResponse(res, 'Update data is required for bulk update', 400);
        }
        result = await NotificationSettings.updateMany(
          { _id: { $in: settingsIds } },
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
