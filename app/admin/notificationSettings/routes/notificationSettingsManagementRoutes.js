const express = require('express');
const router = express.Router();
const notificationSettingsManagementController = require('../controllers/notificationSettingsManagementController');
const { verifyAdminToken, checkPermission } = require('../../auth/middleware/adminAuthMiddleware');

// All routes require admin authentication
router.use(verifyAdminToken);
router.get('/', checkPermission('notificationSettings', 'view'), notificationSettingsManagementController.getAllNotificationSettings);
router.get('/stats', checkPermission('notificationSettings', 'view'), notificationSettingsManagementController.getNotificationSettingsStats);
router.post('/bulk', checkPermission('notificationSettings', 'edit'), notificationSettingsManagementController.bulkOperations);
router.get('/:settingsId', checkPermission('notificationSettings', 'view'), notificationSettingsManagementController.getNotificationSettingsById);
router.put('/:settingsId', checkPermission('notificationSettings', 'edit'), notificationSettingsManagementController.updateNotificationSettings);
router.delete('/:settingsId', checkPermission('notificationSettings', 'delete'), notificationSettingsManagementController.deleteNotificationSettings);

module.exports = router;
