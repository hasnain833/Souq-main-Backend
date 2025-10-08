const express = require('express');
const router = express.Router();
const paymentMethodController = require('../controllers/paymentMethodController');
const verifyToken = require('../../../../utils/verifyToken');

// All payment method routes require authentication
router.use(verifyToken);
router.post('/cards', paymentMethodController.addCard);
router.post('/bank-accounts', paymentMethodController.addBankAccount);
router.get('/', paymentMethodController.getPaymentMethods);
router.put('/:paymentMethodId/default', paymentMethodController.setDefaultPaymentMethod);
router.delete('/:paymentMethodId', paymentMethodController.deletePaymentMethod);

module.exports = router;
