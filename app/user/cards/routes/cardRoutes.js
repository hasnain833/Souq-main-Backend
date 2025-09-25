const express = require('express');
const router = express.Router();
const verifyToken = require('../../../../utils/verifyToken');
const cardController = require('../controllers/cardController');

// Test route (no auth required)
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Card routes are working!' });
});

// Test auth route (with auth required)
router.get('/test-auth', verifyToken, (req, res) => {
  res.json({
    success: true,
    message: 'Authentication is working!',
    user: {
      id: req.user._id,
      email: req.user.email,
      name: req.user.name
    }
  });
});

// All card routes require authentication
router.use(verifyToken);

// Card verification routes
router.post('/verify', cardController.verifyCard);
router.post('/verify-and-save', cardController.verifyAndSaveCard);

// Card management routes
router.get('/', cardController.getUserCards);
router.get('/default', cardController.getDefaultCard);
router.put('/:cardId/set-default', cardController.setDefaultCard);
router.delete('/:cardId', cardController.deleteCard);

// Payment-specific routes
router.get('/:cardId/payment-details', cardController.getCardPaymentDetails);

module.exports = router;
