const mongoose = require('mongoose');
const Message = require('../db/models/messageModel');
require('dotenv').config();

async function cleanupDuplicateOfferMessages() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Find all offer-related messages
    const offerMessages = await Message.find({
      messageType: { $in: ['offer', 'offer_accepted', 'offer_declined'] }
    }).sort({ createdAt: 1 });

    console.log(`Found ${offerMessages.length} offer-related messages`);

    // Group messages by offer ID
    const messagesByOffer = {};
    offerMessages.forEach(message => {
      const offerId = message.offer?.toString();
      if (offerId) {
        if (!messagesByOffer[offerId]) {
          messagesByOffer[offerId] = [];
        }
        messagesByOffer[offerId].push(message);
      }
    });

    let duplicatesRemoved = 0;
    let offersProcessed = 0;

    // Process each offer group
    for (const [offerId, messages] of Object.entries(messagesByOffer)) {
      if (messages.length > 1) {
        console.log(`\nProcessing offer ${offerId} with ${messages.length} messages:`);
        
        // Sort by creation date to keep the original offer message
        messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        
        // Keep the first message (original offer) and remove the rest
        const originalMessage = messages[0];
        const duplicateMessages = messages.slice(1);
        
        console.log(`  - Keeping original message: ${originalMessage._id} (${originalMessage.messageType})`);
        
        // Update the original message with the latest status if needed
        const latestMessage = messages[messages.length - 1];
        if (latestMessage.offerData?.status && latestMessage.offerData.status !== 'pending') {
          await Message.findByIdAndUpdate(originalMessage._id, {
            'offerData.status': latestMessage.offerData.status,
            text: latestMessage.text
          });
          console.log(`  - Updated original message status to: ${latestMessage.offerData.status}`);
        }
        
        // Remove duplicate messages
        for (const dupMessage of duplicateMessages) {
          await Message.findByIdAndDelete(dupMessage._id);
          console.log(`  - Removed duplicate: ${dupMessage._id} (${dupMessage.messageType})`);
          duplicatesRemoved++;
        }
        
        offersProcessed++;
      }
    }

    console.log(`\n✅ Cleanup completed:`);
    console.log(`   - Offers processed: ${offersProcessed}`);
    console.log(`   - Duplicate messages removed: ${duplicatesRemoved}`);
    console.log(`   - Total offer messages remaining: ${offerMessages.length - duplicatesRemoved}`);

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the cleanup if this script is executed directly
if (require.main === module) {
  cleanupDuplicateOfferMessages()
    .then(() => {
      console.log('Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

module.exports = cleanupDuplicateOfferMessages;
