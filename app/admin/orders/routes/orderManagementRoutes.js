const express = require('express');
const router = express.Router();
const orderManagementController = require('../controllers/orderManagementController');
const { verifyAdminToken, checkPermission } = require('../../auth/middleware/adminAuthMiddleware');

// All routes require admin authentication
router.use(verifyAdminToken);

// Get all orders with pagination and filters
router.get('/', checkPermission('orders', 'view'), orderManagementController.getAllOrders);

// Get order statistics
router.get('/stats', checkPermission('orders', 'view'), orderManagementController.getOrderStats);

// Get orders by payment method (escrow or standard)
router.get('/method/:method', checkPermission('orders', 'view'), orderManagementController.getOrdersByPaymentMethod);

// Get order by ID
router.get('/:orderId', checkPermission('orders', 'view'), orderManagementController.getOrderById);

// Update order status
router.put('/:orderId/status', checkPermission('orders', 'update'), orderManagementController.updateOrderStatus);

module.exports = router;
