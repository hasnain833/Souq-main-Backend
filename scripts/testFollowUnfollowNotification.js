const mongoose = require('mongoose');
const User = require('../db/models/userModel');
const Notification = require('../db/models/notificationModel');
const NotificationService = require('../services/NotificationService');
require('dotenv').config();

async function testFollowUnfollowNotification() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find two users for testing
    const users = await User.find().limit(2);
    if (users.length < 2) {
      console.log('❌ Need at least 2 users in database');
      return;
    }

    const follower = users[0];
    const followedUser = users[1];

    console.log('👤 Follower:', follower.firstName, follower.lastName);
    console.log('👤 Followed User:', followedUser.firstName, followedUser.lastName);

    // Step 1: Simulate following a user
    console.log('\n🔄 Step 1: Creating follow relationship...');
    
    // Add follower to followed user's followers list
    if (!followedUser.followers.includes(follower._id)) {
      followedUser.followers.push(follower._id);
      await followedUser.save();
    }

    // Add followed user to follower's following list
    if (!follower.following.includes(followedUser._id)) {
      follower.following.push(followedUser._id);
      await follower.save();
    }

    // Create follower notification
    await NotificationService.notifyNewFollower(follower, followedUser);
    console.log('✅ Follow relationship created and notification sent');

    // Check if notification was created
    let notification = await Notification.findOne({
      recipient: followedUser._id,
      sender: follower._id,
      type: 'new_follower'
    }).sort({ createdAt: -1 });

    if (notification) {
      console.log('✅ Follower notification found:');
      console.log('  - Title:', notification.title);
      console.log('  - Message:', notification.message);
      console.log('  - Status:', notification.status);
    } else {
      console.log('❌ No follower notification found');
      return;
    }

    // Step 2: Simulate unfollowing the user
    console.log('\n🔄 Step 2: Simulating unfollow...');

    // Remove follower from followed user's followers list
    followedUser.followers = followedUser.followers.filter(
      (id) => id.toString() !== follower._id.toString()
    );
    await followedUser.save();

    // Remove followed user from follower's following list
    follower.following = follower.following.filter(
      (id) => id.toString() !== followedUser._id.toString()
    );
    await follower.save();

    // Delete all follower notifications (this is what we fixed)
    const deletedNotifications = await Notification.deleteMany({
      recipient: followedUser._id,
      sender: follower._id,
      type: 'new_follower'
    });

    if (deletedNotifications.deletedCount > 0) {
      console.log(`✅ ${deletedNotifications.deletedCount} follower notification(s) deleted successfully`);
    } else {
      console.log('❌ No follower notifications found to delete');
    }

    // Step 3: Verify notification is gone
    console.log('\n🔄 Step 3: Verifying notification deletion...');

    const remainingNotification = await Notification.findOne({
      recipient: followedUser._id,
      sender: follower._id,
      type: 'new_follower'
    });

    if (remainingNotification) {
      console.log('❌ Follower notification still exists (deletion failed)');
    } else {
      console.log('✅ Follower notification successfully removed from database');
    }

    // Step 4: Check total notification counts
    console.log('\n📊 Final notification counts:');
    const totalNotifications = await Notification.countDocuments();
    const unreadNotifications = await Notification.countDocuments({ status: 'unread' });
    const followerNotifications = await Notification.countDocuments({ type: 'new_follower' });

    console.log(`  - Total notifications: ${totalNotifications}`);
    console.log(`  - Unread notifications: ${unreadNotifications}`);
    console.log(`  - Follower notifications: ${followerNotifications}`);

    console.log('\n🎉 Follow/Unfollow notification test completed successfully!');

  } catch (error) {
    console.error('❌ Error testing follow/unfollow notification:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the test
testFollowUnfollowNotification();
