const jwt = require('jsonwebtoken');
const User = require('../db/models/userModel');

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.warn('Token verification: missing Bearer authorization header');
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    req.token = token;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("-password -otp -__v");
    if (!user) {
      console.warn('Token verification: user not found', decoded.id);
      return res.status(401).json({ message: "User not found" });
    }

    // Check if user is suspended (check both status and deletedAt fields)
    // Both fields are kept in sync: status='suspended' and deletedAt is set when suspended
    if (user.status === 'suspended' || user.deletedAt) {
      console.warn('Token verification: user suspended', decoded.id);
      return res.status(403).json({ message: "Account suspended. Please contact support." });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Token verification error', err.message);
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