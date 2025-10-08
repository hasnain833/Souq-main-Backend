const express = require('express');
const router = express.Router();
const verifyToken = require('../../../../utils/verifyToken');
const standardPaymentController = require('../controllers/standardPaymentController');
const webhookController = require('../controllers/webhookController');
const StripeService = require('../../../../services/payment/StripeService');
const PayPalService = require('../../../../services/payment/PayPalService');
const config = require('../../../../config');
const StandardPaymentService = require('../../../../services/standard/StandardPaymentService'); 



router.use('/webhook', express.raw({ type: 'application/json' })); // Raw body for Stripe webhooks
router.post('/webhook/:gateway', webhookController.handleStandardPaymentWebhook);
router.get('/paypal/client-id', standardPaymentController.getPayPalClientId);
router.get('/paypal/client-token', standardPaymentController.getPayPalClientToken);
router.use(verifyToken);
router.get('/test', standardPaymentController.testStandardPayment);
router.post('/create', standardPaymentController.createStandardPayment);
router.post('/:paymentId/initialize', standardPaymentController.initializeStandardPayment);
router.get('/:paymentId', standardPaymentController.getStandardPayment);
router.get('/:paymentId/check-payment-status', standardPaymentController.checkStandardPaymentStatus);

// Create a real PayPal Checkout order for Standard Payments
router.post('/paypal/orders', async (req, res) => {
  try {
    const { transactionId, returnUrl, cancelUrl } = req.body;

    if (!transactionId) {
      return res.status(400).json({ success: false, error: 'Missing transactionId' });
    }

    // 1) Fetch standard payment data
    const paymentData = await StandardPaymentService.getPayment(transactionId);
    const p = paymentData?.payment || paymentData?.data?.payment;
    if (!p) {
      return res.status(404).json({ success: false, error: 'Standard payment not found' });
    }

    // 2) Calculate buyer payable amount
    const buyerPays = (p.productPrice || 0)
      + (p.platformFeeAmount || 0)
      + (p.shippingCost || 0)
      + (p.salesTax || 0)
      + (p.gatewayFeePaidBy === 'buyer' ? (p.gatewayFeeAmount || 0) : 0);

    const amount = Number(buyerPays);
    const currency = p.currency || 'USD';

    // 3) Create PayPal order
    const paypal = new PayPalService(config);
    const result = await paypal.initializePayment({
      amount,
      currency,
      orderId: transactionId,
      description: p.product?.title || 'Standard Purchase',
      returnUrl: returnUrl || `${req.protocol}://${req.get('host')}/payment-success?transaction=${transactionId}&type=standard`,
      cancelUrl: cancelUrl || `${req.protocol}://${req.get('host')}/payment-cancelled?transaction=${transactionId}&type=standard`,
    });

    if (!result?.success) {
      return res.status(502).json({ success: false, error: result?.error || 'Failed to create PayPal order' });
    }

    // Optionally update the payment with gateway order id
    try {
      await StandardPaymentService.updatePayment(p._id, {
        gatewayTransactionId: result.transactionId,
        gatewayResponse: result.gatewayResponse,
        status: 'processing'
      });
    } catch (_) {}

    return res.json({ success: true, data: { orderId: result.transactionId, approvalUrl: result.paymentUrl } });
  } catch (err) {
    console.error('❌ Error creating PayPal order:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
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
