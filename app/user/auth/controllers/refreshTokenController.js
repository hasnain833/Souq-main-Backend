const { generateAccessToken,generateRefreshToken } = require("../../../../utils/tokenGenerate")
const User = require('../../../../db/models/userModel')
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');
const jwt = require('jsonwebtoken');


exports.refreshAccessToken = async (req, res) => {
  const { token } = req.body;
  if (!token) return errorResponse(res, 'Refresh token required', 400);

  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

    const user = await User.findById(decoded.id);
    // console.log("log user",user);

    if (!user || user.refreshToken !== token) {
      return errorResponse(res, 'Invalid or expired refresh token', 403);
    }

    // Check if user is suspended
    if (user.deletedAt) {
      return errorResponse(res, 'Account suspended. Please contact support.', 403);
    }

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    // Update refresh token in DB
    user.refreshToken = newRefreshToken;
    await user.save();

    return successResponse(res, 'Token refreshed successfully', {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    });
  } catch (err) {
    return errorResponse(res, 'Token refresh failed', 403, err.message);
  }
};

