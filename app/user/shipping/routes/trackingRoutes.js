const express = require('express');
const router = express.Router();
const verifyToken = require('../../../../utils/verifyToken');
const trackingController = require('../controllers/trackingController');

// All tracking routes require authentication
router.use(verifyToken);

// Shipping and tracking management
router.post('/orders/:orderId/ship', trackingController.markAsShipped);
router.get('/orders/:orderId/tracking', trackingController.getOrderTracking);
router.get('/shipments', trackingController.getUserShipments);

// Tracking updates
router.put('/tracking/:trackingId/status', trackingController.updateTrackingStatus);
router.post('/tracking/:trackingId/confirm-delivery', trackingController.confirmDelivery);

// Get tracking by tracking ID (for public tracking pages)
router.get('/track/:trackingId', trackingController.getOrderTracking);

// Shipping providers and options
router.get('/providers', trackingController.getShippingProviders);
router.post('/shipping-options', trackingController.getShippingOptions);

// Sync tracking with provider
router.post('/tracking/:trackingId/sync', trackingController.syncTrackingWithProvider);

module.exports = router;