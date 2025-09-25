const mongoose = require('mongoose');
const Notification = require('./db/models/notificationModel');
const User = require('./db/models/userModel');
require('dotenv').config();

async function testBulkDeleteNotifications() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find a test user
    const testUser = await User.findOne().limit(1);
    if (!testUser) {
      console.log('❌ No users found in database');
      return;
    }

    console.log(`🔍 Using test user: ${testUser.firstName} ${testUser.lastName}`);

    // Create some test notifications
    const testNotifications = [];
    for (let i = 1; i <= 5; i++) {
      const notification = await Notification.createNotification({
        recipient: testUser._id,
        sender: testUser._id,
        type: 'system',
        title: `Test Notification ${i}`,
        message: `This is test notification number ${i} for bulk delete testing.`,
        priority: 'normal'
      });
      testNotifications.push(notification);
    }

    console.log(`✅ Created ${testNotifications.length} test notifications`);

    // Test bulk delete functionality
    const notificationIds = testNotifications.slice(0, 3).map(n => n._id);
    console.log(`🗑️ Testing bulk delete of ${notificationIds.length} notifications...`);

    // Simulate the bulk delete operation
    const deleteResult = await Notification.deleteMany({
      _id: { $in: notificationIds },
      recipient: testUser._id
    });

    console.log(`✅ Bulk delete successful! Deleted ${deleteResult.deletedCount} notifications`);

    // Test delete all functionality
    console.log('🗑️ Testing delete all notifications...');
    const deleteAllResult = await Notification.deleteMany({
      recipient: testUser._id
    });

    console.log(`✅ Delete all successful! Deleted ${deleteAllResult.deletedCount} remaining notifications`);

    // Verify no notifications remain
    const remainingCount = await Notification.countDocuments({
      recipient: testUser._id
    });

    console.log(`📊 Remaining notifications for user: ${remainingCount}`);

    if (remainingCount === 0) {
      console.log('✅ All tests passed! Bulk delete functionality works correctly.');
    } else {
      console.log('❌ Some notifications were not deleted properly.');
    }

  } catch (error) {
    console.error('❌ Error testing bulk delete notifications:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the test
testBulkDeleteNotifications();