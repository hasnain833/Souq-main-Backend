const uploadS3 = require('../../../../middlewares/s3Uploader');

// Middleware for single profile picture upload
const uploadAdminProfile = uploadS3.single('profile');

// Error handling middleware for multer errors
const handleUploadError = (error, req, res, next) => {
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

module.exports = {
  uploadAdminProfile,
  handleUploadError
};
