const express = require('express');
const router = express.Router();
const userManagementController = require('../controllers/userManagementController');
const { verifyAdminToken, checkPermission } = require('../../auth/middleware/adminAuthMiddleware');

// All routes require admin authentication
router.use(verifyAdminToken);

// Get all users with pagination and filters
router.get('/', checkPermission('users', 'view'), userManagementController.getAllUsers);

// Get user statistics
router.get('/stats', checkPermission('users', 'view'), userManagementController.getUserStats);

// Get user by ID
router.get('/:userId', checkPermission('users', 'view'), userManagementController.getUserById);

// Update user
router.put('/:userId', checkPermission('users', 'edit'), userManagementController.updateUser);

// Suspend user
router.post('/:userId/suspend', checkPermission('users', 'suspend'), userManagementController.suspendUser);

// Reactivate user
router.post('/:userId/reactivate', checkPermission('users', 'suspend'), userManagementController.reactivateUser);

// Delete user permanently (requires suspend permission - same as suspend since both are destructive actions)
router.delete('/:userId', checkPermission('users', 'suspend'), userManagementController.deleteUser);

module.exports = router;
