/**
 * Chat utility functions
 */

/**
 * Generate welcome message for new chat from seller
 * @param {Object} seller - Seller user object
 * @returns {string} - Formatted welcome message
 */
exports.generateSellerWelcomeMessage = (seller) => {
  // Get seller name
  const sellerName = seller.firstName && seller.lastName 
    ? `${seller.firstName} ${seller.lastName}` 
    : seller.userName;
  
  // Format location
  const location = seller.city && seller.country 
    ? `📍 ${seller.country}, ${seller.city}` 
    : '📍 Location not specified';
  
  // Format last seen
  const getLastSeenText = (lastLoginAt) => {
    if (!lastLoginAt) return '👁 Last seen recently';
    
    const now = new Date();
    const lastLogin = new Date(lastLoginAt);
    const diffInMinutes = Math.floor((now - lastLogin) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `👁 Last seen ${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
    } else if (diffInMinutes < 1440) { // Less than 24 hours
      const hours = Math.floor(diffInMinutes / 60);
      return `👁 Last seen ${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `👁 Last seen ${days} day${days !== 1 ? 's' : ''} ago`;
    }
  };
  
  const lastSeenText = getLastSeenText(seller.lastLoginAt);
  
  // Generate welcome message
  const welcomeText = `Hi, I'm ${sellerName}

No reviews yet

${location}
${lastSeenText}`;

  return welcomeText;
};

/**
 * Create initial message from seller when new chat is created
 * @param {string} chatId - Chat ID
 * @param {string} sellerId - Seller user ID
 * @param {string} buyerId - Buyer user ID
 * @param {Object} seller - Seller user object
 * @returns {Promise<Object>} - Created message object
 */
exports.createInitialSellerMessage = async (chatId, sellerId, buyerId, seller) => {
  const Message = require('../db/models/messageModel');
  
  const welcomeText = this.generateSellerWelcomeMessage(seller);
  
  // Create the initial message from seller
  const initialMessage = await Message.create({
    chat: chatId,
    sender: sellerId,
    receiver: buyerId,
    text: welcomeText,
    messageType: 'text',
    status: 'sent'
  });
  
  return initialMessage;
};
