const express = require('express');
const router = express.Router();
const verifyToken = require('../../../../utils/verifyToken');
const paypalAccountController = require('../controllers/paypalAccountController');

// Test route (no auth required)
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'PayPal account routes are working!' });
});

// All PayPal account routes require authentication
router.use(verifyToken);

// PayPal account management routes
router.post('/add', paypalAccountController.addPaypalAccount);
router.get('/', paypalAccountController.getUserPaypalAccounts);
router.get('/connection-status', paypalAccountController.getConnectionStatus);
router.get('/default', paypalAccountController.getDefaultPaypalAccount);
router.put('/:accountId/set-default', paypalAccountController.setDefaultPaypalAccount);
router.post('/:accountId/verify', paypalAccountController.verifyPaypalAccount);
router.delete('/:accountId', paypalAccountController.deletePaypalAccount);

module.exports = router;