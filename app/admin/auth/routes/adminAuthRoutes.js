const express = require('express');
const router = express.Router();
const adminAuthController = require('../controllers/adminAuthController');
const { verifyAdminToken } = require('../middleware/adminAuthMiddleware');
const { uploadAdminProfile, handleUploadError } = require('../middleware/adminUploadMiddleware');

// Public routes
router.post('/signup', adminAuthController.signup);
router.post('/login', adminAuthController.login);
router.post('/refresh-token', adminAuthController.refreshToken);

// Protected routes
router.post('/logout', verifyAdminToken, adminAuthController.logout);
router.get('/profile', verifyAdminToken, adminAuthController.getProfile);
router.put('/profile', verifyAdminToken, adminAuthController.updateProfile);
router.put('/change-password', verifyAdminToken, adminAuthController.changePassword);

// Profile picture routes
router.post('/upload-profile', 
  verifyAdminToken, 
  uploadAdminProfile, 
  handleUploadError, 
  adminAuthController.uploadProfilePicture
);
router.delete('/remove-profile', verifyAdminToken, adminAuthController.removeProfilePicture);

module.exports = router;
