const express = require('express');
const router = express.Router();
const trackingWebhookController = require('../controllers/trackingWebhookController');

// OLD: AfterShip webhook (commented out - replaced with manual tracking)
// router.post('/aftership', trackingWebhookController.handleAfterShipWebhook);

// NEW: 17Track webhook (optional - if using 17Track webhooks)
router.post('/17track', trackingWebhookController.handleSeventeenTrackWebhook);

// Provider-specific webhooks
router.post('/provider/:provider', trackingWebhookController.handleProviderWebhook);

module.exports = router;