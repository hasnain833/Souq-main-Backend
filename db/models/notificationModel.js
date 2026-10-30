const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  // Recipient of the notification
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Sender of the notification (optional for system notifications)
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Notification type
  type: {
    type: String,
    enum: [
      'order_confirmed',
      'order_shipped',
      'order_delivered',
      'offer_received',
      'offer_accepted',
      'offer_declined',
      'offer_expired',
      'new_follower',
      'new_message',
      'new_rating',
      'payment_received',
      'payment_completed',
      'product_liked',
      'system_announcement',
      'admin',
      'system',
      'announcement'
    ],
    required: true,
    index: true
  },
  
  // Notification title
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  
  // Notification message/content
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  
  // Related entities
  relatedData: {
    // Product reference
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    
    // Order reference
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order'
    },
    
    // Transaction reference
    transaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction'
    },
    
    // Offer reference
    offer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Offer'
    },
    
    // Chat reference
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat'
    },
    
    // Rating reference
    rating: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Rating'
    },
    
    // Additional data (flexible for different notification types)
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  
  // Notification status
  status: {
    type: String,
    enum: ['unread', 'read', 'archived'],
    default: 'unread',
    index: true
  },
  
  // Priority level
  priority: {
    type: String,
    enum: ['low', 'normal', 'medium', 'high', 'urgent'],
    default: 'normal'
  },
  
  // Delivery channels
  channels: {
    inApp: {
      type: Boolean,
      default: true
    },
    email: {
      type: Boolean,
      default: false
    },
    push: {
      type: Boolean,
      default: false
    }
  },
  
  // Timestamps
  readAt: {
    type: Date
  },
  
  archivedAt: {
    type: Date
  },
  
  // Expiration (for temporary notifications)
  expiresAt: {
    type: Date
  }
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
notificationSchema.index({ recipient: 1, status: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, type: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // Auto-delete after 30 days
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for expiration

// Virtual for time ago
notificationSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const diff = now - this.createdAt;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return this.createdAt.toLocaleDateString();
});

// Instance methods
notificationSchema.methods.markAsRead = function() {
  this.status = 'read';
  this.readAt = new Date();
  return this.save();
};

notificationSchema.methods.archive = function() {
  this.status = 'archived';
  this.archivedAt = new Date();
  return this.save();
};

// Static methods
notificationSchema.statics.createNotification = async function(data) {
  try {
    const notification = new this(data);
    await notification.save();
    
    // Populate related data for real-time emission
    await notification.populate([
      { path: 'sender', select: 'firstName lastName profile' },
      { path: 'relatedData.product', select: 'title product_photos price' },
      { path: 'relatedData.order', select: 'orderNumber status' }
    ]);
    
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

notificationSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({ 
    recipient: userId, 
    status: 'unread' 
  });
};

notificationSchema.statics.markAllAsRead = function(userId) {
  return this.updateMany(
    { recipient: userId, status: 'unread' },
    { 
      status: 'read', 
      readAt: new Date() 
    }
  );
};

module.exports = mongoose.model('Notification', notificationSchema);
