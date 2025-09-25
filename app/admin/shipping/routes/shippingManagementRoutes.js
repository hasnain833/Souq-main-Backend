const express = require('express');
const router = express.Router();
const shippingManagementController = require('../controllers/shippingManagementController');
const { verifyAdminToken, checkPermission } = require('../../auth/middleware/adminAuthMiddleware');

// All routes require admin authentication
router.use(verifyAdminToken);

// Shipping Providers Management
router.get('/providers', shippingManagementController.getAllProviders);
router.get('/providers/stats', shippingManagementController.getProviderStats);
router.get('/providers/:providerId', shippingManagementController.getProviderById);
router.post('/providers', checkPermission('shipping', 'create'), shippingManagementController.createProvider);
router.put('/providers/:providerId', checkPermission('shipping', 'update'), shippingManagementController.updateProvider);
router.delete('/providers/:providerId', checkPermission('shipping', 'delete'), shippingManagementController.deleteProvider);
router.patch('/providers/:providerId/toggle-status', checkPermission('shipping', 'update'), shippingManagementController.toggleProviderStatus);

// Shipping Services Management
router.get('/providers/:providerId/services', shippingManagementController.getProviderServices);
router.post('/providers/:providerId/services', checkPermission('shipping', 'create'), shippingManagementController.addProviderService);
router.put('/providers/:providerId/services/:serviceId', checkPermission('shipping', 'update'), shippingManagementController.updateProviderService);
router.delete('/providers/:providerId/services/:serviceId', checkPermission('shipping', 'delete'), shippingManagementController.deleteProviderService);

// Delivery Options Management
router.get('/delivery-options', shippingManagementController.getAllDeliveryOptions);
router.get('/delivery-options/stats', shippingManagementController.getDeliveryOptionsStats);
router.get('/delivery-options/:optionId', shippingManagementController.getDeliveryOptionById);
router.delete('/delivery-options/:optionId', checkPermission('shipping', 'delete'), shippingManagementController.deleteDeliveryOption);

// Shipments Management
router.get('/shipments', shippingManagementController.getAllShipments);
router.get('/shipments/stats', shippingManagementController.getShipmentStats);
router.get('/shipments/:shipmentId', shippingManagementController.getShipmentById);
router.patch('/shipments/:shipmentId/status', checkPermission('shipping', 'update'), shippingManagementController.updateShipmentStatus);

// Bulk Actions
router.post('/providers/bulk-actions', checkPermission('shipping', 'update'), shippingManagementController.bulkProviderActions);
router.post('/delivery-options/bulk-actions', checkPermission('shipping', 'delete'), shippingManagementController.bulkDeliveryOptionActions);

module.exports = router;
