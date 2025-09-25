
const User = require('../../../../db/models/userModel');
const Session = require('../../../../db/models/sessionModel');
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sendMail = require('../../../../utils/senMail')
const sendSMS = require('../../../../utils/sendSMS')
const { generateAccessToken, generateRefreshToken } = require('../../../../utils/tokenGenerate')
const createSession = require('../../../../utils//createSession');
const { getVerificationEmailHTML } = require('../../../../utils/emailTemplates');
const { getForgotPasswordEmailHTML } = require('../../../../utils/forgotPasswordEmailTemplate');
const { getResendVerificationEmailHTML } = require('../../../../utils/resendVerificationEmailTemplate');

exports.signup = async (req, res) => {
  try {
    const { fullName, userName, email, password } = req.body;
    const [firstName, ...lastParts] = fullName.trim().split(' ');
    const lastName = lastParts.join(' ');

    const existingUser = await User.findOne({ $or: [{ email }, { userName }] });
    if (existingUser) {
      return errorResponse(res, 'Email or username already exists', 400);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const isEmailVerificationEnabled = process.env.EMAIL_VERIFICATION_ENABLED === 'true';
    const otp = isEmailVerificationEnabled
      ? Math.floor(100000 + Math.random() * 900000).toString()
      : null;

    const newUser = new User({
      firstName,
      lastName,
      userName,
      email,
      password: hashedPassword,
      otp: isEmailVerificationEnabled ? otp : null,
      otpCreatedAt: isEmailVerificationEnabled ? new Date() : null,
      emailVerifiedAt: isEmailVerificationEnabled ? null : new Date()
    });

    const accessToken = generateAccessToken(newUser);
    const refreshToken = generateRefreshToken(newUser);
    newUser.refreshToken = refreshToken;
    await newUser.save();

    let signupMailInfo;
    if (isEmailVerificationEnabled) {
      // Send verification email
      const html = getVerificationEmailHTML(otp);
      try {
        const mailInfo = await sendMail(email, 'Verify Your Email', html);
        console.log('✅ Verification email sent successfully');
        if (mailInfo?.previewUrl) {
          console.log('🔗 Email preview URL:', mailInfo.previewUrl);
        }
        signupMailInfo = mailInfo;
      } catch (emailError) {
        console.error('❌ Failed to send verification email:', emailError.message);
        console.log('⚠️ Continuing with signup despite email failure');
      }
    }

    return successResponse(res, 'User registered successfully', {
      accessToken,
      refreshToken,
      user: { id: newUser._id, email: newUser.email, userName: newUser.userName },
      emailSent: !!signupMailInfo,
      previewUrl: signupMailInfo?.previewUrl,
      emailVerificationEnabled: isEmailVerificationEnabled
    }, 201);


  } catch (err) {
    console.error('❌ Signup error:', err);
    return errorResponse(res, 'Signup failed', 500, err.message);
  }
};

exports.resendVerification = async (req, res) => {
  try {
    const isEmailVerificationEnabled = process.env.EMAIL_VERIFICATION_ENABLED === 'true';
    if (!isEmailVerificationEnabled) {
      return errorResponse(res, 'Email verification is disabled', 400);
    }
    const { currentEmail, newEmail } = req.body;

    if (!currentEmail) {
      return errorResponse(res, 'Current email is required', 400);
    }

    const user = await User.findOne({ email: currentEmail });

    if (!user) {
      return errorResponse(res, 'User with this email does not exist', 404);
    }

    if (user.isVerified) {
      return errorResponse(res, 'Email is already verified', 400);
    }

    // If user wants to change email
    if (newEmail && newEmail !== currentEmail) {
      const emailExists = await User.findOne({ email: newEmail });
      if (emailExists) {
        return errorResponse(res, 'New email already in use', 400);
      }

      user.email = newEmail; // update to new email
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpCreatedAt = new Date(); // optional for expiry logic

    await user.save();

    // Send email
    const html = getResendVerificationEmailHTML(otp);

    try {
      const mailInfo = await sendMail(user.email, 'Verify Your Email', html);
      console.log('✅ OTP sent to:', user.email);
      if (mailInfo?.previewUrl) {
        console.log('🔗 Email preview URL:', mailInfo.previewUrl);
      }
    } catch (emailErr) {
      console.error('❌ Failed to send email:', emailErr.message);
      return errorResponse(res, 'Failed to send email', 500);
    }

    return successResponse(res, 'Verification code sent successfully', {
      email: user.email,
      previewUrl: (typeof mailInfo !== 'undefined' && mailInfo?.previewUrl) ? mailInfo.previewUrl : undefined
    });

  } catch (err) {
    console.error('❌ Error in resendVerification:', err);
    return errorResponse(res, 'Something went wrong', 500, err.message);
  }
};


exports.verifyEmail = async (req, res) => {
  try {
    const isEmailVerificationEnabled = process.env.EMAIL_VERIFICATION_ENABLED === 'true';
    if (!isEmailVerificationEnabled) {
      // Auto-verify when disabled
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        return errorResponse(res, 'Token missing or invalid', 401);
      }
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (err) {
        return errorResponse(res, 'Invalid or expired token', 401);
      }
      const user = await User.findById(decoded.id);
      if (!user) return errorResponse(res, 'User not found', 404);
      if (!user.emailVerifiedAt) {
        user.emailVerifiedAt = new Date();
        user.otp = null;
        user.otpCreatedAt = null;
        await user.save();
      }
      return successResponse(res, 'Email verified (verification disabled)');
    }
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return errorResponse(res, 'Token missing or invalid', 401);
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return errorResponse(res, 'Invalid or expired token', 401);
    }

    const user = await User.findById(decoded.id);

    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    if (user.emailVerifiedAt) {
      return successResponse(res, 'Email already verified');
    }

    const { otp } = req.body;

    if (!otp || otp !== user.otp) {
      return errorResponse(res, 'Invalid OTP', 400);
    }

    // Enforce OTP expiry (10 minutes TTL)
    const ttlMs = 10 * 60 * 1000; // 10 minutes
    const createdAt = user.otpCreatedAt ? new Date(user.otpCreatedAt).getTime() : 0;
    if (!createdAt || Date.now() - createdAt > ttlMs) {
      return errorResponse(res, 'OTP expired. Please request a new code.', 400);
    }

    user.emailVerifiedAt = new Date();
    user.otp = null; // clear OTP after success
    user.otpCreatedAt = null;
    await user.save();

    return successResponse(res, 'Email verified successfully');
  } catch (err) {
    return errorResponse(res, 'Verification failed', 500, err.message);
  }
};


