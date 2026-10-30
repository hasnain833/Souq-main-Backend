const { updateProfileRequestDTO, updateProfileResponseDTO, getProfileResponseDTO, getAnotherUserProfileRes } = require('../dto/user.dto')
const User = require('../../../../db/models/userModel')
const Rating = require('../../../../db/models/ratingModel')
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');
const NotificationService = require('../../../../services/NotificationService');
const Notification = require('../../../../db/models/notificationModel');
const { resolveS3Url } = require('../../../../utils/urlResolver');

exports.getProfile = async (req, res) => {
  try {
    // Followers/following are disabled in minimal schema; fetch user without populates
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Default rating data
    let ratingsData = {
      averageRating: 0,
      totalRatings: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    };

    try {
      ratingsData = await Rating.getUserAverageRating(user._id);
      console.log('🔍 getProfile - ratings data:', ratingsData);
    } catch (err) {
      console.error('⚠️ Error fetching ratings data in getProfile:', err);
    }

    const response = getProfileResponseDTO(user, ratingsData);

    return res.status(200).json(response);
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
      error: err.message
    });
  }
};


exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { userName } = req.body;

    const user = await User.findOne({ id: userId });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if userName is being changed
    const isUserNameChanging = userName && userName !== user.userName;

    if (isUserNameChanging) {
      // Check if the new username is already taken
      const userExists = await User.findOne({ userName, id: { $ne: userId } });
      if (userExists) {
        return res.status(400).json({
          success: false,
          message: 'Username already taken',
        });
      }

      // 🔐 30-day restriction
      if (user.userNameUpdatedAt) {
        const daysSinceUpdate = moment().diff(moment(user.userNameUpdatedAt), 'days');
        if (daysSinceUpdate < 30) {
          return res.status(403).json({
            success: false,
            message: `You can only change your username once every 30 days. Please try again in ${30 - daysSinceUpdate} days.`,
          });
        }
      } else {
        const daysSinceCreated = moment().diff(moment(user.createdAt), 'days');
        if (daysSinceCreated > 0 && user.userNameUpdatedAt === null) {

        }
      }
    }

    const updateData = updateProfileRequestDTO(req.body);

    // Save timestamp if username changed
    if (isUserNameChanging) {
      updateData.userNameUpdatedAt = new Date();
    }

    const updatedUser = await User.findOneAndUpdate(
      { id: userId },
      updateData,
      { new: true, runValidators: true }
    ).select('-password -otp');

    return res.status(200).json(updateProfileResponseDTO(updatedUser));

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: err.message,
    });
  }
};


exports.deleteUser = async (req, res) => {
  try {
    const userId = req.user.id;

    const deletedUser = await User.findOneAndUpdate(
      { id: userId, deletedAt: null },
      { deletedAt: new Date() },
      { new: true }
    );

    if (!deletedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found or already deleted',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'User soft deleted successfully',
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: err.message,
    });
  }
};


