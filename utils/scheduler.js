const cron = require('node-cron');
const Offer = require('../db/models/offerModel');
const Message = require('../db/models/messageModel');
const Chat = require('../db/models/chatModel');

let io = null;

// Set socket.io instance
const setSocketIO = (socketInstance) => {
  io = socketInstance;
};

// Function to expire old offers and update related messages
const expireOldOffers = async () => {
  try {
    console.log('🕐 Running offer expiration job...');
    
    // Find all pending offers that have expired
    const expiredOffers = await Offer.find({
      status: 'pending',
      expiresAt: { $lt: new Date() }
    }).populate([
      { path: 'buyer', select: 'userName firstName lastName profile' },
      { path: 'seller', select: 'userName firstName lastName profile' },
      { path: 'product', select: 'title price product_photos' },
      { path: 'chat', select: 'roomId' }
    ]);

    if (expiredOffers.length === 0) {
      console.log('✅ No expired offers found');
      return;
    }

    console.log(`⏰ Found ${expiredOffers.length} expired offers`);

    for (const offer of expiredOffers) {
      try {
        // Update offer status to expired
        offer.status = 'expired';
        await offer.save();

        // Update related message in chat
        const relatedMessage = await Message.findOne({
          offer: offer._id,
          messageType: 'offer'
        });

        if (relatedMessage) {
          // Update the offer data in the message
          relatedMessage.offerData.status = 'expired';
          await relatedMessage.save();

          // Create a system message about expiration
          const expirationMessage = new Message({
            chat: offer.chat._id,
            sender: offer.seller._id,
            receiver: offer.buyer._id,
            text: `Offer of $${offer.offerAmount} has expired after 48 hours`,
            messageType: 'system',
            systemMessage: 'offer_expired',
            offer: offer._id,
            offerData: {
              amount: offer.offerAmount,
              originalPrice: offer.originalPrice,
              status: 'expired'
            }
          });

          await expirationMessage.save();

          // Update chat's last message
          await Chat.findByIdAndUpdate(offer.chat._id, {
            lastMessage: expirationMessage._id,
            lastMessageAt: new Date()
          });

          // Emit socket event for real-time updates
          if (io && offer.chat.roomId) {
            const socketData = {
              id: expirationMessage._id,
              text: expirationMessage.text,
              messageType: expirationMessage.messageType,
              systemMessage: expirationMessage.systemMessage,
              offer: offer._id,
              offerData: expirationMessage.offerData,
              sender: {
                id: offer.seller._id,
                userName: offer.seller.userName,
                firstName: offer.seller.firstName,
                lastName: offer.seller.lastName,
                profile: offer.seller.profile
              },
              receiver: {
                id: offer.buyer._id,
                userName: offer.buyer.userName,
                firstName: offer.buyer.firstName,
                lastName: offer.buyer.lastName,
                profile: offer.buyer.profile
              },
              seen: false,
              status: 'sent',
              createdAt: expirationMessage.createdAt,
              chatId: offer.chat._id,
              roomId: offer.chat.roomId
            };

            // Emit to both buyer and seller
            io.to(offer.chat.roomId).emit('new_message', socketData);
            io.to(offer.chat.roomId).emit('offer_expired', {
              offerId: offer._id,
              chatId: offer.chat._id,
              roomId: offer.chat.roomId,
              offer: {
                id: offer._id,
                status: 'expired',
                offerAmount: offer.offerAmount,
                originalPrice: offer.originalPrice,
                buyer: offer.buyer,
                seller: offer.seller,
                product: offer.product
              }
            });

            console.log(`📡 Emitted expiration events for offer ${offer._id} in room ${offer.chat.roomId}`);
          }
        }

        console.log(`✅ Expired offer ${offer._id} for product ${offer.product.title}`);
      } catch (error) {
        console.error(`❌ Error expiring offer ${offer._id}:`, error);
      }
    }

    console.log(`🎯 Successfully processed ${expiredOffers.length} expired offers`);
  } catch (error) {
    console.error('❌ Error in offer expiration job:', error);
  }
};

// Function to start the scheduler
const startScheduler = () => {
  console.log('🚀 Starting offer expiration scheduler...');
  
  // Run every 5 minutes to check for expired offers
  cron.schedule('*/5 * * * *', expireOldOffers, {
    scheduled: true,
    timezone: "UTC"
  });

  // Also run once on startup to catch any offers that expired while server was down
  setTimeout(expireOldOffers, 5000); // Wait 5 seconds after startup

  console.log('⏰ Offer expiration scheduler started - runs every 5 minutes');
};

// Function to stop the scheduler (for graceful shutdown)
const stopScheduler = () => {
  console.log('🛑 Stopping offer expiration scheduler...');
  cron.destroy();
};

module.exports = {
  startScheduler,
  stopScheduler,
  setSocketIO,
  expireOldOffers // Export for manual testing
};
