const express = require('express');
const router = express.Router();
const { verifyAdminToken, checkPermission } = require('../../auth/middleware/adminAuthMiddleware');
const adminNotificationController = require('../controllers/adminNotificationController');

// Apply admin authentication to all routes
router.use(verifyAdminToken);

// Get all notifications with filters and pagination
router.get('/', 
    checkPermission('notifications', 'read'),
    adminNotificationController.getAllNotifications
);

// Get notification statistics
router.get('/stats', 
    checkPermission('notifications', 'read'),
    adminNotificationController.getNotificationStats
);

// Get notification analytics
router.get('/analytics', 
    checkPermission('notifications', 'read'),
    adminNotificationController.getNotificationAnalytics
);

// Get notifications by type
router.get('/type/:type', 
    checkPermission('notifications', 'read'),
    adminNotificationController.getNotificationsByType
);

// Send bulk notifications
router.post('/bulk-send', 
    checkPermission('notifications', 'create'),
    adminNotificationController.sendBulkNotification
);

// Get specific notification by ID
router.get('/:notificationId', 
    checkPermission('notifications', 'read'),
    adminNotificationController.getNotificationById
);

// Delete notification
router.delete('/:notificationId', 
    checkPermission('notifications', 'delete'),
    adminNotificationController.deleteNotification
);

// Mark notification as read
router.patch('/:notificationId/read', 
    checkPermission('notifications', 'update'),
    adminNotificationController.markNotificationAsRead
);

// User-specific notification routes
// Get notifications for a specific user
router.get('/user/:userId', 
    checkPermission('notifications', 'read'),
    adminNotificationController.getUserNotifications
);

// Get user notification settings
router.get('/user/:userId/settings', 
    checkPermission('notifications', 'read'),
    adminNotificationController.getUserNotificationSettings
);

// Update user notification settings
router.put('/user/:userId/settings', 
    checkPermission('notifications', 'update'),
    adminNotificationController.updateUserNotificationSettings
);

// Send notification to specific user
router.post('/user/:userId/send', 
    checkPermission('notifications', 'create'),
    adminNotificationController.sendNotificationToUser
);

module.exports = router;