exports.uploadProfile = async (req, res) => {
  try {
    console.log('=== PROFILE UPLOAD START ===');
    console.log('Request file:', req.file ? {
      originalname: req.file.originalname,
      location: req.file.location,
      key: req.file.key,
      size: req.file.size
    } : 'No file');

    const userId = req.user?.id;

    if (!userId) {
      console.error('No user ID found in request');
      return res.status(401).json({ success: false, message: 'Unauthorized: No user ID' });
    }

    if (!req.file) {
      console.error('No file uploaded');
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    // Resolve S3 URL - use location if available, otherwise resolve from key
    const profileUrl = req.file.location || resolveS3Url(req.file.key);
    
    if (!profileUrl) {
      console.error('Failed to resolve profile URL:', { 
        location: req.file.location, 
        key: req.file.key 
      });
      return res.status(400).json({
        success: false,
        message: 'Failed to generate image URL',
      });
    }

    console.log('Profile URL resolved:', profileUrl);

    // Save S3 public URL into profile field
    const updatedUser = await User.findOneAndUpdate(
      { id: userId },
      { 
        profile: profileUrl,
        $unset: { profileImage: 1 }
      },
      { new: true }
    ).select('-password -otp');

    if (!updatedUser) {
      console.error('User not found for ID:', userId);
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    console.log('Profile updated successfully for user:', userId);

    return res.status(200).json({
      success: true,
      message: 'Profile photo updated successfully',
      data: {
        profile: updatedUser.profile,
        user: {
          id: updatedUser.id,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          userName: updatedUser.userName,
          email: updatedUser.email
        }
      }
    });

  } catch (err) {
    console.error('=== PROFILE UPLOAD ERROR ===');
    console.error('Error details:', err);
    console.error('Error stack:', err.stack);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload profile photo',
      error: err?.message || 'Internal Server Error',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};

// Stream user's profile image from MongoDB with fallback to legacy URL/path
exports.streamProfileImage = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select('profile profileImage');
    if (!user) return res.status(404).send('Not found');

    if (user.profileImage && user.profileImage.data) {
      res.contentType(user.profileImage.contentType || 'image/jpeg');
      return res.send(user.profileImage.data);
    }

    if (user.profile) {
      return res.redirect(302, user.profile);
    }

    return res.status(404).send('Image not found');
  } catch (err) {
    return res.status(500).send('Server error');
  }
};

exports.getAnotherUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate ObjectId format
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.log('❌ Invalid ObjectId format:', userId);
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format',
      });
    }

    const user = await User.findOne({ _id: userId, deletedAt: null })

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    let isFollowingUser = false;

    if (req.user) {
      try {
        const me = await User.findById(req.user._id).select('following');
        // Check if following field exists and is an array (it may be commented out in schema)
        if (me && me.following && Array.isArray(me.following) && me.following.length > 0) {
          isFollowingUser = me.following.some(
            (followedUserId) => followedUserId.toString() === user._id.toString()
          );
        }
      } catch (followError) {
        // If following field doesn't exist in schema, silently continue with isFollowingUser = false
        console.error('⚠️ Error checking follow status (following field may not exist in schema):', followError.message);
      }
    }

    // Get user's ratings data
    let ratingsData = {
      averageRating: 0,
      totalRatings: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    };

    try {
      ratingsData = await Rating.getUserAverageRating(userId);
    } catch (ratingsError) {
      console.error('⚠️ Error fetching ratings data:', ratingsError);
      // Keep default values if ratings fetch fails
    }

    const response = getAnotherUserProfileRes(user, isFollowingUser, ratingsData);

    return res.status(200).json(response);

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user profile',
      error: err.message,
    });
  }
};

exports.followUser = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const userToFollowId = req.params.id;

    if (loggedInUserId.toString() === userToFollowId) {
      return errorResponse(res, "You cannot follow yourself", 400);
    }

    const userToFollow = await User.findById(userToFollowId);
    const loggedInUser = await User.findById(loggedInUserId);

    if (!userToFollow) {
      return errorResponse(res, "User to follow not found", 404);
    }

    // Check if followers/following fields exist in schema (they may be commented out)
    if (!userToFollow.followers || !Array.isArray(userToFollow.followers)) {
      return errorResponse(res, "Follow feature is not available. Please contact support.", 503);
    }

    if (!loggedInUser.following || !Array.isArray(loggedInUser.following)) {
      return errorResponse(res, "Follow feature is not available. Please contact support.", 503);
    }

    // Check if already following
    const isAlreadyFollowing = userToFollow.followers.some(
      (id) => id.toString() === loggedInUserId.toString()
    );

    if (isAlreadyFollowing) {
      return errorResponse(res, "You already follow this user", 400);
    }

    // Add logged-in user to followers of target user
    userToFollow.followers.push(loggedInUserId);
    await userToFollow.save();

    // Add target user to following of logged-in user
    loggedInUser.following.push(userToFollowId);
    await loggedInUser.save();

    // Send notification to the followed user
    try {
      await NotificationService.notifyNewFollower(loggedInUser, userToFollow);
    } catch (notificationError) {
      console.error('Error sending follower notification:', notificationError);
      // Don't fail the follow action if notification fails
    }

    return successResponse(res, "User followed successfully");
  } catch (error) {
    console.error('Follow user error:', error);
    return errorResponse(res, "Failed to follow user", 500, error.message);
  }
};

