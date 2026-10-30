
const express = require('express');
const router = express.Router();
const { getSuggestions } = require('../controllers/suggestionController');

// Matches: /api/user/suggestions
router.get('/', getSuggestions);

module.exports = router;
