const express = require('express');
const router = express.Router();
const verifyToken = require('../../../../utils/verifyToken');
const optionalAuth = require('../../../../utils/optionalAuth');
const ratingController = require('../controllers/ratingController');

// All rating routes require authentication
// router.use(verifyToken);

// Submit a rating for a transaction
router.post('/transaction/:transactionId', verifyToken, ratingController.submitRating);

// Submit a rating for a product (without transaction)
router.post('/product/:productId', verifyToken, ratingController.submitProductRating);

// Get existing rating for a transaction by current user
router.get('/transaction/:transactionId', verifyToken, ratingController.getTransactionRating);

// Get ratings for a specific user (received or given)
router.get('/user/:userId', optionalAuth, ratingController.getUserRatings);

// Get ratings for a specific product
router.get('/product/:productId', optionalAuth, ratingController.getProductRatings);

// Get pending ratings for the authenticated user
router.get('/pending', verifyToken, ratingController.getPendingRatings);

// Check if user can rate a specific transaction
router.get('/transaction/:transactionId/can-rate', verifyToken, ratingController.canRateTransaction);

// Debug endpoint for user ID issues
router.get('/debug/user-ids', verifyToken, ratingController.debugUserIds);

module.exports = router;
