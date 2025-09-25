const express = require('express');
const router = express.Router();
const verifyToken = require('../../../../utils/verifyToken');
const adminEscrowController = require('../controllers/adminEscrowController');

// All admin escrow routes require authentication
router.use(verifyToken);

// Dashboard and statistics
router.get('/dashboard/stats', adminEscrowController.getDashboardStats);

// Transaction management
router.get('/transactions', adminEscrowController.getAllTransactions);
router.get('/transactions/:transactionId', adminEscrowController.getTransactionDetails);
router.patch('/transactions/:transactionId/status', adminEscrowController.updateTransactionStatus);

// Payout management
router.post('/transactions/:transactionId/payout', adminEscrowController.processManualPayout);

// Gateway management
router.get('/gateways/status', adminEscrowController.getGatewayStatus);

// Currency management
router.get('/currency/stats', adminEscrowController.getCurrencyStats);
router.post('/currency/update-rates', adminEscrowController.updateExchangeRates);

module.exports = router;
