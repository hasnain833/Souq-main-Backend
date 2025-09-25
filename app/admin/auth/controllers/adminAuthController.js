const Admin = require('../../../../db/models/adminModel');
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { generateAccessToken, generateRefreshToken } = require('../../../../utils/tokenGenerate');
// const createUploader = require('../../../../utils/upload');

// Admin Signup
exports.signup = async (req, res) => {
  try {
    const { firstName, lastName, email, password, role } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !password) {
      return errorResponse(res, 'All fields are required', 400);
    }

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return errorResponse(res, 'Admin with this email already exists', 400);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create new admin
    const newAdmin = new Admin({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      role: role || 'admin'
    });

    await newAdmin.save();

    // Generate tokens
    const accessToken = generateAccessToken(newAdmin);
    const refreshToken = generateRefreshToken(newAdmin);

    // Save refresh token
    newAdmin.refreshToken = refreshToken;
    await newAdmin.save();

    return successResponse(res, 'Admin registered successfully', {
      accessToken,
      refreshToken,
      admin: {
        id: newAdmin._id,
        firstName: newAdmin.firstName,
        lastName: newAdmin.lastName,
        email: newAdmin.email,
        role: newAdmin.role,
        permissions: newAdmin.permissions,
        profile: newAdmin.profile  // Include profile image URL
      }
    }, 201);

  } catch (error) {
    console.error('Admin signup error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Admin Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return errorResponse(res, 'Email and password are required', 400);
    }

    // Find admin by email
    const admin = await Admin.findOne({ email, isActive: true });
    if (!admin) {
      return errorResponse(res, 'Invalid credentials', 401);
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return errorResponse(res, 'Invalid credentials', 401);
    }

    // Generate tokens
    const accessToken = generateAccessToken(admin);
    const refreshToken = generateRefreshToken(admin);

    // Update admin login info
    admin.refreshToken = refreshToken;
    admin.lastLoginAt = new Date();
    await admin.save();

    return successResponse(res, 'Login successful', {
      accessToken,
      refreshToken,
      admin: {
        id: admin._id,
        firstName: admin.firstName,
        lastName: admin.lastName,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
        profile: admin.profile  // Include profile image URL
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Admin Logout
exports.logout = async (req, res) => {
  try {
    const adminId = req.admin._id;

    // Clear refresh token
    await Admin.findByIdAndUpdate(adminId, { refreshToken: null });

    return successResponse(res, 'Logout successful');

  } catch (error) {
    console.error('Admin logout error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Refresh Token
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return errorResponse(res, 'Refresh token is required', 400);
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
    // Find admin with this refresh token
    const admin = await Admin.findOne({ 
      _id: decoded.id, 
      refreshToken,
      isActive: true 
    });

    if (!admin) {
      return errorResponse(res, 'Invalid refresh token', 401);
    }

    // Generate new tokens
    const newAccessToken = generateAccessToken(admin);
    const newRefreshToken = generateRefreshToken(admin);

    // Update refresh token
    admin.refreshToken = newRefreshToken;
    await admin.save();

    return successResponse(res, 'Token refreshed successfully', {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    });

  } catch (error) {
    console.error('Refresh token error:', error);
    return errorResponse(res, 'Invalid refresh token', 401);
  }
};

// Get Admin Profile
exports.getProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id).select('-password -refreshToken');

    if (!admin) {
      return errorResponse(res, 'Admin not found', 404);
    }

    return successResponse(res, 'Profile retrieved successfully', { admin });

  } catch (error) {
    console.error('Get admin profile error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Update Admin Profile
exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName } = req.body;
    const adminId = req.admin._id;

    const updatedAdmin = await Admin.findByIdAndUpdate(
      adminId,
      { firstName, lastName },
      { new: true, select: '-password -refreshToken' }
    );

    if (!updatedAdmin) {
      return errorResponse(res, 'Admin not found', 404);
    }

    return successResponse(res, 'Profile updated successfully', { admin: updatedAdmin });

  } catch (error) {
    console.error('Update admin profile error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Change Password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const adminId = req.admin._id;

    if (!currentPassword || !newPassword) {
      return errorResponse(res, 'Current password and new password are required', 400);
    }

    // Find admin
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return errorResponse(res, 'Admin not found', 404);
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, admin.password);
    if (!isCurrentPasswordValid) {
      return errorResponse(res, 'Current password is incorrect', 400);
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    admin.password = hashedNewPassword;
    await admin.save();

    return successResponse(res, 'Password changed successfully');

  } catch (error) {
    console.error('Change password error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Upload Profile Picture
exports.uploadProfilePicture = async (req, res) => {
  try {
    const adminId = req.admin._id;

    if (!req.file) {
      return errorResponse(res, 'No image file provided', 400);
    }

    // Update admin profile with image URL
    const updatedAdmin = await Admin.findByIdAndUpdate(
      adminId,
      { profile: req.file.path }, // Cloudinary URL
      { new: true, select: '-password -refreshToken' }
    );

    if (!updatedAdmin) {
      return errorResponse(res, 'Admin not found', 404);
    }

    return successResponse(res, 'Profile picture uploaded successfully', {
      admin: updatedAdmin,
      profileUrl: req.file.path
    });

  } catch (error) {
    console.error('Upload profile picture error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Remove Profile Picture
exports.removeProfilePicture = async (req, res) => {
  try {
    const adminId = req.admin._id;

    // Update admin profile to remove image
    const updatedAdmin = await Admin.findByIdAndUpdate(
      adminId,
      { profile: null },
      { new: true, select: '-password -refreshToken' }
    );

    if (!updatedAdmin) {
      return errorResponse(res, 'Admin not found', 404);
    }

    return successResponse(res, 'Profile picture removed successfully', {
      admin: updatedAdmin
    });

  } catch (error) {
    console.error('Remove profile picture error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};
