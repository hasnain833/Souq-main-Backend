const express = require('express');
const router = express.Router();
const verifyToken = require('../../../../utils/verifyToken');
const walletController = require('../controllers/walletController');
const stripePayoutWebhookController = require('../controllers/stripePayoutWebhookController');

// Stripe payout webhook (no authentication required)
router.post('/webhook/stripe/payouts', express.raw({type: 'application/json'}), stripePayoutWebhookController.handleStripePayoutWebhook);

// All other wallet routes require authentication
router.use(verifyToken);



// Get wallet details
router.get('/', walletController.getWallet);

// Get wallet balance for specific currency
router.get('/balance', walletController.getBalance);

// Get transaction history
router.get('/transactions', walletController.getTransactionHistory);

// Get wallet statistics
router.get('/statistics', walletController.getWalletStatistics);

// Get comprehensive transaction data
router.get('/comprehensive-data', walletController.getComprehensiveTransactionData);

// Withdraw money from wallet
router.post('/withdraw', walletController.withdrawMoney);

// Check withdrawal status
router.get('/withdrawal/:transactionId/status', walletController.checkWithdrawalStatus);

// Get withdrawal history
router.get('/withdrawals', walletController.getWithdrawalHistory);

// Complete payment and credit wallet
router.post('/complete-payment', walletController.completePayment);

// Update wallet settings
router.put('/settings', walletController.updateWalletSettings);

// Fix wallet duplicate keys (Admin function)
router.post('/fix-duplicate-keys', walletController.fixWalletDuplicateKeys);

// Debug specific transaction ID (Development function)
router.get('/debug-transaction', walletController.debugTransactionId);

// Test user isolation (Development function)
router.get('/test-user-isolation', walletController.testUserIsolation);

// Check transaction status and details
router.get('/check-transaction', walletController.checkTransaction);

module.exports = router;
