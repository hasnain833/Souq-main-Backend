const mongoose = require('mongoose');
const Notification = require('../db/models/notificationModel');
const User = require('../db/models/userModel');
require('dotenv').config();

async function createTestNotification() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find a user to use as recipient
    const user = await User.findOne();
    if (!user) {
      console.log('❌ No users found in database');
      return;
    }

    console.log('👤 Found user:', user.firstName, user.lastName);

    // Create test notification
    const testNotification = new Notification({
      recipient: user._id,
      sender: user._id, // Self-notification for testing
      type: 'system',
      title: 'Test Admin Notification',
      message: 'This is a test notification created for admin panel testing.',
      priority: 'high',
      status: 'unread',
      relatedData: {
        metadata: {
          test: true,
          createdBy: 'admin-test-script',
          timestamp: new Date().toISOString()
        }
      }
    });

    await testNotification.save();
    console.log('✅ Test notification created successfully');
    console.log('📧 Notification ID:', testNotification._id);
    console.log('👤 Recipient:', user.firstName, user.lastName);
    console.log('📝 Title:', testNotification.title);
    console.log('📄 Message:', testNotification.message);

    // Create a few more test notifications with different types
    const notificationTypes = [
      {
        type: 'order_confirmed',
        title: 'Order Confirmed',
        message: 'Your order has been confirmed and is being processed.',
        priority: 'normal'
      },
      {
        type: 'offer_received',
        title: 'New Offer Received',
        message: 'You have received a new offer on your product.',
        priority: 'medium'
      },
      {
        type: 'new_follower',
        title: 'New Follower',
        message: 'Someone started following you.',
        priority: 'low'
      }
    ];

    for (const notifData of notificationTypes) {
      const notification = new Notification({
        recipient: user._id,
        sender: user._id,
        type: notifData.type,
        title: notifData.title,
        message: notifData.message,
        priority: notifData.priority,
        status: 'unread',
        relatedData: {
          metadata: {
            test: true,
            createdBy: 'admin-test-script'
          }
        }
      });

      await notification.save();
      console.log(`✅ Created ${notifData.type} notification`);
    }

    // Check total notifications count
    const totalCount = await Notification.countDocuments();
    console.log(`📊 Total notifications in database: ${totalCount}`);

    // Check unread count
    const unreadCount = await Notification.countDocuments({ status: 'unread' });
    console.log(`📊 Unread notifications: ${unreadCount}`);

    console.log('🎉 Test notifications created successfully!');

  } catch (error) {
    console.error('❌ Error creating test notification:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the script
createTestNotification();
