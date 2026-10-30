const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const User = require('../db/models/userModel');

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user._id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
}); 

// Only initialize Google OAuth if credentials are provided
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
  },
async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails[0].value;
    let user = await User.findOne({ email });

    if (!user) {
      // Generate unique username if displayName already exists
      let userName = profile.displayName || `${profile.name.givenName}${profile.name.familyName}` || email.split('@')[0];
      let userNameExists = await User.findOne({ userName });
      let counter = 1;
      while (userNameExists) {
        userName = `${userName}${counter}`;
        userNameExists = await User.findOne({ userName });
        counter++;
      }

      user = new User({
        firstName: profile.name.givenName || 'User',
        lastName: profile.name.familyName || '',
        email,
        userName: userName,
        profile: profile.photos?.[0]?.value || null,
        emailVerifiedAt: new Date(),
        isSocialLogin: true,
        loginWithGoogle: true,
      });
      await user.save();
      console.log(`✅ New Google user created: ${email}`);
    } else {
      // Update existing user to mark Google login
      if (!user.loginWithGoogle) {
        user.loginWithGoogle = true;
        await user.save();
      }
      console.log(`✅ Existing user logged in with Google: ${email}`);
    }

    return done(null, user);
  } catch (err) {
    console.error('❌ Google OAuth error:', err);
    return done(err, null);
  }
  }));
} else {
  console.log('⚠️ Google OAuth disabled - missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
}

// Only initialize Facebook OAuth if credentials are provided
if (process.env.FB_APP_ID && process.env.FB_APP_SECRET) {
  passport.use(new FacebookStrategy({
    clientID: process.env.FB_APP_ID,
    clientSecret: process.env.FB_APP_SECRET,
    callbackURL: process.env.FB_CALLBACK_URL,
    profileFields: ['id', 'emails', 'name', 'displayName', 'photos']
  },
async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      return done(new Error('Email not provided by Facebook'), null);
    }

    let user = await User.findOne({ email });

    if (!user) {
      // Generate unique username if displayName already exists
      let userName = profile.displayName || `${profile.name.givenName}${profile.name.familyName}` || email.split('@')[0];
      let userNameExists = await User.findOne({ userName });
      let counter = 1;
      while (userNameExists) {
        userName = `${userName}${counter}`;
        userNameExists = await User.findOne({ userName });
        counter++;
      }

      user = new User({
        firstName: profile.name.givenName || 'User',
        lastName: profile.name.familyName || '',
        email,
        userName: userName,
        profile: profile.photos?.[0]?.value || null,
        isSocialLogin: true,
        emailVerifiedAt: new Date(),
        loginWithFacebook: true,
      });
      await user.save();
      console.log(`✅ New Facebook user created: ${email}`);
    } else {
      // Update existing user to mark Facebook login
      if (!user.loginWithFacebook) {
        user.loginWithFacebook = true;
        await user.save();
      }
      console.log(`✅ Existing user logged in with Facebook: ${email}`);
    }
    
    return done(null, user);
  } catch (err) {
    console.error('❌ Facebook OAuth error:', err);
    return done(err, null);
  }
  }));
} else {
  console.log('⚠️ Facebook OAuth disabled - missing FB_APP_ID or FB_APP_SECRET');
}
