const multer = require("multer");
const path = require("path");

// Uploader configured to keep files in memory so controllers can persist buffers to MongoDB
const createUploader = (folderName = "default") => {
  const storage = multer.memoryStorage();

  const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|jfif|webp/i;
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedTypes.test(ext)) {
      return cb(
        new Error(
          "Only image files (jpeg, jpg, png, gif, jfif, webp) are allowed!"
        ),
        false
      );
    }
    cb(null, true);
  };

  return multer({
    storage,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
      files: 10,
    },
    fileFilter,
  });
};

module.exports = createUploader;
