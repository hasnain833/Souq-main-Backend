const express = require('express');
const router = express.Router();
const verifyToken = require('../../../../utils/verifyToken');
const { createOrder, captureOrder } = require('../controllers/paypalRestController');

// Create PayPal order (sandbox by default). Requires amount and optional metadata.
router.post('/create-order', verifyToken, createOrder);

// Capture an approved PayPal order
router.post('/capture-order', verifyToken, captureOrder);

module.exports = router;


