const express = require('express');
const router = express.Router();
const verifyToken = require('../../../../utils/verifyToken');
const escrowController = require('../controllers/escrowController');
const webhookController = require('../controllers/webhookController');
const escrowPaymentRoutes = require('../../payments/routes/escrowPaymentRoutes')

// All escrow routes require authentication except webhooks
router.use('/webhook', express.raw({ type: 'application/json' }));
router.post('/webhook/:gateway', webhookController.handlePaymentWebhook);
router.use(verifyToken);
router.get('/payment-gateways', escrowController.getAvailablePaymentGateways);
router.post('/create', escrowController.createEscrowTransaction);
router.use('/', escrowPaymentRoutes);
router.post('/:escrowTransactionId/initialize-payment', escrowController.initializePayment);
router.get('/:transactionId', escrowController.getEscrowTransaction);
router.get('/:transactionId/status', escrowController.getEscrowTransactionStatus);
router.get('/', escrowController.getUserEscrowTransactions);
router.get('/transaction/:transactionId', escrowController.getTransactionDetails);
router.post('/:transactionId/complete-payment', escrowController.completePayment);
router.post('/:transactionId/test-complete-payment', escrowController.testCompletePayment);
router.get('/:transactionId/check-payment-status', escrowController.checkPaymentStatus);
router.get('/transactions/history', escrowController.getUserTransactions);
router.patch('/:transactionId/ship', escrowController.markAsShipped);
router.patch('/:transactionId/confirm-delivery', escrowController.confirmDelivery);
router.get('/:transactionId/verify-payment', webhookController.verifyPaymentStatus);

module.exports = router;
