const { S3Client } = require("@aws-sdk/client-s3");
const multer = require("multer");
const multerS3 = require("multer-s3");
const path = require("path");

// AWS Configuration
const s3Client = new S3Client({
  region: process.env.AWS_DEFAULT_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const allowedImageTypes = /jpeg|jpg|png|gif|webp|jfif/i;

const uploadS3 = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: process.env.AWS_BUCKET,
    // Remove ACL requirement - let S3 bucket handle permissions
    // acl: "public-read",
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const timestamp = Date.now();
      const safeName = file.originalname.replace(/\s+/g, "_");
      const key = `uploads/${timestamp}_${safeName}`;
      console.log('S3 Upload Key:', key);
      cb(null, key);
    },
    metadata: (req, file, cb) => {
      cb(null, { fieldName: file.fieldname });
    }
  }),
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    console.log('File upload attempt:', { 
      originalname: file.originalname, 
      mimetype: file.mimetype, 
      ext 
    });
    
    if (!allowedImageTypes.test(ext)) {
      console.error('Invalid file type:', ext);
      return cb(new Error("Only image files (JPEG, JPG, PNG, GIF, WEBP, JFIF) are allowed!"));
    }
    cb(null, true);
  },
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB max per file
    files: 10 // Max 10 files
  },
});

// Add error handling middleware
uploadS3.errorHandler = (error, req, res, next) => {
  console.error('S3 Upload Error:', error);
  
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File size too large. Maximum size is 10MB.',
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
  
  if (error.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({
      success: false,
      message: 'Too many files. Maximum is 10 files.',
      error: 'TOO_MANY_FILES'
    });
  }
  
  return res.status(500).json({
    success: false,
    message: 'File upload failed',
    error: error.message || 'Unknown upload error'
  });
};

module.exports = uploadS3;
