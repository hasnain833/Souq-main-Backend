const express = require('express');
const router = express.Router();

// Existing routes
const categorynsRoutes = require('../admin/category/routes/categoryRoutes');
const sizeRoutes = require('../admin/sizeChart/routes/sizeRoutes');
const adminEscrowRoutes = require('./escrow/routes/adminEscrowRoutes');
const menuRoutes = require('./menu/routes/menuRoutes');

// New admin routes
const adminAuthRoutes = require('./auth/routes/adminAuthRoutes');
const userManagementRoutes = require('./users/routes/userManagementRoutes');
const listingManagementRoutes = require('./listings/routes/listingManagementRoutes');
const disputeManagementRoutes = require('./disputes/routes/disputeManagementRoutes');
const counterfeitManagementRoutes = require('./counterfeit/routes/counterfeitManagementRoutes');
const analyticsRoutes = require('./analytics/routes/analyticsRoutes');
const locationRoutes = require('./location/routes/locationRoutes');
const shippingRoutes = require('./shipping/routes/shippingManagementRoutes');
const notificationRoutes = require('./notifications/routes/adminNotificationRoutes');
const orderManagementRoutes = require('./orders/routes/orderManagementRoutes');
const ratingManagementRoutes = require('./ratings/routes/ratingManagementRoutes');
const reportManagementRoutes = require('./reports/routes/reportManagementRoutes');

// Collection Management Routes
const addressManagementRoutes = require('./addresses/routes/addressManagementRoutes');
const blockedUserManagementRoutes = require('./blockedUsers/routes/blockedUserManagementRoutes');
const notificationSettingsManagementRoutes = require('./notificationSettings/routes/notificationSettingsManagementRoutes');
const platformFeeManagementRoutes = require('./platformFees/routes/platformFeeManagementRoutes');
const shippingProviderManagementRoutes = require('./shippingProviders/routes/shippingProviderManagementRoutes');
const contactManagementRoutes = require('./contacts/routes/contactManagementRoutes');

// Admin Authentication Routes
router.use('/auth', adminAuthRoutes);

// Admin User Management Routes
router.use('/users', userManagementRoutes);

// Admin Listing Management Routes
router.use('/listings', listingManagementRoutes);

// Admin Dispute Management Routes
router.use('/disputes', disputeManagementRoutes);

// Admin Counterfeit Management Routes
router.use('/counterfeit', counterfeitManagementRoutes);

// Admin Analytics Routes
router.use('/analytics', analyticsRoutes);

// Admin Location Management Routes
router.use('/locations', locationRoutes);

// Admin Shipping Management Routes
router.use('/shipping', shippingRoutes);

// Admin Notification Management Routes
router.use('/notifications', notificationRoutes);

// Admin Order Management Routes
router.use('/orders', orderManagementRoutes);

// Admin Rating Management Routes
router.use('/ratings', ratingManagementRoutes);

// Admin Report Management Routes
router.use('/reports', reportManagementRoutes);

// Collection Management Routes
router.use('/addresses', addressManagementRoutes);
router.use('/blocked-users', blockedUserManagementRoutes);
router.use('/notification-settings', notificationSettingsManagementRoutes);
router.use('/platform-fees', platformFeeManagementRoutes);
router.use('/shipping-providers', shippingProviderManagementRoutes);

// Existing Admin Routes
router.use('/categories', categorynsRoutes);
router.use('/menus', menuRoutes);
router.use('/size', sizeRoutes);
router.use('/escrow', adminEscrowRoutes);

// Contact Management Routes
router.use('/contacts', contactManagementRoutes);

module.exports = router;

