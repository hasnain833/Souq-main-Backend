const express = require('express');
const router = express.Router();
const verifyToken = require('../../../../utils/verifyToken');
const escrowController = require('../controllers/escrowController');
const webhookController = require('../controllers/webhookController');
const escrowPaymentRoutes = require('../../payments/routes/escrowPaymentRoutes')

// All escrow routes require authentication except webhooks
router.use('/webhook', express.raw({ type: 'application/json' })); // Raw body for webhooks

// Webhook routes (no authentication required)
router.post('/webhook/:gateway', webhookController.handlePaymentWebhook);

// Protected routes (require authentication)
router.use(verifyToken);

// Get available payment gateways
router.get('/payment-gateways', escrowController.getAvailablePaymentGateways);

// Create escrow transaction
router.post('/create', escrowController.createEscrowTransaction);

router.use('/', escrowPaymentRoutes);
// Initialize payment for escrow transaction
router.post('/:escrowTransactionId/initialize-payment', escrowController.initializePayment);

// Get escrow transaction details
router.get('/:transactionId', escrowController.getEscrowTransaction);

// Get escrow transaction status only
router.get('/:transactionId/status', escrowController.getEscrowTransactionStatus);

// Get user's escrow transactions
router.get('/', escrowController.getUserEscrowTransactions);

// Transaction management routes
// Get transaction details by transaction ID
router.get('/transaction/:transactionId', escrowController.getTransactionDetails);

// Complete payment after successful gateway confirmation
router.post('/:transactionId/complete-payment', escrowController.completePayment);

// Test endpoint to manually complete payment (for testing purposes)
router.post('/:transactionId/test-complete-payment', escrowController.testCompletePayment);

// Check and update payment status from gateway
router.get('/:transactionId/check-payment-status', escrowController.checkPaymentStatus);

// Get user's transaction history
router.get('/transactions/history', escrowController.getUserTransactions);

// Mark item as shipped (seller only)
router.patch('/:transactionId/ship', escrowController.markAsShipped);

// Confirm delivery (buyer only)
router.patch('/:transactionId/confirm-delivery', escrowController.confirmDelivery);

// Verify payment status manually
router.get('/:transactionId/verify-payment', webhookController.verifyPaymentStatus);

module.exports = router;
