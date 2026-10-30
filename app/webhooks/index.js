const express = require('express');
const router = express.Router();

// Import webhook routes
const paypalWebhookRoutes = require('./routes/paypalWebhookRoutes');
const trackingWebhookRoutes = require('./routes/trackingWebhookRoutes');

// Mount webhook routes
router.use('/paypal', paypalWebhookRoutes);
router.use('/tracking', trackingWebhookRoutes);

module.exports = router;