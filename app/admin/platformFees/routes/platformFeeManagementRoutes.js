const express = require('express');
const router = express.Router();
const platformFeeManagementController = require('../controllers/platformFeeManagementController');
const { verifyAdminToken, checkPermission } = require('../../auth/middleware/adminAuthMiddleware');

// All routes require admin authentication
router.use(verifyAdminToken);

router.get('/', checkPermission('platformFees', 'view'), platformFeeManagementController.getAllPlatformFees);
router.get('/stats', checkPermission('platformFees', 'view'), platformFeeManagementController.getPlatformFeeStats);
router.post('/calculate', checkPermission('platformFees', 'view'), platformFeeManagementController.calculateFee);
router.post('/bulk', checkPermission('platformFees', 'edit'), platformFeeManagementController.bulkOperations);
router.post('/', checkPermission('platformFees', 'create'), platformFeeManagementController.createPlatformFee);
router.get('/:feeId', checkPermission('platformFees', 'view'), platformFeeManagementController.getPlatformFeeById);
router.put('/:feeId', checkPermission('platformFees', 'edit'), platformFeeManagementController.updatePlatformFee);
router.delete('/:feeId', checkPermission('platformFees', 'delete'), platformFeeManagementController.deletePlatformFee);

module.exports = router;
