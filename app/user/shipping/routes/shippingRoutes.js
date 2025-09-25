const express = require('express');
const router = express.Router();
const verifyToken = require('../../../../utils/verifyToken');
const shippingController = require('../controllers/shippingController');

// All shipping routes require authentication
router.use(verifyToken);

// Shipping providers
router.get('/providers', shippingController.getProviders);

// Shipping rates
router.post('/rates', shippingController.getShippingRates);

// Shipment management
router.post('/shipments', shippingController.createShipment);
router.get('/track/:trackingNumber', shippingController.trackShipment);

// Delivery options management
router.get('/delivery-options', shippingController.getDeliveryOptions);
router.post('/delivery-options', shippingController.saveDeliveryOption);
router.put('/delivery-options/:deliveryOptionId', shippingController.saveDeliveryOption);
router.delete('/delivery-options/:deliveryOptionId', shippingController.deleteDeliveryOption);
router.put('/delivery-options/:deliveryOptionId/default', shippingController.setDefaultDeliveryOption);

module.exports = router;
