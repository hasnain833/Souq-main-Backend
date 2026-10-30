const express = require('express');
const router = express.Router();
const verifyToken = require('../../../../utils/verifyToken');
const walletController = require('../controllers/walletController');

// All wallet routes require authentication
router.use(verifyToken);

// Wallet summary for COD sales
router.get('/summary', walletController.getWalletSummary);

// Transaction history
router.get('/transactions', walletController.getTransactionHistory);

module.exports = router;
