const jwt = require("jsonwebtoken");
const Admin = require("../../../../db/models/adminModel");
const { errorResponse } = require("../../../../utils/responseHandler");

// Verify admin token
exports.verifyAdminToken = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return errorResponse(res, "Access token is required", 401);
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find admin
    const admin = await Admin.findById(decoded.id).select(
      "-password -refreshToken"
    );

    if (!admin || !admin.isActive) {
      return errorResponse(res, "Invalid token or admin not found", 401);
    }

    req.admin = admin;
    next();
  } catch (error) {
    console.error("Admin token verification error:", error);
    return errorResponse(res, "Invalid token", 401);
  }
};

// Check admin permissions
exports.checkPermission = (resource, action) => {
  return (req, res, next) => {
    try {
      const admin = req.admin;

      if (!admin) {
        return errorResponse(res, "Admin authentication required", 401);
      }

      // Super admin has all permissions
      if (admin.role === "super_admin") {
        return next();
      }

      // Check specific permission
      if (admin.permissions[resource] && admin.permissions[resource][action]) {
        return next();
      }

      return errorResponse(res, "Insufficient permissions", 403);
    } catch (error) {
      console.error("Permission check error:", error);
      return errorResponse(res, "Permission check failed", 500);
    }
  };
};

// Check admin role
exports.checkRole = (roles) => {
  return (req, res, next) => {
    try {
      const admin = req.admin;

      if (!admin) {
        return errorResponse(res, "Admin authentication required", 401);
      }

      // Convert single role to array
      const allowedRoles = Array.isArray(roles) ? roles : [roles];

      if (allowedRoles.includes(admin.role)) {
        return next();
      }

      return errorResponse(res, "Insufficient role permissions", 403);
    } catch (error) {
      console.error("Role check error:", error);
      return errorResponse(res, "Role check failed", 500);
    }
  };
};

// Optional admin authentication (for public endpoints that can show different data for admins)
exports.optionalAdminAuth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      req.admin = null;
      return next();
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find admin
    const admin = await Admin.findById(decoded.id).select(
      "-password -refreshToken"
    );

    if (admin && admin.isActive) {
      req.admin = admin;
    } else {
      req.admin = null;
    }

    next();
  } catch (error) {
    // If token is invalid, continue without admin
    req.admin = null;
    next();
  }
};
