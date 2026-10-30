const express = require('express');
const router = express.Router();
const stripeController = require('../controllers/stripeController');
const verifyToken = require('../../../../utils/verifyToken');
const bodyParser = require('body-parser');

// ✅ Use your JWT middleware
router.post('/create_checkout_session', verifyToken, stripeController.createCheckoutSession);
router.post('/create-stripe-account', verifyToken, stripeController.createStripeOnboard);
router.post('/register-paypal', verifyToken, stripeController.registerPaypalEmail);
router.post('/webhook', bodyParser.raw({type: 'application/json'}), stripeController.webhooks);
router.post('/create-paypal-order', verifyToken, stripeController.createPaypalOrder);
router.post('/capture-paypal-order', verifyToken, stripeController.capturePaypalOrder);
router.post('/disconnect-stripe', verifyToken, stripeController.disconnectStripe);
router.post('/disconnect-paypal', verifyToken, stripeController.disconnectPaypal);

module.exports = router;