exports.verifyPhone = async (req, res) => {
  try {
    const isPhoneVerificationEnabled = process.env.PHONE_VERIFICATION_ENABLED === 'true';
    if (!isPhoneVerificationEnabled) {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) return errorResponse(res, 'Token missing', 401);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (!user) return errorResponse(res, 'User not found', 404);
      const { phone } = req.body;
      if (phone) {
        user.phone = phone;
      }
      if (!user.phoneVerifiedAt) {
        user.phoneVerifiedAt = new Date();
      }
      await user.save();
      return successResponse(res, 'Phone verified (verification disabled)');
    }
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return errorResponse(res, 'Token missing', 401);

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return errorResponse(res, 'User not found', 404);

    const { phone } = req.body;
    if (!phone) return errorResponse(res, 'Phone number is required', 400);

    // ✅ Normalize phone to E.164 format (generic, do not hardcode country)
    let formattedPhone = phone.trim();
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = `+${formattedPhone}`;
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.phone = formattedPhone;
    user.otp = otp;
    user.otpCreatedAt = new Date();
    await user.save();

    const sms = `Your SOUQ verification code is ${otp}. It is valid for 10 minutes.`;
    await sendSMS(formattedPhone, sms);

    return successResponse(res, 'OTP sent to phone');
  } catch (err) {
    return errorResponse(res, 'Failed to send OTP', 500, err.message);
  }
};


