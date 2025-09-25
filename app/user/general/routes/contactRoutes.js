const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');

// POST /api/user/general/contact - Create a new contact message
router.post('/', contactController.createContactMessage);

module.exports = router;