exports.unfollowUser = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const userToUnfollowId = req.params.id;

    if (loggedInUserId.toString() === userToUnfollowId) {
      return errorResponse(res, "You cannot unfollow yourself", 400);
    }

    const userToUnfollow = await User.findById(userToUnfollowId);
    const loggedInUser = await User.findById(loggedInUserId);

    if (!userToUnfollow) {
      return errorResponse(res, "User to unfollow not found", 404);
    }

    // Check if followers/following fields exist in schema (they may be commented out)
    if (!userToUnfollow.followers || !Array.isArray(userToUnfollow.followers)) {
      return errorResponse(res, "Follow feature is not available. Please contact support.", 503);
    }

    if (!loggedInUser.following || !Array.isArray(loggedInUser.following)) {
      return errorResponse(res, "Follow feature is not available. Please contact support.", 503);
    }

    // Check if not following already
    const isFollowing = userToUnfollow.followers.some(
      (id) => id.toString() === loggedInUserId.toString()
    );

    if (!isFollowing) {
      return errorResponse(res, "You do not follow this user", 400);
    }

    // Remove logged-in user from followers of target user
    userToUnfollow.followers = userToUnfollow.followers.filter(
      (id) => id.toString() !== loggedInUserId.toString()
    );
    await userToUnfollow.save();

    // Remove target user from following of logged-in user
    loggedInUser.following = loggedInUser.following.filter(
      (id) => id.toString() !== userToUnfollowId.toString()
    );
    await loggedInUser.save();

    // Delete all follower notifications that were created when following
    try {
      const deletedNotifications = await Notification.deleteMany({
        recipient: userToUnfollowId,
        sender: loggedInUserId,
        type: 'new_follower'
      });

      if (deletedNotifications.deletedCount > 0) {
        console.log(`✅ Deleted ${deletedNotifications.deletedCount} follower notification(s) after unfollow`);

        // Emit real-time update to remove notifications from user's list
        const { getSocketIO } = require('../../../notifications/controllers/notificationController');
        const io = getSocketIO();
        if (io) {
          // Emit notification refresh event (since we deleted multiple, refresh the list)
          io.to(`user_${userToUnfollowId}`).emit('notifications_refresh');

          // Also emit updated unread count
          const unreadCount = await Notification.getUnreadCount(userToUnfollowId);
          io.to(`user_${userToUnfollowId}`).emit('unread_count_updated', { unreadCount });
        }
      }
    } catch (notificationError) {
      console.error('Error deleting follower notification:', notificationError);
      // Don't fail the unfollow action if notification deletion fails
    }

    return successResponse(res, "User unfollowed successfully");
  } catch (error) {
    return errorResponse(res, "Failed to unfollow user", 500, error.message);
  }
};

