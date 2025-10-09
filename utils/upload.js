const multer = require("multer");
const path = require("path");
const fs = require("fs");

const createUploader = (folderName = "default") => {
  // ✅ Use memory storage for serverless (Vercel, etc.)
  if (process.env.VERCEL || process.env.MINIMAL_MODE === "true") {
    const storage = multer.memoryStorage();
    const fileFilter = (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif|jfif|webp/i;
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowedTypes.test(ext)) {
        cb(null, true);
      } else {
        cb(
          new Error(
            "Only image files (jpeg, jpg, png, gif, jfif, webp) are allowed!"
          ),
          false
        );
      }
    };
    return multer({
      storage,
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
        files: 10, // Max 10 files
      },
      fileFilter,
    });
  }

  // ✅ For non-serverless: use disk storage
  const uploadDir = path.join(process.cwd(), "uploads", folderName);

  // Ensure upload directory exists
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
  } catch (error) {
    console.error("Failed to create upload directory:", error);
    // Fallback to memory storage
    return multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
        files: 10,
      },
    });
  }

  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      // ✅ FIX 1: Save directly into /uploads/products (no nested products/products)
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      // ✅ FIX 2: Keep original filename (sanitized), no giant timestamp
      const sanitized = file.originalname.replace(/[^\w\d.-]/g, "_");

      // Option A: Save only with original name
      // cb(null, sanitized);

      // Option B (safer): Add small unique suffix (last 6 digits of timestamp)
      const uniqueSuffix = Date.now().toString().slice(-6);
      cb(null, `${uniqueSuffix}-${sanitized}`);
    },
  });

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
