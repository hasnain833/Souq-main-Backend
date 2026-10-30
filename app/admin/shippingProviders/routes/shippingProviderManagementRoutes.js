const express = require('express');
const router = express.Router();
const shippingProviderManagementController = require('../controllers/shippingProviderManagementController');
const { verifyAdminToken, checkPermission } = require('../../auth/middleware/adminAuthMiddleware');

// All routes require admin authentication
router.use(verifyAdminToken);

// Get all shipping providers with pagination and filters
router.get('/', checkPermission('shippingProviders', 'view'), shippingProviderManagementController.getAllShippingProviders);

// Get shipping provider statistics
router.get('/stats', checkPermission('shippingProviders', 'view'), shippingProviderManagementController.getShippingProviderStats);

// Bulk operations on shipping providers
router.post('/bulk', checkPermission('shippingProviders', 'edit'), shippingProviderManagementController.bulkOperations);

// Create new shipping provider
router.post('/', checkPermission('shippingProviders', 'create'), shippingProviderManagementController.createShippingProvider);

// Get shipping provider by ID
router.get('/:providerId', checkPermission('shippingProviders', 'view'), shippingProviderManagementController.getShippingProviderById);

// Update shipping provider
router.put('/:providerId', checkPermission('shippingProviders', 'edit'), shippingProviderManagementController.updateShippingProvider);

// Delete shipping provider
router.delete('/:providerId', checkPermission('shippingProviders', 'delete'), shippingProviderManagementController.deleteShippingProvider);

module.exports = router;
