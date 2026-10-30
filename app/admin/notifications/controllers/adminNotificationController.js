const Notification = require('../../../../db/models/notificationModel');
const NotificationSettings = require('../../../../db/models/notificationSettingsModel');
const User = require('../../../../db/models/userModel');
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');
// No need for external createNotification import - using model directly

// Get all notifications with filters and pagination
exports.getAllNotifications = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            type,
            priority,
            isRead,
            userId,
            startDate,
            endDate,
            search
        } = req.query;

        const skip = (page - 1) * limit;
        const query = {};

        // Apply filters
        if (type) query.type = type;
        if (priority) query.priority = priority;
        if (isRead !== undefined) {
            // Convert isRead to status field
            query.status = isRead === 'true' ? 'read' : 'unread';
        }
        if (userId) query.recipient = userId;

        // Date range filter
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        // Search in title and message
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { message: { $regex: search, $options: 'i' } }
            ];
        }

        const notifications = await Notification.find(query)
            .populate('recipient', 'firstName lastName email userName profile')
            .populate('sender', 'firstName lastName email userName profile')
            .populate('relatedData.product', 'title product_photos price')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Notification.countDocuments(query);

        return successResponse(res, 'Notifications retrieved successfully', {
            notifications,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalNotifications: total,
                hasNext: page * limit < total,
                hasPrev: page > 1
            }
        });
    } catch (error) {
        console.error('Error getting all notifications:', error);
        return errorResponse(res, 'Failed to retrieve notifications', 500, error.message);
    }
};

// Get notification by ID
exports.getNotificationById = async (req, res) => {
    try {
        const { notificationId } = req.params;

        const notification = await Notification.findById(notificationId)
            .populate('recipient', 'firstName lastName email userName profile')
            .populate('sender', 'firstName lastName email userName profile')
            .populate('relatedData.product', 'title product_photos price');

        if (!notification) {
            return errorResponse(res, 'Notification not found', 404);
        }

        return successResponse(res, 'Notification retrieved successfully', { notification });
    } catch (error) {
        console.error('Error getting notification by ID:', error);
        return errorResponse(res, 'Failed to retrieve notification', 500, error.message);
    }
};

// Get notification statistics
exports.getNotificationStats = async (req, res) => {
    try {
        const totalNotifications = await Notification.countDocuments();
        const unreadNotifications = await Notification.countDocuments({ status: 'unread' });
        const readNotifications = await Notification.countDocuments({ status: 'read' });

        // Notifications by type
        const notificationsByType = await Notification.aggregate([
            { $group: { _id: '$type', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        // Notifications by priority
        const notificationsByPriority = await Notification.aggregate([
            { $group: { _id: '$priority', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        // Recent activity (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const recentNotifications = await Notification.countDocuments({
            createdAt: { $gte: sevenDaysAgo }
        });

        // Daily notification counts for the last 7 days
        const dailyStats = await Notification.aggregate([
            {
                $match: {
                    createdAt: { $gte: sevenDaysAgo }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                        day: { $dayOfMonth: '$createdAt' }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ]);

        return successResponse(res, 'Notification statistics retrieved successfully', {
            totalNotifications,
            unreadNotifications,
            readNotifications,
            readPercentage: totalNotifications > 0 ? ((readNotifications / totalNotifications) * 100).toFixed(2) : 0,
            notificationsByType,
            notificationsByPriority,
            recentNotifications,
            dailyStats
        });
    } catch (error) {
        console.error('Error getting notification stats:', error);
        return errorResponse(res, 'Failed to retrieve notification statistics', 500, error.message);
    }
};

// Get notifications for a specific user
exports.getUserNotifications = async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 20, type, isRead } = req.query;

        const skip = (page - 1) * limit;
        const query = { recipient: userId };

        if (type) query.type = type;
        if (isRead !== undefined) query.status = isRead === 'true' ? 'read' : 'unread';

        const notifications = await Notification.find(query)
            .populate('sender', 'firstName lastName email userName profile')
            .populate('relatedData.product', 'title product_photos price')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Notification.countDocuments(query);

        return successResponse(res, 'User notifications retrieved successfully', {
            notifications,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalNotifications: total,
                hasNext: page * limit < total,
                hasPrev: page > 1
            }
        });
    } catch (error) {
        console.error('Error getting user notifications:', error);
        return errorResponse(res, 'Failed to retrieve user notifications', 500, error.message);
    }
};

// Get user notification settings
exports.getUserNotificationSettings = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId);
        if (!user) {
            return errorResponse(res, 'User not found', 404);
        }

        const settings = await NotificationSettings.findOne({ user: userId });

        return successResponse(res, 'User notification settings retrieved successfully', {
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                userName: user.userName
            },
            settings: settings || null
        });
    } catch (error) {
        console.error('Error getting user notification settings:', error);
        return errorResponse(res, 'Failed to retrieve user notification settings', 500, error.message);
    }
};

