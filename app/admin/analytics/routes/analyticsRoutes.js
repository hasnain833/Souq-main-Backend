const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { verifyAdminToken, checkPermission } = require('../../auth/middleware/adminAuthMiddleware');

// All routes require admin authentication
router.use(verifyAdminToken);

// Get dashboard overview statistics
router.get('/dashboard', checkPermission('analytics', 'view'), analyticsController.getDashboardStats);

// Get sales analytics
router.get('/sales', checkPermission('analytics', 'view'), analyticsController.getSalesAnalytics);

// Get top sellers
router.get('/top-sellers', checkPermission('analytics', 'view'), analyticsController.getTopSellers);

// Get category trends
router.get('/category-trends', checkPermission('analytics', 'view'), analyticsController.getCategoryTrends);

// Get user analytics
router.get('/users', checkPermission('analytics', 'view'), analyticsController.getUserAnalytics);

module.exports = router;
