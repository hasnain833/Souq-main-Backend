const createUploader = require('../../../../utils/upload');

// Admin profile picture uploader - reuse existing upload utility
// The upload utility will use req.user.id, so we need to set req.user from req.admin
// Lazily create uploader inside the middleware to avoid FS access at import time

// Middleware to set req.user from req.admin for upload compatibility
const setUserFromAdmin = (req, res, next) => {
  if (req.admin) {
    // Set req.user from req.admin for upload utility compatibility
    req.user = {
      id: req.admin._id,
      _id: req.admin._id
    };
  }
  next();
};

// Combined middleware for admin profile upload
const uploadAdminProfile = [
  setUserFromAdmin,
  (req, res, next) => {
    const uploader = createUploader('admin-profiles');
    uploader.single('profile')(req, res, (err) => {
      if (err) return next(err);
      next();
    });
  }
];

// Middleware for single profile picture upload
exports.uploadAdminProfile = uploadAdminProfile;

// Error handling middleware for multer errors
exports.handleUploadError = (error, req, res, next) => {
  if (error) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 5MB.',
        error: 'FILE_TOO_LARGE'
      });
    }
    
    if (error.message && error.message.includes('Only')) {
      return res.status(400).json({
        success: false,
        message: error.message,
        error: 'INVALID_FILE_TYPE'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'File upload failed',
      error: error.message
    });
  }
  next();
};