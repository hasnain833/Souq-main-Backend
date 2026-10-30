const express = require('express');
const router = express.Router();
const verifyToken = require('../../../../utils/verifyToken');
const orderController = require('../controllers/orderController');

// All order routes require authentication
router.use(verifyToken);

// Order management
router.get('/', orderController.getUserOrders.bind(orderController));
router.post('/', orderController.createCodOrder.bind(orderController));
router.get('/statistics', orderController.getOrderStatistics.bind(orderController));
router.get('/:orderId', orderController.getOrderDetails.bind(orderController));
// Disabled in COD-only mode: status updates happen via /shipping/orders/:orderId/ship
// router.put('/:orderId/status', orderController.updateOrderStatus.bind(orderController));
router.post('/:orderId/confirm-delivery', orderController.confirmDelivery.bind(orderController));

module.exports = router;
