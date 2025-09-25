const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const User = require('../db/models/userModel'); 

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
      user = new User({
        firstName: profile.name.givenName,
        lastName: profile.name.familyName,
        email,
        userName: profile.displayName,
        profile: profile.photos[0].value,
        emailVerifiedAt: new Date(),
        isSocialLogin: true,
        loginWithGoogle: true,       
        // loginWithFacebook: false     
      });
      await user.save();
    } else {
      user.loginWithGoogle = true;
      await user.save();
    }

    return done(null, user);
  } catch (err) {
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
    let user = await User.findOne({ email });

    if (!user) {
      user = new User({
        firstName: profile.name.givenName,
        lastName: profile.name.familyName,
        email,
        userName: profile.displayName,
        profile: profile.photos?.[0]?.value,
        isSocialLogin: true,
        emailVerifiedAt: new Date(),
        loginWithFacebook: true,     
        // loginWithGoogle: false       
      });
      await user.save();
    } else {
      user.loginWithFacebook = true;
      await user.save();
    }
    
    return done(null, user);
  } catch (err) {
    return done(err, null);
  }
  }));
} else {
  console.log('⚠️ Facebook OAuth disabled - missing FB_APP_ID or FB_APP_SECRET');
}
