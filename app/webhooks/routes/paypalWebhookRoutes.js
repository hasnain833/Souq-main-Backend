const express = require('express');
const router = express.Router();
const paypalWebhookController = require('../controllers/paypalWebhookController');

// PayPal webhook endpoint (no authentication required for webhooks)
router.post('/', paypalWebhookController.handlePayPalWebhook);

// Get webhook events (for debugging - requires authentication)
router.get('/events', paypalWebhookController.getWebhookEvents);

module.exports = router;