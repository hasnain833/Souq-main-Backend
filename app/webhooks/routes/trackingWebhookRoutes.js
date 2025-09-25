const express = require('express');
const router = express.Router();
const trackingWebhookController = require('../controllers/trackingWebhookController');

// AfterShip webhook (no auth required for webhooks)
router.post('/aftership', trackingWebhookController.handleAfterShipWebhook);

// Provider-specific webhooks
router.post('/provider/:provider', trackingWebhookController.handleProviderWebhook);

module.exports = router;