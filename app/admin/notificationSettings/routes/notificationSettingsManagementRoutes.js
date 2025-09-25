const express = require('express');
const router = express.Router();
const notificationSettingsManagementController = require('../controllers/notificationSettingsManagementController');
const { verifyAdminToken, checkPermission } = require('../../auth/middleware/adminAuthMiddleware');

// All routes require admin authentication
router.use(verifyAdminToken);

// Get all notification settings with pagination and filters
router.get('/', checkPermission('notificationSettings', 'view'), notificationSettingsManagementController.getAllNotificationSettings);

// Get notification settings statistics
router.get('/stats', checkPermission('notificationSettings', 'view'), notificationSettingsManagementController.getNotificationSettingsStats);

// Bulk operations on notification settings
router.post('/bulk', checkPermission('notificationSettings', 'edit'), notificationSettingsManagementController.bulkOperations);

// Get notification settings by ID
router.get('/:settingsId', checkPermission('notificationSettings', 'view'), notificationSettingsManagementController.getNotificationSettingsById);

// Update notification settings
router.put('/:settingsId', checkPermission('notificationSettings', 'edit'), notificationSettingsManagementController.updateNotificationSettings);

// Delete notification settings
router.delete('/:settingsId', checkPermission('notificationSettings', 'delete'), notificationSettingsManagementController.deleteNotificationSettings);

module.exports = router;
