// const jwt = require('jsonwebtoken');
// const {generateAccessToken,generateRefreshToken} = require('../../../../utils/tokenGenerate')

// exports.success = async (req, res) => {
//   const user = req.user;

//   if (!user) {
//     return res.redirect('/api/user/auth/error');
//   }

//   //   console.log('User logged in successfully:', {
//   //       id: user._id,
//   //       email: user.email,
//   //       firstName: user.firstName,
//   //       lastName:user.lastName
//   // });


// //     const token = jwt.sign(
// //         { id: user._id, email: user.email },
// //             process.env.JWT_SECRET,
// //         { expiresIn: process.env.JWT_EXPIRES_IN }
// //   );

//     const accessToken = generateAccessToken(user);
//     const refreshToken = generateRefreshToken(user);


// // Save the refresh token to the user
//     user.refreshToken = refreshToken;
//     await user.save();
//     res.redirect(`http://localhost:5173/auth-callback?token=${accessToken}`);


// //     res.status(200).json({
// //         message: 'Login successful',
// //         user: {
// //         id: user._id,
// //         email: user.email,
// //         firstName: user.firstName,
// //         lastName:user.lastName,
// //         loginWithGoogle: user.loginWithGoogle,
// //         loginWithFacebook: user.loginWithFacebook
// //     },
// //     accessToken,
// //     refreshToken,

// //  });
// };


// // exports.success = (req, res) => {
// //   const user = req.user;

// //   if (!user) return res.redirect('/api/user/auth/error');

// //   const jwt = require('jsonwebtoken');
// //   const token = jwt.sign(
// //     { id: user._id, email: user.email },
// //     process.env.JWT_SECRET,
// //     { expiresIn: process.env.JWT_EXPIRES_IN }
// //   );

// //   res.redirect(`http://localhost:3000/social-login-success?token=${token}`);
// // //   console.log("Logged In");
// //   res.json({Data:User})

// // };

// exports.error = (req, res) => {
//   res.status(401).json({ success: false, message: 'Authentication Failed' });
// };

// exports.signout = (req, res) => {
//   req.logout(err => {
//     if (err) return res.status(500).json({ success: false, message: 'Logout failed' });
//     res.json({ success: true, message: 'Logged out successfully' });
//   });
// };



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
     res.redirect(
      `${process.env.FRONTEND_URL}/auth-callback?accessToken=${accessToken}&refreshToken=${refreshToken}&user=${userData}`
    );
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