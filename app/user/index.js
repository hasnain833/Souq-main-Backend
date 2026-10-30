const express = require("express");
const router = express.Router();
const userAuthRoutes = require("./auth/routes/userAuthRoutes");
const userSocialAuthRoutes = require("./auth/routes/userSocialAuthRoutes");
const profileRoutes = require("./profile/routes/profileRoutes");
const productRoutes = require("./product/routes/productRoutes");
const optimizedProductRoutes = require("./product/routes/optimizedProductRoutes");
const generalRoutes = require("./general/routes/generalRoutes");
const chatRoutes = require('./chat/routes/chatRoutes');
const stripeRoutes = require('./stripe/routes/stripeRoutes');
const offerRoutes = require('./offer/routes/offerRoutes');
// ESCROW_DISABLED: Escrow routes temporarily disabled. Keeping import commented for future use.
// Escrow removed in COD-only mode
const currencyRoutes = require("./currency/routes/currencyRoutes");
// const cardRoutes = require("./cards/routes/cardRoutes"); // Removed - non-COD payment
// const standardPaymentRoutes = require("./payments/routes/standardPaymentRoutes"); // Removed - non-COD payment
// const paymentMethodRoutes = require("./payments/routes/paymentMethodRoutes"); // Removed - non-COD payment
// const bankAccountRoutes = require("./bankAccounts/routes/bankAccountRoutes"); // Removed - non-COD payment
// const addressRoutes = require("./addresses/routes/addressRoutes");
const shippingRoutes = require("./shipping/routes/shippingRoutes");
const orderRoutes = require("./shipping/routes/orderRoutes");
// const ratingRoutes = require('./rating/routes/ratingRoutes');
// const walletRoutes = require("./wallet/routes/walletRoutes"); // Removed - non-COD payment
const codWalletRoutes = require("./wallet/routes/walletRoutes"); // New COD-based wallet
// const locationRoutes = require("./location/routes/locationRoutes");
// const transactionRoutes = require("./transaction/routes/transactionRoutes"); // Removed - non-COD payment
const notificationRoutes = require('./notifications/routes/notificationRoutes');
const seoRoutes = require("./seo/routes/seoRoutes");
const productSuggestionRoutes = require("./suggestion/routes/suggestionRoutes");
const personalizationRoutes = require("./personalization/personalizationRoutes/personalizationRoutes");
const escrowRoutes = require("./escrowPayments/routes/escrow");

//User Auth APIs
router.use("/auth", userAuthRoutes);
router.use("/auth", userSocialAuthRoutes);
router.use("/profile", profileRoutes);

//User Sell Product APIS
router.use("/product", productRoutes);

// Optimized Product APIs for better performance
router.use("/products", optimizedProductRoutes);

//User Chat APIs
router.use("/chat", chatRoutes);
router.use("/payment", stripeRoutes);
router.use("/escrow", escrowRoutes);

//User Offer APIs
router.use("/offer", offerRoutes);

// router.use('/escrow', escrowRoutes); // disabled (COD-only)

//User Currency APIs
router.use("/currency", currencyRoutes);

//User Card APIs - REMOVED (non-COD payment)
// router.use("/cards", cardRoutes);

//User Standard Payment APIs - REMOVED (non-COD payment)
// router.use("/payments", standardPaymentRoutes);
// router.use("/paypal", paypalRestRoutes);

//User Payment Method APIs - REMOVED (non-COD payment)
// router.use("/payment-methods", paymentMethodRoutes);

//User Bank Account APIs - REMOVED (non-COD payment)
// router.use("/bank-accounts", bankAccountRoutes);

//User PayPal Account APIs - REMOVED (non-COD payment)
// const paypalAccountRoutes = require("./paypalAccounts/routes/paypalAccountRoutes");
// router.use("/paypal-accounts", paypalAccountRoutes);

//User Address APIs
// router.use("/addresses", addressRoutes);

//User Shipping APIs
router.use("/shipping", shippingRoutes);

//User Order APIs
router.use("/orders", orderRoutes);

//User Tracking APIs
// const trackingRoutes = require("./shipping/routes/trackingRoutes");
// router.use("/tracking", trackingRoutes);

//User Rating APIs
// router.use("/ratings", ratingRoutes);

//User Wallet APIs - COD-based wallet for tracking sales
router.use("/wallet", codWalletRoutes);

//User Transaction APIs - REMOVED (non-COD payment)
// router.use("/transactions", transactionRoutes);

//User Location APIs (Countries & Cities)
// router.use("/location", locationRoutes);

//User Notification APIs
router.use("/notifications", notificationRoutes);
router.use("/suggestions", productSuggestionRoutes);
router.use("/personalization", personalizationRoutes);

//SEO Routes (sitemap, robots.txt)
router.use("/", seoRoutes);

router.use("/general/category", generalRoutes);

// Contact form routes
const contactRoutes = require("./general/routes/contactRoutes");
router.use("/general/contact", contactRoutes);

module.exports = router;
