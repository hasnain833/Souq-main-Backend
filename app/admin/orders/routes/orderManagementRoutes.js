const express = require('express');
const router = express.Router();
const orderManagementController = require('../controllers/orderManagementController');
const { verifyAdminToken, checkPermission } = require('../../auth/middleware/adminAuthMiddleware');

// All routes require admin authentication
router.use(verifyAdminToken);
router.get('/', checkPermission('orders', 'view'), orderManagementController.getAllOrders);
router.get('/stats', checkPermission('orders', 'view'), orderManagementController.getOrderStats);
router.get('/method/:method', checkPermission('orders', 'view'), orderManagementController.getOrdersByPaymentMethod);
router.get('/:orderId', checkPermission('orders', 'view'), orderManagementController.getOrderById);
router.put('/:orderId/status', checkPermission('orders', 'update'), orderManagementController.updateOrderStatus);

module.exports = router;
