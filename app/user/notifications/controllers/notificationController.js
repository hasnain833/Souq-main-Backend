const Notification = require('../../../../db/models/notificationModel');
const NotificationSettings = require('../../../../db/models/notificationSettingsModel');
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');

// Get socket.io instance (will be set by the main app)
let io = null;
const setSocketIO = (socketInstance) => {
  io = socketInstance;
};

const getSocketIO = () => io;

// Get user notifications with pagination
const getNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20, status, type } = req.query;
    
    // Build query
    const query = { recipient: userId };
    if (status) query.status = status;
    if (type) query.type = type;
    
    // Get notifications with pagination
    const notifications = await Notification.find(query)
      .populate('sender', 'firstName lastName profile')
      .populate('relatedData.product', 'title product_photos price')
      .populate('relatedData.order', 'orderNumber status')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    // Get total count
    const total = await Notification.countDocuments(query);
    
    // Get unread count
    const unreadCount = await Notification.getUnreadCount(userId);
    
    return successResponse(res, 'Notifications retrieved successfully', {
      notifications,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalNotifications: total,
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
      },
      unreadCount
    });
    
  } catch (error) {
    console.error('Get notifications error:', error);
    return errorResponse(res, 'Failed to retrieve notifications', 500);
  }
};

// Get unread notifications count
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id;
    const unreadCount = await Notification.getUnreadCount(userId);
    
    return successResponse(res, 'Unread count retrieved successfully', {
      unreadCount
    });
    
  } catch (error) {
    console.error('Get unread count error:', error);
    return errorResponse(res, 'Failed to retrieve unread count', 500);
  }
};

// Mark notification as read
const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user._id;
    
    const notification = await Notification.findOne({
      _id: notificationId,
      recipient: userId
    });
    
    if (!notification) {
      return errorResponse(res, 'Notification not found', 404);
    }
    
    await notification.markAsRead();
    
    // Emit updated unread count
    if (io) {
      const unreadCount = await Notification.getUnreadCount(userId);
      io.to(`user_${userId}`).emit('unread_count_updated', { unreadCount });
    }
    
    return successResponse(res, 'Notification marked as read', {
      notification
    });
    
  } catch (error) {
    console.error('Mark as read error:', error);
    return errorResponse(res, 'Failed to mark notification as read', 500);
  }
};

// Mark all notifications as read
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    
    await Notification.markAllAsRead(userId);
    
    // Emit updated unread count
    if (io) {
      io.to(`user_${userId}`).emit('unread_count_updated', { unreadCount: 0 });
    }
    
    return successResponse(res, 'All notifications marked as read');
    
  } catch (error) {
    console.error('Mark all as read error:', error);
    return errorResponse(res, 'Failed to mark all notifications as read', 500);
  }
};

// Delete notification
const deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user._id;

    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      recipient: userId
    });

    if (!notification) {
      return errorResponse(res, 'Notification not found', 404);
    }

    // Emit real-time notification deletion event
    if (io) {
      io.to(`user_${userId}`).emit('notification_deleted', { notificationId });

      // Also emit updated unread count if deleted notification was unread
      if (notification.status === 'unread') {
        const unreadCount = await Notification.getUnreadCount(userId);
        io.to(`user_${userId}`).emit('unread_count_updated', { unreadCount });
      }
    }

    return successResponse(res, 'Notification deleted successfully');

  } catch (error) {
    console.error('Delete notification error:', error);
    return errorResponse(res, 'Failed to delete notification', 500);
  }
};

// Delete multiple notifications
const deleteMultipleNotifications = async (req, res) => {
  try {
    const { notificationIds } = req.body;
    const userId = req.user._id;

    // Validate input
    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      return errorResponse(res, 'Please provide an array of notification IDs', 400);
    }

    // Check if user is trying to delete too many at once (prevent abuse)
    if (notificationIds.length > 100) {
      return errorResponse(res, 'Cannot delete more than 100 notifications at once', 400);
    }

    // Find notifications to be deleted (to check unread count)
    const notificationsToDelete = await Notification.find({
      _id: { $in: notificationIds },
      recipient: userId
    });

    if (notificationsToDelete.length === 0) {
      return errorResponse(res, 'No notifications found to delete', 404);
    }

    // Count unread notifications that will be deleted
    const unreadToDelete = notificationsToDelete.filter(n => n.status === 'unread').length;

    // Delete the notifications
    const deleteResult = await Notification.deleteMany({
      _id: { $in: notificationIds },
      recipient: userId
    });

    // Emit real-time notification deletion events
    if (io) {
      // Emit bulk deletion event
      io.to(`user_${userId}`).emit('notifications_bulk_deleted', { 
        notificationIds: notificationsToDelete.map(n => n._id.toString()),
        deletedCount: deleteResult.deletedCount
      });

      // Update unread count if any unread notifications were deleted
      if (unreadToDelete > 0) {
        const unreadCount = await Notification.getUnreadCount(userId);
        io.to(`user_${userId}`).emit('unread_count_updated', { unreadCount });
      }
    }

    return successResponse(res, `Successfully deleted ${deleteResult.deletedCount} notifications`, {
      deletedCount: deleteResult.deletedCount,
      unreadDeleted: unreadToDelete
    });

  } catch (error) {
    console.error('Delete multiple notifications error:', error);
    return errorResponse(res, 'Failed to delete notifications', 500);
  }
};

