const express = require('express');
const router = express.Router();
const platformFeeManagementController = require('../controllers/platformFeeManagementController');
const { verifyAdminToken, checkPermission } = require('../../auth/middleware/adminAuthMiddleware');

// All routes require admin authentication
router.use(verifyAdminToken);

// Get all platform fees with pagination and filters
router.get('/', checkPermission('platformFees', 'view'), platformFeeManagementController.getAllPlatformFees);

// Get platform fee statistics
router.get('/stats', checkPermission('platformFees', 'view'), platformFeeManagementController.getPlatformFeeStats);

// Calculate fee for a transaction
router.post('/calculate', checkPermission('platformFees', 'view'), platformFeeManagementController.calculateFee);

// Bulk operations on platform fees
router.post('/bulk', checkPermission('platformFees', 'edit'), platformFeeManagementController.bulkOperations);

// Create new platform fee configuration
router.post('/', checkPermission('platformFees', 'create'), platformFeeManagementController.createPlatformFee);

// Get platform fee by ID
router.get('/:feeId', checkPermission('platformFees', 'view'), platformFeeManagementController.getPlatformFeeById);

// Update platform fee configuration
router.put('/:feeId', checkPermission('platformFees', 'edit'), platformFeeManagementController.updatePlatformFee);

// Delete platform fee configuration
router.delete('/:feeId', checkPermission('platformFees', 'delete'), platformFeeManagementController.deletePlatformFee);

module.exports = router;
