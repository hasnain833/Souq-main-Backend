// routes/escrow.js
const express = require('express');
const router = express.Router();
const verifyToken = require('../../../../utils/verifyToken');

// Import controllers
const stripeEscrowController = require('../controllers/stripeEscrowController');
const paypalEscrowController = require('../controllers/paypalEscrowController');
const escrowManagementController = require('../controllers/escrowManagementController');
const paypalWebhookController = require("../controllers/paypalWebhookController")
const stripeWebhookController = require("../controllers/stripeWebhookController")

// Stripe Escrow Routes
router.post('/stripe/create-session', verifyToken, stripeEscrowController.createStripeEscrowSession);
router.post('/stripe/confirm-payment', verifyToken, stripeEscrowController.confirmStripeEscrowPayment);
router.post('/stripe/release-payment', verifyToken, stripeEscrowController.releaseStripeEscrowPayment);
router.post('/stripe/cancel-payment', verifyToken, stripeEscrowController.cancelStripeEscrowPayment);

// PayPal Escrow Routes
router.post('/paypal/create-order', verifyToken, paypalEscrowController.createPaypalEscrowOrder);
router.post('/paypal/capture-payment', verifyToken, paypalEscrowController.capturePaypalEscrowPayment);
router.post('/paypal/release-payment', verifyToken, paypalEscrowController.releasePaypalEscrowPayment);

// Common Escrow Management Routes
router.post('/dispute', verifyToken, escrowManagementController.initiateDispute);
router.get('/my-escrows', verifyToken, escrowManagementController.getUserEscrows);
router.get('/:escrowId', verifyToken, escrowManagementController.getEscrowDetails);
router.get('/my-escrows', verifyToken, escrowManagementController.getUserEscrows);

//webhooks
// router.post('/paypal/webhook', express.raw({type: 'application/json'}),paypalWebhookController.handlePaypalWebhook );

// PayPal webhook - MUST use raw body middleware
router.post(
  '/paypal/webhook', 
  express.raw({ type: 'application/json' }), // Critical: Use raw body for webhooks
  paypalWebhookController.handlePaypalWebhook
);

// Sync endpoint for frontend to check status
router.get('/paypal/sync-status/:orderId', paypalWebhookController.syncEscrowPaymentStatus);

// Debug routes (optional - remove in production)
router.get('/paypal/webhook/status', (req, res) => {
  res.json(paypalWebhookController.getWebhookStatus());
});

router.delete('/paypal/webhook/clear-events', (req, res) => {
  paypalWebhookController.clearProcessedEvents();
  res.json({ message: 'Processed events cleared' });
});

router.post(
  '/stripe/webhook',
  express.raw({ type: 'application/json' }), // Stripe also needs raw body
  stripeWebhookController.handleStripeWebhook
);

router.get('/stripe/sync-status/:paymentIntentId', stripeWebhookController.syncStripeEscrowStatus);
router.get('/stripe/webhook/status', (req, res) => {
  res.json(stripeWebhookController.getStripeWebhookStatus());
});

router.delete('/stripe/webhook/clear-events', (req, res) => {
  stripeWebhookController.clearStripeProcessedEvents();
  res.json({ message: 'Stripe processed events cleared' });
});

module.exports = router;