// Delete all notifications
const deleteAllNotifications = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get count of unread notifications before deletion
    const unreadCount = await Notification.getUnreadCount(userId);
    
    // Delete all notifications for the user
    const deleteResult = await Notification.deleteMany({
      recipient: userId
    });

    // Emit real-time notification deletion event
    if (io) {
      io.to(`user_${userId}`).emit('notifications_all_deleted', { 
        deletedCount: deleteResult.deletedCount 
      });

      // Update unread count to 0
      io.to(`user_${userId}`).emit('unread_count_updated', { unreadCount: 0 });
    }

    return successResponse(res, `Successfully deleted all ${deleteResult.deletedCount} notifications`, {
      deletedCount: deleteResult.deletedCount,
      unreadDeleted: unreadCount
    });

  } catch (error) {
    console.error('Delete all notifications error:', error);
    return errorResponse(res, 'Failed to delete all notifications', 500);
  }
};

// Get notification settings
const getNotificationSettings = async (req, res) => {
  try {
    const userId = req.user._id;
    const settings = await NotificationSettings.getOrCreateSettings(userId);
    
    return successResponse(res, 'Notification settings retrieved successfully', {
      settings
    });
    
  } catch (error) {
    console.error('Get notification settings error:', error);
    return errorResponse(res, 'Failed to retrieve notification settings', 500);
  }
};

// Update notification settings
const updateNotificationSettings = async (req, res) => {
  try {
    const userId = req.user._id;
    const updateData = req.body;
    
    const settings = await NotificationSettings.findOneAndUpdate(
      { user: userId },
      updateData,
      { new: true, upsert: true }
    );
    
    return successResponse(res, 'Notification settings updated successfully', {
      settings
    });
    
  } catch (error) {
    console.error('Update notification settings error:', error);
    return errorResponse(res, 'Failed to update notification settings', 500);
  }
};

// Create notification (internal function)
const createNotification = async (notificationData) => {
  try {
    // Check user's notification settings
    const settings = await NotificationSettings.getOrCreateSettings(notificationData.recipient);
    
    // Check if this type of notification is enabled
    if (!settings.isNotificationEnabled(notificationData.type)) {
      console.log(`Notification type ${notificationData.type} is disabled for user ${notificationData.recipient}`);
      return null;
    }
    
    // Check quiet hours
    if (settings.isInQuietHours()) {
      console.log(`User ${notificationData.recipient} is in quiet hours, skipping notification`);
      return null;
    }
    
    // Create the notification
    const notification = await Notification.createNotification(notificationData);
    
    // Emit real-time notification if socket is available
    if (io) {
      io.to(`user_${notificationData.recipient}`).emit('new_notification', notification);
      
      // Also emit updated unread count
      const unreadCount = await Notification.getUnreadCount(notificationData.recipient);
      io.to(`user_${notificationData.recipient}`).emit('unread_count_updated', { unreadCount });
    }
    
    return notification;
    
  } catch (error) {
    console.error('Create notification error:', error);
    throw error;
  }
};

// Test notification endpoint (for debugging)
const testNotification = async (req, res) => {
  try {
    const userId = req.user._id;

    // Create a test notification
    const notification = await createNotification({
      recipient: userId,
      sender: userId, // Self-notification for testing
      type: 'system',
      title: 'Test Notification',
      message: 'This is a test notification to verify the notification system is working.',
      priority: 'high',
      relatedData: {
        metadata: {
          test: true,
          timestamp: new Date().toISOString()
        }
      }
    });

    return successResponse(res, 'Test notification sent successfully', { notification });
  } catch (error) {
    console.error('Error sending test notification:', error);
    return errorResponse(res, 'Failed to send test notification', 500);
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteMultipleNotifications,
  deleteAllNotifications,
  getNotificationSettings,
  updateNotificationSettings,
  createNotification,
  setSocketIO,
  getSocketIO,
  testNotification
};
