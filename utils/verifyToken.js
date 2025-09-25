const jwt = require('jsonwebtoken');
const User = require('../db/models/userModel');

const verifyToken = async (req, res, next) => {
  try {
    console.log('🔍 Token verification - Headers:', {
      authorization: req.headers.authorization ? 'Present' : 'Missing',
      userAgent: req.headers['user-agent']?.substring(0, 50) + '...',
      url: req.url
    });

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log('❌ Token verification failed - No valid auth header');
      console.log('Auth header:', authHeader);
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    req.token = token;
    console.log('🔑 Token verification - Token extracted:', token ? `${token.substring(0, 20)}...` : 'No token');

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Token verification - Token decoded successfully:', { userId: decoded.id });

    const user = await User.findById(decoded.id).select("-password -otp -__v");
    if (!user) {
      console.log('❌ Token verification failed - User not found:', decoded.id);
      return res.status(401).json({ message: "User not found" });
    }

    // Check if user is suspended
    if (user.deletedAt) {
      console.log('❌ Token verification failed - User is suspended:', decoded.id);
      return res.status(403).json({ message: "Account suspended. Please contact support." });
    }

    console.log('✅ Token verification successful - User found:', {
      userId: user._id,
      email: user.email,
      name: user.name
    });

    req.user = user;
    next();
  } catch (err) {
    console.log('❌ Token verification error:', {
      error: err.message,
      name: err.name,
      url: req.url
    });
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

module.exports = verifyToken;


// const verifyToken = async (req, res, next) => {
//   try {
//     const authHeader = req.headers.authorization;

//     if (!authHeader || !authHeader.startsWith("Bearer ")) {
//       console.log("❌ No token found in header");
//       return res.status(401).json({ message: "Unauthorized" });
//     }

//     const token = authHeader.split(" ")[1];
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     console.log("✅ Token decoded:", decoded);

//     const user = await User.findById(decoded.id).select("-password -otp -__v");


//     if (!user) {
//       console.log("❌ User not found with id:", decoded.id);
//       return res.status(401).json({ message: "Unauthorized" });
//     }

//     console.log("✅ User found:", user.email);
//     req.user = user;
//     next();
//   } catch (err) {
//     console.error("❌ Token verification error:", err.message);
//     res.status(401).json({ message: "Unauthorized" });
//   }
// };

// module.exports = verifyToken; 