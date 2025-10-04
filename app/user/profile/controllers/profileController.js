const { updateProfileRequestDTO, updateProfileResponseDTO, getProfileResponseDTO, getAnotherUserProfileRes } = require('../dto/user.dto')
const User = require('../../../../db/models/userModel')
const Rating = require('../../../../db/models/ratingModel')
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');
const NotificationService = require('../../../../services/NotificationService');
const Notification = require('../../../../db/models/notificationModel');
const moment = require('moment');

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
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized: No user ID' });
    }

    if (!req.file || !req.file.path) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    const imageUrl = req.file.path;

    const updatedUser = await User.findOneAndUpdate(
      { id: userId }, // ✅ QUERY BY CUSTOM `id` FIELD
      { profile: imageUrl },
      { new: true }
    ).select('-password -otp');

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Profile photo updated successfully',
      data: {
        profile: updatedUser.profile
      }
    });

  } catch (err) {
    console.error('UPLOAD PROFILE ERROR:', err.stack || err);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload profile photo',
      error: err?.message || 'Internal Server Error'
    });
  }
};

exports.getAnotherUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    console.log('🔍 getAnotherUserProfile - Requested userId:', userId);
    console.log('🔍 getAnotherUserProfile - userId type:', typeof userId);
    console.log('🔍 getAnotherUserProfile - userId length:', userId.length);

    // Validate ObjectId format
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.log('❌ Invalid ObjectId format:', userId);
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format',
      });
    }

    const user = await User.findOne({ _id: userId, deletedAt: null }).select('-password -otp').populate({
      path: 'followers',
      select: 'deletedAt',
    })
      .populate({
        path: 'following',
        select: 'deletedAt',
      });
    console.log('🔍 getAnotherUserProfile - User found:', !!user);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    let isFollowingUser = false;

    if (req.user) {
      const me = await User.findById(req.user._id).select('following');
      isFollowingUser = me.following.some(
        (followedUserId) => followedUserId.toString() === user._id.toString()
      );
    }

    // Get user's ratings data
    let ratingsData = {
      averageRating: 0,
      totalRatings: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    };

    try {
      ratingsData = await Rating.getUserAverageRating(userId);
      console.log('🔍 getAnotherUserProfile - ratings data:', ratingsData);
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

    // Check if already following
    if (userToFollow.followers.includes(loggedInUserId)) {
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

    // Check if not following already
    if (!userToUnfollow.followers.includes(loggedInUserId)) {
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
    const user = await User.findById(userId).populate({
      path: 'followers',
      select: 'userName firstName lastName profile lastLoginAt',
      match: { deletedAt: null },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const totalFollowers = user.followers.length;

    // Paginate followers manually
    const paginatedFollowers = user.followers.slice(skip, skip + limit);

    let myFollowingIds = [];

    // If you're logged in, get who you follow
    if (loggedInUserId) {
      const me = await User.findById(loggedInUserId).select('following');
      myFollowingIds = me.following.map(f => f.toString());
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
    const followers = paginatedFollowers.map(follower => {
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
    const user = await User.findById(userId).populate({
      path: 'following',
      select: 'userName firstName lastName profile lastLoginAt',
      match: { deletedAt: null },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const totalFollowing = user.following.length;

    // Get my own following list (if logged in)
    let myFollowingIds = [];
    if (loggedInUserId) {
      const me = await User.findById(loggedInUserId).select('following');
      myFollowingIds = me.following.map(f => f.toString());
    }

    // Slice the following list for pagination
    const paginatedFollowing = user.following.slice(skip, skip + limit);

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
    const following = paginatedFollowing.map(followee => {
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
        following,
        totalItems: totalFollowing,
        currentPage: page,
        totalPages: Math.ceil(totalFollowing / limit),
        hasNextPage: skip + following.length < totalFollowing
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

