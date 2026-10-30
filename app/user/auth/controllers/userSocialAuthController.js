const jwt = require('jsonwebtoken');
const {
  generateAccessToken,
  generateRefreshToken
} = require('../../../../utils/tokenGenerate');
const createSession = require('../../../../utils/createSession');

exports.success = async (req, res) => {
  const user = req.user;

  if (!user) {
    return res.redirect('/api/user/auth/error');
  }

  try {
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Save refresh token to the user in DB
    user.refreshToken = refreshToken;
    await user.save();

    await createSession(req, user._id, accessToken);

    // Prepare user data to send in the URL (safe encoding)
    const userData = encodeURIComponent(JSON.stringify({
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profile: user.profile,
      loginWithGoogle: user.loginWithGoogle,
      loginWithFacebook: user.loginWithFacebook
    }));

    // Redirect to frontend with tokens and user
    const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';
    const redirectUrl = `${frontendUrl}/auth-callback?accessToken=${accessToken}&refreshToken=${refreshToken}&user=${userData}`;
    console.log('🔗 Redirecting to frontend:', redirectUrl);
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('OAuth login error:', error);
    res.redirect('/api/user/auth/error');
  }
};

exports.error = (req, res) => {
  res.status(401).json({ success: false, message: 'Authentication Failed' });
};

exports.signout = (req, res) => {
  req.logout(err => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Logout failed' });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });
};