const aws = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');

// Configure AWS from env
// Required envs: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_BUCKET_NAME
aws.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new aws.S3();

const allowedImage = /jpeg|jpg|png|gif|jfif|webp/i;

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedImage.test(ext)) {
    return cb(new Error('Only image files (jpeg, jpg, png, gif, jfif, webp) are allowed!'));
  }
  cb(null, true);
}

// Reusable S3 uploader factory
// Usage: const upload = createS3Uploader('profile'); router.post(..., upload.single('profile'), ...)
function createS3Uploader(folder = 'uploads') {
  const bucket = process.env.AWS_BUCKET_NAME;
  if (!bucket) {
    throw new Error('Missing AWS_BUCKET_NAME environment variable');
  }

  const storage = multerS3({
    s3,
    bucket,
    acl: 'public-read',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      const timestamp = Date.now();
      const safeName = path.basename(file.originalname).replace(/\s+/g, '_');
      const uploadPath = `${folder.replace(/^\/+|\/+$/g, '')}/${timestamp}_${safeName}`;
      cb(null, uploadPath);
    },
  });

  return multer({
    storage,
    fileFilter,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB per file
      files: 10,
    },
  });
}

module.exports = createS3Uploader;
