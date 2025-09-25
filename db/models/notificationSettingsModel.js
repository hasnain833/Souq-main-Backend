const mongoose = require('mongoose');

const notificationSettingsSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  
  // Global email notifications toggle
  emailEnabled: {
    type: Boolean,
    default: true
  },
  
  // High-priority notifications
  highPriority: {
    newMessages: {
      type: Boolean,
      default: true
    },
    newFeedback: {
      type: Boolean,
      default: true
    },
    discountedItems: {
      type: Boolean,
      default: true
    }
  },
  
  // Other notifications
  other: {
    favoritedItems: {
      type: Boolean,
      default: true
    },
    newFollowers: {
      type: Boolean,
      default: true
    },
    newProducts: {
      type: Boolean,
      default: true
    }
  },
  
  // Order and transaction notifications
  orders: {
    orderConfirmed: {
      type: Boolean,
      default: true
    },
    orderShipped: {
      type: Boolean,
      default: true
    },
    orderDelivered: {
      type: Boolean,
      default: true
    },
    paymentReceived: {
      type: Boolean,
      default: true
    }
  },
  
  // Offer notifications
  offers: {
    offerReceived: {
      type: Boolean,
      default: true
    },
    offerAccepted: {
      type: Boolean,
      default: true
    },
    offerDeclined: {
      type: Boolean,
      default: true
    },
    offerExpired: {
      type: Boolean,
      default: true
    }
  },
  
  // Social notifications
  social: {
    newFollower: {
      type: Boolean,
      default: true
    },
    productLiked: {
      type: Boolean,
      default: true
    },
    newRating: {
      type: Boolean,
      default: true
    }
  },
  
  // Daily limit for notifications
  dailyLimit: {
    type: Number,
    enum: [2, 5, -1], // -1 means no limit
    default: -1
  },
  
  // Quiet hours (when not to send notifications)
  quietHours: {
    enabled: {
      type: Boolean,
      default: false
    },
    startTime: {
      type: String, // Format: "22:00"
      default: "22:00"
    },
    endTime: {
      type: String, // Format: "08:00"
      default: "08:00"
    }
  },
  
  // Notification delivery preferences
  deliveryPreferences: {
    inApp: {
      type: Boolean,
      default: true
    },
    email: {
      type: Boolean,
      default: true
    },
    push: {
      type: Boolean,
      default: false
    }
  }
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Static method to get or create settings for a user
notificationSettingsSchema.statics.getOrCreateSettings = async function(userId) {
  try {
    let settings = await this.findOne({ user: userId });
    
    if (!settings) {
      settings = new this({ user: userId });
      await settings.save();
    }
    
    return settings;
  } catch (error) {
    console.error('Error getting/creating notification settings:', error);
    throw error;
  }
};

// Method to check if a notification type is enabled for a user
notificationSettingsSchema.methods.isNotificationEnabled = function(notificationType) {
  // Check if in-app notifications are enabled for this type
  // Note: emailEnabled only affects email delivery, not in-app notifications

  // Map notification types to settings
  const typeMapping = {
    'new_message': this.highPriority.newMessages,
    'new_rating': this.highPriority.newFeedback,
    'product_liked': this.other.favoritedItems,
    'new_follower': this.other.newFollowers,
    'order_confirmed': this.orders.orderConfirmed,
    'order_shipped': this.orders.orderShipped,
    'order_delivered': this.orders.orderDelivered,
    'payment_received': this.orders.paymentReceived,
    'offer_received': this.offers.offerReceived,
    'offer_accepted': this.offers.offerAccepted,
    'offer_declined': this.offers.offerDeclined,
    'offer_expired': this.offers.offerExpired,
    'social': this.social.newFollower || this.social.productLiked || this.social.newRating
  };

  return typeMapping[notificationType] !== undefined ? typeMapping[notificationType] : true;
};

// Method to check if we're in quiet hours
notificationSettingsSchema.methods.isInQuietHours = function() {
  if (!this.quietHours.enabled) return false;
  
  const now = new Date();
  const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
  
  const startTime = this.quietHours.startTime;
  const endTime = this.quietHours.endTime;
  
  // Handle overnight quiet hours (e.g., 22:00 to 08:00)
  if (startTime > endTime) {
    return currentTime >= startTime || currentTime <= endTime;
  } else {
    return currentTime >= startTime && currentTime <= endTime;
  }
};

module.exports = mongoose.model('NotificationSettings', notificationSettingsSchema, 'notificationsettings');
