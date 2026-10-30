exports.generateSellerWelcomeMessage = (seller, reviewCount = 0, averageRating = 0) => {
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
  
  // Format reviews text
  let reviewsText = 'No reviews yet';
  if (reviewCount > 0) {
    if (averageRating > 0) {
      reviewsText = `⭐ ${averageRating.toFixed(1)} (${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'})`;
    } else {
      reviewsText = `${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'}`;
    }
  }
  
  // Generate welcome message
  const welcomeText = `Hi, I'm ${sellerName}

${reviewsText}

${location}
${lastSeenText}`;

  return welcomeText;
};

exports.createInitialSellerMessage = async (chatId, sellerId, buyerId, seller) => {
  const Message = require('../db/models/messageModel');
  const Rating = require('../db/models/ratingModel');
  
  // Get seller's review count and average rating
  let reviewCount = 0;
  let averageRating = 0;
  try {
    const ratingsData = await Rating.getUserAverageRating(sellerId);
    reviewCount = ratingsData.totalRatings || 0;
    averageRating = ratingsData.averageRating || 0;
  } catch (error) {
    console.error('Error fetching ratings for welcome message:', error);
    // Continue with default values (0 reviews)
  }
  
  const welcomeText = this.generateSellerWelcomeMessage(seller, reviewCount, averageRating);
  
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
