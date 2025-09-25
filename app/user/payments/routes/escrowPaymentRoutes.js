const express = require('express');
const router = express.Router();
const StripeService = require('../../../../services/payment/StripeService');
const config = require('../../../../config/index');
const EscrowPaymentService = require('../../../../services/escrow/escrowPaymentService');

router.post('/stripe/checkout', async (req, res) => {
  try {
    const { transactionId, successUrl, cancelUrl } = req.body;
    if (!transactionId) {
      return res.status(400).json({ error: 'Missing transactionId' });
    }
    // Get escrow transaction data via service
    const escrowData = await EscrowPaymentService.getPayment(transactionId);
    const e = escrowData?.payment;

    if (!e) return res.status(404).json({ error: 'Escrow transaction not found' });

    // Check if totalAmount already includes gateway fee
    const baseAmount = (e.productPrice || 0) + (e.platformFeeAmount || 0) + (e.shippingCost || 0) + (e.paymentSummary?.salesTax || 0);
    const expectedTotalWithFee = baseAmount + (e.gatewayFeePaidBy === 'buyer' ? (e.gatewayFeeAmount || 0) : 0);
    const tolerance = 0.01; // 1 cent tolerance
    
    let buyerPays = e.totalAmount || 0;
    
    // If totalAmount doesn't include gateway fee but buyer should pay it, add it
    if (e.gatewayFeePaidBy === 'buyer' && Math.abs(e.totalAmount - baseAmount) < tolerance) {
      buyerPays += (e.gatewayFeeAmount || 0);
    }
    const amount = Math.round(buyerPays * 100);
    const currency = e.currency;
    const productName = e.product?.title || 'Escrow Purchase';
    const customerEmail = e.buyer?.email || undefined;

    const stripeService = new StripeService(config);
    const result = await stripeService.createCheckoutSession({
      amount,
      currency,
      productName,
      customerEmail,
      metadata: { transactionId, paymentType: 'escrow' },
      successUrl,
      cancelUrl
    });

    if (result.success) {
      return res.json({ url: result.url });
    } else {
      return res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('❌ Error in escrow Stripe checkout:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
