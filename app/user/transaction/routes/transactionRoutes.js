const express = require('express');
const router = express.Router();
const verifyToken = require('../../../../utils/verifyToken');
const transactionController = require('../controllers/transactionController');

// All transaction routes require authentication
router.use(verifyToken);

// Test endpoint
router.get('/test', transactionController.testTransactionRoutes);
router.get('/test/:transactionId', transactionController.testTransactionRoutes);

// Debug endpoint
router.get('/debug/:transactionId', transactionController.debugTransactionLookup);

// Get transaction status and progress
router.get('/:transactionId/status', transactionController.getTransactionStatus);

// Get available status transitions for a transaction
router.get('/:transactionId/transitions', transactionController.getAvailableTransitions);

// Update transaction status
router.put('/:transactionId/status', transactionController.updateTransactionStatus);

// Bulk update transaction statuses (admin/seller tools)
router.put('/bulk/status', transactionController.bulkUpdateTransactionStatus);

module.exports = router;
