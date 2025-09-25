const jwt = require('jsonwebtoken');
const User = require('../db/models/userModel');

const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');

      if (user && !user.deletedAt) {
        req.user = user;
      } else {
        req.user = null;
      }
    } catch (err) {
      req.user = null;
    }
  } else {
    req.user = null;
  }

  next();
};

module.exports = optionalAuth;


// middlewares/optionalAuth.js
// const jwt = require('jsonwebtoken');
// const User = require('../db/models/userModel');

// const optionalAuth = async (req, res, next) => {
//   const authHeader = req.headers.authorization;
  
//   if (authHeader && authHeader.startsWith('Bearer')) {
//     const token = authHeader.split(' ')[1];
//     try {
//       const decoded = jwt.verify(token, process.env.JWT_SECRET);
//       const user = await User.findById(decoded.userId);
//       req.user = user || null;
//     } catch (err) {
//       req.user = null; // invalid token → treat as guest
//     }
//   } else {
//     req.user = null; // no token → treat as guest
//   }

//   next();
// };

// module.exports = optionalAuth;
