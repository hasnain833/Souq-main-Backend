const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController')
const verifyToken = require('../../../../utils/verifyToken')
const uploadS3 = require('../../../../middlewares/s3Uploader');
const optionalAuth = require('../../../../utils/optionalAuth');


router.get('/', verifyToken, profileController.getProfile);

router.put('/update-profile', verifyToken, profileController.updateProfile);

router.delete('/delete-Profile', verifyToken, profileController.deleteUser);
// router.post('/upload-profile',verifyToken,upload.single('profile_image'),profileController.uploadProfile);

// Use S3 uploader for profile images with error handling
router.post('/upload-profile', 
  verifyToken, 
  uploadS3.single('profile'), 
  uploadS3.errorHandler,
  profileController.uploadProfile
);

router.get('/:userId', optionalAuth, profileController.getAnotherUserProfile);

// Stream user profile image from MongoDB (with legacy fallback)
router.get('/image/:userId', profileController.streamProfileImage);

router.post('/users/:id/follow', verifyToken, profileController.followUser);

router.post('/users/:id/unfollow', verifyToken, profileController.unfollowUser);

router.get('/users/:id/followers', optionalAuth, profileController.getFollowers);

router.get('/users/:id/following', optionalAuth, profileController.getFollowing);


module.exports = router;