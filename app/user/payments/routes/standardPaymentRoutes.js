const express = require('express');
const router = express.Router();
const verifyToken = require('../../../../utils/verifyToken');
const standardPaymentController = require('../controllers/standardPaymentController');
const webhookController = require('../controllers/webhookController');

const StripeService = require('../../../../services/payment/StripeService');
const config = require('../../../../config');
const StandardPaymentService = require('../../../../services/standard/StandardPaymentService'); 
// /../services/standard/StandardPaymentService
// ========================
// 📌 Public Routes
// ========================
router.use('/webhook', express.raw({ type: 'application/json' })); // Raw body for Stripe webhooks
router.post('/webhook/:gateway', webhookController.handleStandardPaymentWebhook);

// Public PayPal config endpoints
router.get('/paypal/client-id', standardPaymentController.getPayPalClientId);
router.get('/paypal/client-token', standardPaymentController.getPayPalClientToken);

// ========================
// 🔒 Protected Routes (Require Authentication)
// ========================
router.use(verifyToken);

// Test endpoint
router.get('/test', standardPaymentController.testStandardPayment);

// Create a new standard payment record
router.post('/create', standardPaymentController.createStandardPayment);

// Initialize payment with a specific gateway (e.g., Stripe, PayPal)
router.post('/:paymentId/initialize', standardPaymentController.initializeStandardPayment);

// Get payment details
router.get('/:paymentId', standardPaymentController.getStandardPayment);

// Check & update payment status from gateway
router.get('/:paymentId/check-payment-status', standardPaymentController.checkStandardPaymentStatus);

// ========================
// 🚀 NEW: Stripe Checkout Redirect Endpoint for Standard Payments
// ========================
router.post('/stripe/checkout', async (req, res) => {
  try {
    const { transactionId, successUrl, cancelUrl } = req.body;

    if (!transactionId) {
      return res.status(400).json({ error: 'Missing transactionId' });
    }

    // 1️⃣ Fetch Standard Payment Details
    const paymentData = await StandardPaymentService.getPayment(transactionId);
    const p = paymentData?.payment || paymentData?.data?.payment;
    if (!p) {
      return res.status(404).json({ error: 'Standard payment not found' });
    }

    // 2️⃣ Calculate buyer’s payable amount
    const buyerPays = (p.productPrice || 0)
      + (p.platformFeeAmount || 0)
      + (p.shippingCost || 0)
      + (p.salesTax || 0)
      + (p.gatewayFeePaidBy === 'buyer' ? (p.gatewayFeeAmount || 0) : 0);

    const amount = Math.round(buyerPays * 100); // Stripe smallest unit (₹→paise, $→cents)
    const currency = p.currency;
    const productName = p.product?.title || 'Standard Purchase';
    const customerEmail = p.buyer?.email || undefined;

    // 3️⃣ Create Stripe Checkout Session
    const stripeService = new StripeService(config);
    const result = await stripeService.createCheckoutSession({
      amount,
      currency,
      productName,
      customerEmail,
      metadata: { transactionId, paymentType: 'standard' },
      successUrl,
      cancelUrl
    });

    // 4️⃣ Respond to frontend
    if (result.success) {
      return res.json({ url: result.url });
    } else {
      return res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('❌ Error in standard Stripe checkout:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
