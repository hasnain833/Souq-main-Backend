const express = require('express');
const router = express.Router();
const userAuthRoutes = require('./auth/routes/userAuthRoutes');
const userSocialAuthRoutes = require('./auth/routes/userSocialAuthRoutes');
const profileRoutes = require('./profile/routes/profileRoutes');
const productRoutes = require('./product/routes/productRoutes');
const generalRoutes = require('./general/routes/generalRoutes');
const chatRoutes = require('./chat/routes/chatRoutes');
const offerRoutes = require('./offer/routes/offerRoutes');
const escrowRoutes = require('./escrow/routes/escrowRoutes');
const currencyRoutes = require('./currency/routes/currencyRoutes');
const cardRoutes = require('./cards/routes/cardRoutes');
const standardPaymentRoutes = require('./payments/routes/standardPaymentRoutes');
const paymentMethodRoutes = require('./payments/routes/paymentMethodRoutes');
const bankAccountRoutes = require('./bankAccounts/routes/bankAccountRoutes');
const addressRoutes = require('./addresses/routes/addressRoutes');
const shippingRoutes = require('./shipping/routes/shippingRoutes');
const orderRoutes = require('./shipping/routes/orderRoutes');
const ratingRoutes = require('./rating/routes/ratingRoutes');
const walletRoutes = require('./wallet/routes/walletRoutes');
const locationRoutes = require('./location/routes/locationRoutes');
const transactionRoutes = require('./transaction/routes/transactionRoutes');
const notificationRoutes = require('./notifications/routes/notificationRoutes');
const seoRoutes = require('./seo/routes/seoRoutes');
const sessionRoutes = require('./session/routes/sessionRoutes');
const suggestionRoutes = require('./suggestion/routes/suggestionRoutes');
const personalizationRoutes = require('./personalization/personalizationRoutes/personalizationRoutes');

router.use('/suggestions', suggestionRoutes);
router.use('/personalization', personalizationRoutes);
router.use('/sessions', sessionRoutes);


//User Auth APIs
router.use('/auth', userAuthRoutes);
router.use('/auth', userSocialAuthRoutes);

//User Profile APIs
router.use('/profile', profileRoutes);

//User Sell Product APIS
router.use('/product', productRoutes);

//User Chat APIs
router.use('/chat', chatRoutes);

//User Offer APIs
router.use('/offer', offerRoutes);

//User Escrow APIs
router.use('/escrow', escrowRoutes);

//User Currency APIs
router.use('/currency', currencyRoutes);

//User Card APIs
router.use('/cards', cardRoutes);

//User Standard Payment APIs
router.use('/payments', standardPaymentRoutes);

//User Payment Method APIs
router.use('/payment-methods', paymentMethodRoutes);

//User Bank Account APIs
router.use('/bank-accounts', bankAccountRoutes);

//User PayPal Account APIs
const paypalAccountRoutes = require('./paypalAccounts/routes/paypalAccountRoutes');
router.use('/paypal-accounts', paypalAccountRoutes);

//User Address APIs
router.use('/addresses', addressRoutes);

//User Shipping APIs
router.use('/shipping', shippingRoutes);

//User Order APIs
router.use('/orders', orderRoutes);

//User Tracking APIs
const trackingRoutes = require('./shipping/routes/trackingRoutes');
router.use('/tracking', trackingRoutes);

//User Rating APIs
router.use('/ratings', ratingRoutes);

//User Wallet APIs
router.use('/wallet', walletRoutes);

//User Transaction APIs
router.use('/transactions', transactionRoutes);

//User Location APIs (Countries & Cities)
router.use('/location', locationRoutes);

//User Notification APIs
router.use('/notifications', notificationRoutes);

//SEO Routes (sitemap, robots.txt)
router.use('/', seoRoutes);

router.use('/general/category', generalRoutes);

// Contact form routes
const contactRoutes = require('./general/routes/contactRoutes');
router.use('/general/contact', contactRoutes);

module.exports = router;