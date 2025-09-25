const express = require('express');
const router = express.Router();
const verifyToken = require('../../../../utils/verifyToken');
const bankAccountController = require('../controllers/bankAccountController');

// Test route (no auth required)
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Bank account routes are working!' });
});

// All bank account routes require authentication
router.use(verifyToken);

// Bank account management routes
router.post('/add', bankAccountController.addBankAccount);
router.get('/', bankAccountController.getUserBankAccounts);
router.get('/default', bankAccountController.getDefaultBankAccount);
router.put('/:accountId/set-default', bankAccountController.setDefaultBankAccount);
router.delete('/:accountId', bankAccountController.deleteBankAccount);

module.exports = router;
