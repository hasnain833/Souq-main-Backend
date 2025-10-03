const multer = require("multer");
const path = require("path");
const fs = require("fs");

const createUploader = (folderName) => {
  const isServerless = !!process.env.VERCEL || process.env.MINIMAL_MODE === 'true';

  if (isServerless) {
    // In Vercel/serverless, filesystem is read-only. Use memory storage or external providers.
    const storage = multer.memoryStorage();
    const fileFilter = (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif|jfif/;
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowedTypes.test(ext)) {
        cb(null, true);
      } else {
        cb(new Error("Only image files are allowed!"), false);
      }
    };
    return multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter });
  }

  const uploadDir = path.join(__dirname, `../uploads/${folderName}`);
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
  } catch (e) {
    // If directory cannot be created, fallback to memory storage to avoid crashing
    const storage = multer.memoryStorage();
    return multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });
  }

  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const ext = path.extname(file.originalname);
      const userId = req.user?.id || 'guest';
      const filename = `${userId}-${Date.now()}${ext}`;
      cb(null, filename);
    },
  });

  const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|jfif/;
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.test(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  };

  return multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter,
  });
};

module.exports = createUploader;

// // upload.js
// const multer = require('multer');
// const { CloudinaryStorage } = require('multer-storage-cloudinary');
// const cloudinary = require('./cloudinary');

// const createUploader = (folderName = 'default') => {
//   const storage = new CloudinaryStorage({
//     cloudinary: cloudinary,
//     params: {
//       folder: `uploads/${folderName}`,  // cloud folder path
//       allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'jfif', 'webp'], // ✅ added webp
//       public_id: (req, file) => {
//         const ext = file.originalname.split('.').pop();
//         return `${req.user?.id || 'guest'}-${Date.now()}`;
//       },
//     },
//   });

//   return multer({
//     storage,
//     limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
//     fileFilter: (req, file, cb) => {
//       const allowedTypes = /jpeg|jpg|png|gif|jfif|webp/; // ✅ added webp
//       const ext = file.originalname.split('.').pop().toLowerCase();
//       if (allowedTypes.test(ext)) {
//         cb(null, true);
//       } else {
//         cb(new Error('Only jpg, jpeg, png, gif, jfif, or webp files are allowed!'), false);
//       }
//     }
//   });
// };

// module.exports = createUploader;
