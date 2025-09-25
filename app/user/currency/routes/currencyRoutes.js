const express = require('express');
const router = express.Router();
const verifyToken = require('../../../../utils/verifyToken');
const currencyController = require('../controllers/currencyController');

// Public routes (no authentication required)
router.get('/supported', currencyController.getSupportedCurrencies);
router.get('/rates', currencyController.getExchangeRates);
router.get('/:currencyCode', currencyController.getCurrency);

// Protected routes (require authentication)
router.use(verifyToken);

// Currency conversion
router.post('/convert', currencyController.convertCurrency);
router.post('/convert-multiple', currencyController.convertMultiple);

// Currency formatting
router.post('/format', currencyController.formatCurrency);

// Currency validation
router.post('/validate', currencyController.validateCurrency);

// Currency statistics (admin/user)
router.get('/admin/statistics', currencyController.getCurrencyStatistics);

// Manual rate update (admin only - you might want to add admin middleware)
router.post('/admin/update-rates', currencyController.updateExchangeRates);

module.exports = router;