// Update user notification settings
exports.updateUserNotificationSettings = async (req, res) => {
    try {
        const { userId } = req.params;
        const settingsData = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return errorResponse(res, 'User not found', 404);
        }

        const settings = await NotificationSettings.findOneAndUpdate(
            { user: userId },
            { ...settingsData, user: userId },
            { new: true, upsert: true }
        );

        return successResponse(res, 'User notification settings updated successfully', { settings });
    } catch (error) {
        console.error('Error updating user notification settings:', error);
        return errorResponse(res, 'Failed to update user notification settings', 500, error.message);
    }
};

// Send notification to specific user
exports.sendNotificationToUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { title, message, type = 'admin', priority = 'normal', data = {} } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return errorResponse(res, 'User not found', 404);
        }

        // Create notification
        const notification = await Notification.createNotification({
            recipient: userId,
            sender: req.admin._id,
            title,
            message,
            type,
            priority,
            relatedData: data
        });

        return successResponse(res, 'Notification sent successfully', { notification });
    } catch (error) {
        console.error('Error sending notification to user:', error);
        return errorResponse(res, 'Failed to send notification', 500, error.message);
    }
};

// Send bulk notifications
exports.sendBulkNotification = async (req, res) => {
    try {
        const { 
            title, 
            message, 
            type = 'admin', 
            priority = 'normal', 
            data = {},
            userIds = [],
            userFilters = {}
        } = req.body;

        let targetUsers = [];

        if (userIds.length > 0) {
            // Send to specific users
            targetUsers = await User.find({ _id: { $in: userIds } }).select('_id');
        } else {
            // Send to users based on filters
            const query = {};

            // Check for active users (not deleted)
            if (userFilters.isActive !== undefined) {
                if (userFilters.isActive) {
                    // Active users have deletedAt = null
                    query.deletedAt = null;
                } else {
                    // Inactive users have deletedAt != null
                    query.deletedAt = { $ne: null };
                }
            }

            if (userFilters.emailVerified !== undefined) query.emailVerifiedAt = userFilters.emailVerified ? { $ne: null } : null;
            if (userFilters.createdAfter) query.createdAt = { $gte: new Date(userFilters.createdAfter) };
            if (userFilters.createdBefore) query.createdAt = { ...query.createdAt, $lte: new Date(userFilters.createdBefore) };

            // If no filters are applied, get all users
            if (Object.keys(query).length === 0) {
                query.deletedAt = null; // Default to active users
            }

            targetUsers = await User.find(query).select('_id');

            // Debug logging
            console.log('Query used:', JSON.stringify(query));
            console.log('Found users:', targetUsers.length);
        }

        if (targetUsers.length === 0) {
            // Check total users in database for debugging
            const totalUsers = await User.countDocuments();
            console.log('Total users in database:', totalUsers);

            return errorResponse(res, `No users found matching the criteria. Total users in database: ${totalUsers}`, 400);
        }

        // Create notifications for all target users
        const notifications = await Promise.all(
            targetUsers.map(user =>
                Notification.createNotification({
                    recipient: user._id,
                    sender: req.admin._id,
                    title,
                    message,
                    type,
                    priority,
                    relatedData: data
                })
            )
        );

        return successResponse(res, 'Bulk notifications sent successfully', {
            sentCount: notifications.length,
            targetUsers: targetUsers.length
        });
    } catch (error) {
        console.error('Error sending bulk notifications:', error);
        return errorResponse(res, 'Failed to send bulk notifications', 500, error.message);
    }
};

