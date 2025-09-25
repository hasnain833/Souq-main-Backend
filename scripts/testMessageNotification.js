const mongoose = require('mongoose');
const Chat = require('../db/models/chatModel');
const Message = require('../db/models/messageModel');
const User = require('../db/models/userModel');
const Product = require('../db/models/productModel');
const Notification = require('../db/models/notificationModel');
const NotificationService = require('../services/NotificationService');
require('dotenv').config();

async function testMessageNotification() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find users and a product for testing
    const users = await User.find().limit(2);
    if (users.length < 2) {
      console.log('❌ Need at least 2 users in database');
      return;
    }

    const product = await Product.findOne();
    if (!product) {
      console.log('❌ No products found in database');
      return;
    }

    const sender = users[0];
    const recipient = users[1];

    console.log('👤 Sender:', sender.firstName, sender.lastName);
    console.log('👤 Recipient:', recipient.firstName, recipient.lastName);
    console.log('📦 Product:', product.title);

    // Create or find a chat
    let chat = await Chat.findOne({
      participants: { $all: [sender._id, recipient._id] },
      product: product._id
    });

    if (!chat) {
      chat = new Chat({
        participants: [sender._id, recipient._id],
        product: product._id,
        buyer: sender._id,
        seller: recipient._id,
        roomId: `chat_${sender._id}_${recipient._id}_${product._id}`
      });
      await chat.save();
      console.log('✅ Created new chat');
    } else {
      console.log('✅ Found existing chat');
    }

    // Populate the chat with product data (this is what we fixed)
    await chat.populate('product', 'title price product_photos');

    // Create a test message
    const message = new Message({
      chat: chat._id,
      sender: sender._id,
      receiver: recipient._id,
      text: 'Hello! I am interested in this product. Is it still available?',
      messageType: 'text'
    });

    await message.save();
    console.log('✅ Created test message');

    // Populate message for notification
    await message.populate([
      { path: 'sender', select: 'firstName lastName profile' },
      { path: 'receiver', select: 'firstName lastName profile' }
    ]);

    // Test the notification service with populated chat
    console.log('🔔 Testing notification service...');
    await NotificationService.notifyNewMessage(
      message,
      message.sender,
      message.receiver,
      chat.product
    );

    // Check if notification was created
    const notification = await Notification.findOne({
      recipient: recipient._id,
      type: 'new_message'
    }).sort({ createdAt: -1 });

    if (notification) {
      console.log('✅ Notification created successfully!');
      console.log('📧 Notification details:');
      console.log('  - Title:', notification.title);
      console.log('  - Message:', notification.message);
      console.log('  - Type:', notification.type);
      console.log('  - Status:', notification.status);
      console.log('  - Priority:', notification.priority);
      
      // Check if the message contains "undefined"
      if (notification.message.includes('undefined')) {
        console.log('❌ Notification message still contains "undefined"');
      } else {
        console.log('✅ Notification message is properly formatted');
      }
    } else {
      console.log('❌ No notification found');
    }

    console.log('🎉 Test completed successfully!');

  } catch (error) {
    console.error('❌ Error testing message notification:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the test
testMessageNotification();
