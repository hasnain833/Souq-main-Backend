const multer = require("multer");
const path = require("path");
const fs = require("fs");

const createUploader = (folderName) => {
  const uploadDir = path.join(__dirname, `../uploads/${folderName}`);
  fs.mkdirSync(uploadDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const ext = path.extname(file.originalname);
      const filename = `${req.user.id}-${Date.now()}${ext}`;
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
