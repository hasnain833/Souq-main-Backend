const express = require('express');
const router = express.Router();
const blockedUserManagementController = require('../controllers/blockedUserManagementController');
const { verifyAdminToken, checkPermission } = require('../../auth/middleware/adminAuthMiddleware');

// All routes require admin authentication
router.use(verifyAdminToken);

// Get all blocked users with pagination and filters
router.get('/', checkPermission('blockedUsers', 'view'), blockedUserManagementController.getAllBlockedUsers);

// Get blocked user statistics
router.get('/stats', checkPermission('blockedUsers', 'view'), blockedUserManagementController.getBlockedUserStats);

// Bulk operations on blocked users
router.post('/bulk', checkPermission('blockedUsers', 'edit'), blockedUserManagementController.bulkOperations);

// Get blocked user by ID
router.get('/:blockId', checkPermission('blockedUsers', 'view'), blockedUserManagementController.getBlockedUserById);

// Update blocked user record
router.put('/:blockId', checkPermission('blockedUsers', 'edit'), blockedUserManagementController.updateBlockedUser);

// Unblock user (delete blocked user record)
router.delete('/:blockId', checkPermission('blockedUsers', 'delete'), blockedUserManagementController.unblockUser);

module.exports = router;