exports.verifyPhoneOtp = async (req, res) => {
  try {
    const isPhoneVerificationEnabled = process.env.PHONE_VERIFICATION_ENABLED === 'true';
    if (!isPhoneVerificationEnabled) {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) return errorResponse(res, 'Token missing', 401);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (!user) return errorResponse(res, 'User not found', 404);
      if (!user.phoneVerifiedAt) {
        user.phoneVerifiedAt = new Date();
      }
      user.otp = null;
      user.otpCreatedAt = null;
      await user.save();
      return successResponse(res, 'Phone verified (verification disabled)');
    }
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return errorResponse(res, 'Token missing', 401);

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return errorResponse(res, 'User not found', 404);

    const { otp } = req.body;
    if (!otp || otp !== user.otp) {
      return errorResponse(res, 'Invalid OTP', 400);
    }

    // Enforce OTP expiry (10 minutes TTL)
    const ttlMs = 10 * 60 * 1000; // 10 minutes
    const createdAt = user.otpCreatedAt ? new Date(user.otpCreatedAt).getTime() : 0;
    if (!createdAt || Date.now() - createdAt > ttlMs) {
      return errorResponse(res, 'OTP expired. Please request a new code.', 400);
    }

    user.phoneVerifiedAt = new Date();
    user.otp = null;
    user.otpCreatedAt = null;
    await user.save();

    return successResponse(res, 'Phone verified successfully');
  } catch (err) {
    return errorResponse(res, 'Phone verification failed', 500, err.message);
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { token } = req.query; // Token from URL (forgot password flow)
    let user;

    if (token) {
      // Case 1: Forgot Password Flow
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      user = await User.findById(decoded.id);
    } else {
      // Case 2: Logged-in User Flow
      const authToken = req.headers.authorization?.split(' ')[1];
      if (!authToken) return errorResponse(res, 'Authorization token missing', 401);
      const decoded = jwt.verify(authToken, process.env.JWT_SECRET);
      user = await User.findById(decoded.id);
    }

    if (!user) return errorResponse(res, 'User not found', 404);

    const { newPassword, reEnterNewPassword } = req.body;

    if (!newPassword || !reEnterNewPassword) {
      return errorResponse(res, 'Both password fields are required', 400);
    }

    if (newPassword !== reEnterNewPassword) {
      return errorResponse(res, 'Passwords do not match', 400);
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return successResponse(res, 'Password changed successfully');
  } catch (err) {
    return errorResponse(res, 'Failed to change password', 500, err.message);
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return errorResponse(res, 'Email and password are required', 400);
    }

    // ✅ Only fetch users who are not soft-deleted
    const user = await User.findOne({ email, deletedAt: null });
    if (!user) {
      return errorResponse(res, 'Invalid email or password', 401);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return errorResponse(res, 'Invalid email or password', 401);
    }

    const isEmailVerificationEnabled = process.env.EMAIL_VERIFICATION_ENABLED === 'true';
    if (isEmailVerificationEnabled && !user.emailVerifiedAt) {
      return errorResponse(res, 'Please verify your email before logging in', 403);
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    user.refreshToken = refreshToken;
    user.lastLoginAt = new Date();
    await user.save();

    await createSession(req, user._id, accessToken);

    return successResponse(res, 'Login successful', {
      accessToken,
      refreshToken,
      lastLoginAt: user.lastLoginAt,
      user: {
        id: user._id,
        email: user.email,
        userName: user.userName,
        profile: user.profile,
        userNameUpdatedAt: user.userNameUpdatedAt || null,
        emailVerifiedAt: user.emailVerifiedAt || null,
        phoneVerifiedAt: user.phoneVerifiedAt || null,
        language: user.language,
      },
    });
  } catch (err) {
    return errorResponse(res, 'Login failed', 500, err.message);
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return errorResponse(res, 'Email is required', 400);

    const user = await User.findOne({ email });
    if (!user) return errorResponse(res, 'User not found', 404);

    // Create reset token
    const resetToken = jwt.sign(
      { id: user._id, email: user.email },
      process.env.RESET_PASSWORD_SECRET,
      { expiresIn: process.env.RESET_PASSWORD_EXPIRES_IN }
    );

    // Password reset link (change to your frontend URL)
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    const html = getForgotPasswordEmailHTML(resetLink);

    await sendMail(email, 'Password Reset Request', html);

    return successResponse(res, 'Reset link sent to email');
  } catch (err) {
    return errorResponse(res, 'Error sending reset email', 500, err.message);
  }
};


exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword, reEnterNewPassword } = req.body;

    if (!token) return errorResponse(res, 'Token missing', 400);
    if (!newPassword || !reEnterNewPassword)
      return errorResponse(res, 'Both password fields are required', 400);
    if (newPassword !== reEnterNewPassword)
      return errorResponse(res, 'Passwords do not match', 400);

    const decoded = jwt.verify(token, process.env.RESET_PASSWORD_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return errorResponse(res, 'User not found', 404);

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return successResponse(res, 'Password reset successfully');
  } catch (err) {
    return errorResponse(res, 'Invalid or expired token', 400, err.message);
  }
};


exports.logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return errorResponse(res, 'Token missing', 401);

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return errorResponse(res, 'User not found', 404);

    user.refreshToken = null;
    await user.save();

    return successResponse(res, 'Logged out successfully');
  } catch (err) {
    return errorResponse(res, 'Logout failed', 500, err.message);
  }
};

/**
 * Test email functionality (Development only)
 */
exports.testEmail = async (req, res) => {
  try {
    const { email, forceEnable } = req.body;

    if (!email) {
      return errorResponse(res, 'Email is required', 400);
    }

    console.log('🧪 Testing email functionality...');

    // Import email utilities
    const { testEmailConfig, forceEnableEmail } = require('../../../../utils/senMail');

    // Test email configuration first
    const configTest = await testEmailConfig();
    console.log('📧 Email config test result:', configTest);

    // Force enable email if requested
    if (forceEnable) {
      console.log('🔧 Force enabling email...');
      const forceResult = forceEnableEmail();
      console.log('🔧 Force enable result:', forceResult);
    }

    const testOtp = '123456';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">SOUQ Platform - Test Email</h2>
        <p>This is a test email to verify email functionality.</p>
        <p>Your test OTP is: <strong style="font-size: 24px; color: #007bff;">${testOtp}</strong></p>
        <p>If you received this email, the email service is working correctly.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">This is an automated test email from SOUQ Platform.</p>
      </div>
    `;

    const result = await sendMail(email, 'Test Email - SOUQ Platform', html);

    return successResponse(res, 'Test email completed', {
      email,
      messageId: result.messageId,
      response: result.response,
      simulated: result.simulated || false,
      configTest,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Test email failed:', error);
    return errorResponse(res, 'Test email failed', 500, error.message);
  }
};

/**
 * Email diagnostics (Development only)
 */
exports.emailDiagnostics = async (req, res) => {
  try {
    console.log('🔍 Running email diagnostics...');

    const diagnostics = {
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        DISABLE_EMAIL: process.env.DISABLE_EMAIL,
        EMAIL_USER: process.env.EMAIL_USER ? 'Set' : 'Missing',
        EMAIL_PASS: process.env.EMAIL_PASS ? 'Set' : 'Missing'
      },
      emailService: {
        isEmailDisabled: process.env.DISABLE_EMAIL === 'true' || process.env.NODE_ENV === 'development',
        transporterExists: false,
        configurationValid: false
      },
      recommendations: []
    };

    // Test email configuration
    try {
      const { testEmailConfig } = require('../../../../utils/senMail');
      diagnostics.emailService.configurationValid = await testEmailConfig();
    } catch (configError) {
      diagnostics.emailService.configError = configError.message;
    }

    // Check if transporter exists
    try {
      const nodemailer = require('nodemailer');
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        const testTransporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          }
        });
        diagnostics.emailService.transporterExists = true;

        // Test connection
        const verified = await testTransporter.verify();
        diagnostics.emailService.connectionTest = verified;
      }
    } catch (transportError) {
      diagnostics.emailService.transportError = transportError.message;
    }

    // Generate recommendations
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      diagnostics.recommendations.push('Set EMAIL_USER and EMAIL_PASS in your .env file');
    }

    if (process.env.DISABLE_EMAIL === 'true') {
      diagnostics.recommendations.push('Remove DISABLE_EMAIL=true from .env to enable real email sending');
    }

    if (process.env.NODE_ENV === 'development') {
      diagnostics.recommendations.push('Email is disabled in development mode. Set NODE_ENV=production to enable');
    }

    if (!diagnostics.emailService.configurationValid) {
      diagnostics.recommendations.push('Email configuration is invalid. Check Gmail app password setup');
    }

    return successResponse(res, 'Email diagnostics completed', diagnostics);

  } catch (error) {
    console.error('❌ Email diagnostics failed:', error);
    return errorResponse(res, 'Email diagnostics failed', 500, error.message);
  }
};

