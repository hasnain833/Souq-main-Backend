const { createNotification } = require('../app/user/notifications/controllers/notificationController');

class NotificationService {
  
  // Order confirmation notification to seller
  static async notifyOrderConfirmed(order, buyer, seller) {
    try {
      await createNotification({
        recipient: seller._id,
        sender: buyer._id,
        type: 'order_confirmed',
        title: 'New Order Received!',
        message: `${buyer.firstName} ${buyer.lastName} has placed an order for "${order.product.title}"`,
        relatedData: {
          order: order._id,
          product: order.product._id,
          metadata: {
            orderNumber: order.orderNumber,
            amount: order.totalAmount
          }
        },
        priority: 'high'
      });
    } catch (error) {
      console.error('Error sending order confirmation notification:', error);
    }
  }
  
  // Order shipped notification to buyer
  static async notifyOrderShipped(order, seller, buyer) {
    try {
      await createNotification({
        recipient: buyer._id,
        sender: seller._id,
        type: 'order_shipped',
        title: 'Your Order Has Been Shipped!',
        message: `Your order for "${order.product.title}" has been shipped by ${seller.firstName}`,
        relatedData: {
          order: order._id,
          product: order.product._id,
          metadata: {
            orderNumber: order.orderNumber,
            trackingNumber: order.shipping?.trackingNumber
          }
        },
        priority: 'medium'
      });
    } catch (error) {
      console.error('Error sending order shipped notification:', error);
    }
  }
  
  // Order delivered notification to seller
  static async notifyOrderDelivered(order, buyer, seller) {
    try {
      await createNotification({
        recipient: seller._id,
        sender: buyer._id,
        type: 'order_delivered',
        title: 'Order Delivered Successfully!',
        message: `Your order for "${order.product.title}" has been delivered to ${buyer.firstName}`,
        relatedData: {
          order: order._id,
          product: order.product._id,
          metadata: {
            orderNumber: order.orderNumber
          }
        },
        priority: 'medium'
      });
    } catch (error) {
      console.error('Error sending order delivered notification:', error);
    }
  }
  
  // Offer received notification to seller
  static async notifyOfferReceived(offer, buyer, seller, product) {
    try {
      const discountPercentage = Math.round(((product.price - offer.offerAmount) / product.price) * 100);
      
      await createNotification({
        recipient: seller._id,
        sender: buyer._id,
        type: 'offer_received',
        title: 'New Offer Received!',
        message: `${buyer.firstName} made an offer of $${offer.offerAmount} (${discountPercentage}% off) for "${product.title}"`,
        relatedData: {
          offer: offer._id,
          product: product._id,
          metadata: {
            originalPrice: product.price,
            offerAmount: offer.offerAmount,
            discountPercentage
          }
        },
        priority: 'high'
      });
    } catch (error) {
      console.error('Error sending offer received notification:', error);
    }
  }
  
  // Offer accepted notification to buyer
  static async notifyOfferAccepted(offer, seller, buyer, product) {
    try {
      await createNotification({
        recipient: buyer._id,
        sender: seller._id,
        type: 'offer_accepted',
        title: 'Offer Accepted!',
        message: `${seller.firstName} accepted your offer of $${offer.offerAmount} for "${product.title}"`,
        relatedData: {
          offer: offer._id,
          product: product._id,
          metadata: {
            offerAmount: offer.offerAmount
          }
        },
        priority: 'high'
      });
    } catch (error) {
      console.error('Error sending offer accepted notification:', error);
    }
  }
  
  // Offer declined notification to buyer
  static async notifyOfferDeclined(offer, seller, buyer, product) {
    try {
      await createNotification({
        recipient: buyer._id,
        sender: seller._id,
        type: 'offer_declined',
        title: 'Offer Declined',
        message: `${seller.firstName} declined your offer of $${offer.offerAmount} for "${product.title}"`,
        relatedData: {
          offer: offer._id,
          product: product._id,
          metadata: {
            offerAmount: offer.offerAmount
          }
        },
        priority: 'medium'
      });
    } catch (error) {
      console.error('Error sending offer declined notification:', error);
    }
  }
  
  // New follower notification
  static async notifyNewFollower(follower, followedUser) {
    try {
      await createNotification({
        recipient: followedUser._id,
        sender: follower._id,
        type: 'new_follower',
        title: 'New Follower!',
        message: `${follower.firstName} ${follower.lastName} started following you`,
        relatedData: {
          metadata: {
            followerProfile: follower.profile
          }
        },
        priority: 'low'
      });
    } catch (error) {
      console.error('Error sending new follower notification:', error);
    }
  }
  
  // New message notification
  static async notifyNewMessage(message, sender, recipient, product) {
    try {
      await createNotification({
        recipient: recipient._id,
        sender: sender._id,
        type: 'new_message',
        title: 'New Message',
        message: `${sender.firstName} sent you a message about "${product.title}"`,
        relatedData: {
          chat: message.chat,
          product: product._id,
          metadata: {
            messagePreview: message.text?.substring(0, 50) + (message.text?.length > 50 ? '...' : '')
          }
        },
        priority: 'high'
      });
    } catch (error) {
      console.error('Error sending new message notification:', error);
    }
  }
  
  // New rating notification
  static async notifyNewRating(rating, rater, ratedUser, product) {
    try {
      await createNotification({
        recipient: ratedUser._id,
        sender: rater._id,
        type: 'new_rating',
        title: 'New Rating Received!',
        message: `${rater.firstName} rated you ${rating.rating} stars for "${product.title}"`,
        relatedData: {
          rating: rating._id,
          product: product._id,
          metadata: {
            rating: rating.rating,
            comment: rating.comment?.substring(0, 100)
          }
        },
        priority: 'medium'
      });
    } catch (error) {
      console.error('Error sending new rating notification:', error);
    }
  }
  
  // Payment received notification to seller
  static async notifyPaymentReceived(transaction, buyer, seller, product) {
    try {
      await createNotification({
        recipient: seller._id,
        sender: buyer._id,
        type: 'payment_received',
        title: 'Payment Received!',
        message: `You received $${transaction.amount} payment from ${buyer.firstName} for "${product.title}"`,
        relatedData: {
          transaction: transaction._id,
          product: product._id,
          metadata: {
            amount: transaction.amount,
            paymentMethod: transaction.paymentMethod
          }
        },
        priority: 'high'
      });
    } catch (error) {
      console.error('Error sending payment received notification:', error);
    }
  }
  
  // Product liked notification
  static async notifyProductLiked(product, liker, seller) {
    try {
      await createNotification({
        recipient: seller._id,
        sender: liker._id,
        type: 'product_liked',
        title: 'Product Liked!',
        message: `${liker.firstName} liked your product "${product.title}"`,
        relatedData: {
          product: product._id,
          metadata: {}
        },
        priority: 'low'
      });
    } catch (error) {
      console.error('Error sending product liked notification:', error);
    }
  }
}

module.exports = NotificationService;
