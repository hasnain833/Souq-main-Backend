const express = require('express');
const router = express.Router();
const verifyToken = require('../../../../utils/verifyToken');
const notificationController = require('../controllers/notificationController');

// All notification routes require authentication
router.use(verifyToken);

// Get user notifications with pagination and filters
router.get('/', notificationController.getNotifications);

// Get unread notifications count
router.get('/unread-count', notificationController.getUnreadCount);

// Mark specific notification as read
router.patch('/:notificationId/read', notificationController.markAsRead);

// Mark all notifications as read
router.patch('/mark-all-read', notificationController.markAllAsRead);

// Delete specific notification
router.delete('/:notificationId', notificationController.deleteNotification);

// Delete multiple notifications
router.delete('/bulk/delete', notificationController.deleteMultipleNotifications);

// Delete all notifications
router.delete('/bulk/delete-all', notificationController.deleteAllNotifications);

// Get notification settings
router.get('/settings', notificationController.getNotificationSettings);

// Update notification settings
router.put('/settings', notificationController.updateNotificationSettings);

// Test notification endpoint (for debugging)
router.post('/test', notificationController.testNotification);

module.exports = router;