exports.getFollowers = async (req, res) => {
  try {
    const userId = req.params.id;
    const loggedInUserId = req.user ? req.user._id.toString() : null;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get the target user and their full followers
    // Note: followers field may be commented out in schema, so handle gracefully
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if followers field exists in schema
    let followers = [];
    if (user.followers && Array.isArray(user.followers)) {
      // Populate followers if field exists
      await user.populate({
        path: 'followers',
        select: 'userName firstName lastName profile lastLoginAt',
        match: { deletedAt: null },
      });
      followers = user.followers || [];
    }

    const totalFollowers = followers.length;

    // Paginate followers manually
    const paginatedFollowers = followers.slice(skip, skip + limit);

    let myFollowingIds = [];

    // If you're logged in, get who you follow
    if (loggedInUserId) {
      try {
        const me = await User.findById(loggedInUserId).select('following');
        if (me && me.following && Array.isArray(me.following)) {
          myFollowingIds = me.following.map(f => f.toString());
        }
      } catch (followError) {
        // If following field doesn't exist, continue with empty array
        console.error('⚠️ Error fetching following list (following field may not exist in schema):', followError.message);
      }
    }

    // Get ratings for all followers
    const followerIds = paginatedFollowers.map(f => f._id);
    const ratingsPromises = followerIds.map(async (followerId) => {
      const ratings = await Rating.find({ ratedUser: followerId });
      if (ratings.length > 0) {
        const totalRatings = ratings.length;
        const averageRating = ratings.reduce((sum, rating) => sum + rating.rating, 0) / totalRatings;
        return {
          userId: followerId.toString(),
          averageRating: Math.round(averageRating * 10) / 10,
          totalRatings
        };
      }
      return {
        userId: followerId.toString(),
        averageRating: 0,
        totalRatings: 0
      };
    });

    const ratingsData = await Promise.all(ratingsPromises);
    const ratingsMap = ratingsData.reduce((acc, rating) => {
      acc[rating.userId] = rating;
      return acc;
    }, {});

    // Map the paginated followers with ratings
    const formattedFollowers = paginatedFollowers.map(follower => {
      const userRating = ratingsMap[follower._id.toString()] || { averageRating: 0, totalRatings: 0 };
      return {
        id: follower._id,
        name: `${follower.firstName} ${follower.lastName}`,
        userName: follower.userName,
        profile: follower.profile || null,
        lastLoginAt: follower.lastLoginAt || null,
        isFollowedByMe: myFollowingIds.includes(follower._id.toString()),
        averageRating: userRating.averageRating,
        totalRatings: userRating.totalRatings
      };
    });

    return res.status(200).json({
      success: true,
      message: 'Followers fetched successfully',
      data: {
        followers,
        totalItems: totalFollowers,
        currentPage: page,
        totalPages: Math.ceil(totalFollowers / limit),
        hasNextPage: skip + followers.length < totalFollowers
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch followers',
      error: error.message,
    });
  }
};

exports.getFollowing = async (req, res) => {
  try {
    const userId = req.params.id;
    const loggedInUserId = req.user ? req.user._id.toString() : null;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    // Find the user and populate their full following list
    // Note: following field may be commented out in schema, so handle gracefully
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if following field exists in schema
    let userFollowing = [];
    if (user.following && Array.isArray(user.following)) {
      // Populate following if field exists
      await user.populate({
        path: 'following',
        select: 'userName firstName lastName profile lastLoginAt',
        match: { deletedAt: null },
      });
      userFollowing = user.following || [];
    }

    const totalFollowing = userFollowing.length;

    // Get my own following list (if logged in)
    let myFollowingIds = [];
    if (loggedInUserId) {
      try {
        const me = await User.findById(loggedInUserId).select('following');
        if (me && me.following && Array.isArray(me.following)) {
          myFollowingIds = me.following.map(f => f.toString());
        }
      } catch (followError) {
        // If following field doesn't exist, continue with empty array
        console.error('⚠️ Error fetching following list (following field may not exist in schema):', followError.message);
      }
    }

    // Slice the following list for pagination
    const paginatedFollowing = userFollowing.slice(skip, skip + limit);

    // Get ratings for all following users
    const followingIds = paginatedFollowing.map(f => f._id);
    const ratingsPromises = followingIds.map(async (followingId) => {
      const ratings = await Rating.find({ ratedUser: followingId });
      if (ratings.length > 0) {
        const totalRatings = ratings.length;
        const averageRating = ratings.reduce((sum, rating) => sum + rating.rating, 0) / totalRatings;
        return {
          userId: followingId.toString(),
          averageRating: Math.round(averageRating * 10) / 10,
          totalRatings
        };
      }
      return {
        userId: followingId.toString(),
        averageRating: 0,
        totalRatings: 0
      };
    });

    const ratingsData = await Promise.all(ratingsPromises);
    const ratingsMap = ratingsData.reduce((acc, rating) => {
      acc[rating.userId] = rating;
      return acc;
    }, {});

    // Format the response with ratings
    const formattedFollowing = paginatedFollowing.map(followee => {
      const userRating = ratingsMap[followee._id.toString()] || { averageRating: 0, totalRatings: 0 };
      return {
        id: followee._id,
        name: `${followee.firstName} ${followee.lastName}`,
        userName: followee.userName,
        profile: followee.profile || null,
        lastLoginAt: followee.lastLoginAt || null,
        isFollowedByMe: myFollowingIds.includes(followee._id.toString()),
        averageRating: userRating.averageRating,
        totalRatings: userRating.totalRatings
      };
    });

    return res.status(200).json({
      success: true,
      message: 'Following fetched successfully',
      data: {
        following: formattedFollowing,
        totalItems: totalFollowing,
        currentPage: page,
        totalPages: Math.ceil(totalFollowing / limit),
        hasNextPage: skip + formattedFollowing.length < totalFollowing
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch following',
      error: error.message,
    });
  }
};

