const express = require('express');
const passport = require('passport');
const router = express.Router();
const socialController = require('../controllers/userSocialAuthController')


// Google Login
router.get('/',(req,res)=> {
    res.send('OAuth login entry routes');
});

router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/api/user/auth/error', session: false }),
  socialController.success
);

router.get('/success', socialController.success);

router.get('/error', socialController.error);

router.get('/signout', socialController.signout);


// Facebook Login
router.get('/facebook',
  passport.authenticate('facebook', { scope: ['email'] })
);

router.get('/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/api/user/auth/error', session: false }),
  socialController.success
);



module.exports = router;