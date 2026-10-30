const express = require('express');
const router = express.Router();
const sessionController = require('../controller/sessionController');
const verifyToken = require('../../../../utils/verifyToken');

// ✅ Use your JWT middleware
router.get('/login-activity', verifyToken, sessionController.getLoginActivity);
router.post('/logout-session', verifyToken, sessionController.logoutSession);

module.exports = router;
