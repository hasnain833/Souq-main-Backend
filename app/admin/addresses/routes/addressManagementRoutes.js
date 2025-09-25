const express = require('express');
const router = express.Router();
const addressManagementController = require('../controllers/addressManagementController');
const { verifyAdminToken, checkPermission } = require('../../auth/middleware/adminAuthMiddleware');

// All routes require admin authentication
router.use(verifyAdminToken);

// Get all addresses with pagination and filters
router.get('/', checkPermission('addresses', 'view'), addressManagementController.getAllAddresses);

// Get address statistics
router.get('/stats', checkPermission('addresses', 'view'), addressManagementController.getAddressStats);

// Bulk operations on addresses
router.post('/bulk', checkPermission('addresses', 'edit'), addressManagementController.bulkOperations);

// Get address by ID
router.get('/:addressId', checkPermission('addresses', 'view'), addressManagementController.getAddressById);

// Update address
router.put('/:addressId', checkPermission('addresses', 'edit'), addressManagementController.updateAddress);

// Delete address
router.delete('/:addressId', checkPermission('addresses', 'delete'), addressManagementController.deleteAddress);

module.exports = router;