// Delete notification
exports.deleteNotification = async (req, res) => {
    try {
        const { notificationId } = req.params;

        const notification = await Notification.findByIdAndDelete(notificationId);
        if (!notification) {
            return errorResponse(res, 'Notification not found', 404);
        }

        return successResponse(res, 'Notification deleted successfully');
    } catch (error) {
        console.error('Error deleting notification:', error);
        return errorResponse(res, 'Failed to delete notification', 500, error.message);
    }
};

// Mark notification as read
exports.markNotificationAsRead = async (req, res) => {
    try {
        const { notificationId } = req.params;

        const notification = await Notification.findByIdAndUpdate(
            notificationId,
            { status: 'read', readAt: new Date() },
            { new: true }
        );

        if (!notification) {
            return errorResponse(res, 'Notification not found', 404);
        }

        return successResponse(res, 'Notification marked as read', { notification });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        return errorResponse(res, 'Failed to mark notification as read', 500, error.message);
    }
};

// Get notifications by type
exports.getNotificationsByType = async (req, res) => {
    try {
        const { type } = req.params;
        const { page = 1, limit = 20 } = req.query;

        const skip = (page - 1) * limit;

        const notifications = await Notification.find({ type })
            .populate('recipient', 'firstName lastName email userName profile')
            .populate('sender', 'firstName lastName email userName profile')
            .populate('relatedData.product', 'title product_photos price')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Notification.countDocuments({ type });

        return successResponse(res, `${type} notifications retrieved successfully`, {
            notifications,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalNotifications: total,
                hasNext: page * limit < total,
                hasPrev: page > 1
            }
        });
    } catch (error) {
        console.error('Error getting notifications by type:', error);
        return errorResponse(res, 'Failed to retrieve notifications by type', 500, error.message);
    }
};

// Get notification analytics
exports.getNotificationAnalytics = async (req, res) => {
    try {
        const { startDate, endDate, groupBy = 'day' } = req.query;

        const matchQuery = {};
        if (startDate || endDate) {
            matchQuery.createdAt = {};
            if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
            if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
        }

        // Group by configuration
        let groupByConfig;
        switch (groupBy) {
            case 'hour':
                groupByConfig = {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' },
                    day: { $dayOfMonth: '$createdAt' },
                    hour: { $hour: '$createdAt' }
                };
                break;
            case 'day':
                groupByConfig = {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' },
                    day: { $dayOfMonth: '$createdAt' }
                };
                break;
            case 'month':
                groupByConfig = {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' }
                };
                break;
            default:
                groupByConfig = {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' },
                    day: { $dayOfMonth: '$createdAt' }
                };
        }

        const analytics = await Notification.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: groupByConfig,
                    total: { $sum: 1 },
                    read: { $sum: { $cond: ['$isRead', 1, 0] } },
                    unread: { $sum: { $cond: ['$isRead', 0, 1] } },
                    byType: {
                        $push: '$type'
                    },
                    byPriority: {
                        $push: '$priority'
                    }
                }
            },
            {
                $addFields: {
                    readRate: {
                        $multiply: [
                            { $divide: ['$read', '$total'] },
                            100
                        ]
                    }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } }
        ]);

        return successResponse(res, 'Notification analytics retrieved successfully', { analytics });
    } catch (error) {
        console.error('Error getting notification analytics:', error);
        return errorResponse(res, 'Failed to retrieve notification analytics', 500, error.message);
    }
};
