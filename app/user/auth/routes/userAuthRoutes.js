const express = require('express');
const router = express.Router();
const passport = require('passport')
require('../../../../utils/passport')
const userAuthController = require('../controllers/userAuthController');
const refreshController = require('../controllers/refreshTokenController')

router.post('/signup', userAuthController.signup)
router.post('/verify-email', userAuthController.verifyEmail)
router.post('/verify-phone', userAuthController.verifyPhone);
router.post('/verify-phone/otp', userAuthController.verifyPhoneOtp);
router.post('/change-password', userAuthController.changePassword);
router.post('/login', userAuthController.login)
router.post('/forgot-password', userAuthController.forgotPassword);
router.post('/reset-password/:token', userAuthController.resetPassword);
router.post('/logout', userAuthController.logout);
router.post('/resend-verification', userAuthController.resendVerification);

// Test email functionality (Development only)
router.post('/test-email', userAuthController.testEmail);

// Email diagnostics (Development only)
router.get('/email-diagnostics', userAuthController.emailDiagnostics);

//Refresh-Token Routes
router.post('/refresh-token', refreshController.refreshAccessToken);


module.exports = router;

