const express = require('express');
const router = express.Router();
const verifyToken = require('../../../../utils/verifyToken');
const offerController = require('../controllers/offerController');

// All offer routes require authentication
router.use(verifyToken);

// Create offer for a chat
router.post('/chat/:chatId', offerController.createOffer);

// Get offer details
router.get('/:offerId', offerController.getOffer);

// Accept offer (seller only)
router.patch('/:offerId/accept', offerController.acceptOffer);

// Decline offer (seller only)
router.patch('/:offerId/decline', offerController.declineOffer);

// Get active offer for a chat
router.get('/chat/:chatId/active', offerController.getChatOffer);

// Manual expire offers (for testing)
router.post('/expire', offerController.expireOffers);

module.exports = router;
