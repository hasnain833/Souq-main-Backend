const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController')
const verifyToken = require('../../../../utils/verifyToken')
const createUploader = require('../../../../utils/upload');
const optionalAuth = require('../../../../utils/optionalAuth');
const upload = createUploader('profile'); // pass the target folder name here


router.get('/', verifyToken, profileController.getProfile);

router.put('/update-profile', verifyToken, profileController.updateProfile);

router.delete('/delete-Profile', verifyToken, profileController.deleteUser);
// router.post('/upload-profile',verifyToken,upload.single('profile_image'),profileController.uploadProfile);

router.post('/upload-profile', verifyToken, upload.single('profile'), profileController.uploadProfile);

router.get('/:userId', optionalAuth, profileController.getAnotherUserProfile);

router.post('/users/:id/follow', verifyToken, profileController.followUser);

router.post('/users/:id/unfollow', verifyToken, profileController.unfollowUser);

router.get('/users/:id/followers', optionalAuth, profileController.getFollowers);

router.get('/users/:id/following', optionalAuth, profileController.getFollowing);


module.exports = router;