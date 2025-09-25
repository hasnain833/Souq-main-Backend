const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  chat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String,
    required: function() {
      // Text is required for text messages, optional for image messages
      return this.messageType === 'text';
    },
    trim: true,
    default: ''
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'file', 'system', 'offer', 'offer_accepted', 'offer_declined', 'offer_expired'],
    default: 'text'
  },
  // For file/image messages
  attachments: [{
    url: String,
    type: String, // 'image', 'file'
    name: String,
    size: Number
  }],
  // Temporary field for image URLs (fallback)
  imageUrl: {
    type: String,
    default: null
  },
  seen: {
    type: Boolean,
    default: false
  },
  seenAt: {
    type: Date,
    default: null
  },
  // For system messages (user joined, left, etc.)
  systemMessage: {
    type: String,
    default: null
  },
  // Message status
  status: {
    type: String,
    enum: ['sent', 'delivered', 'seen'],
    default: 'sent'
  },
  // For editing messages
  edited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date,
    default: null
  },
  // For offer-related messages
  offer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Offer',
    default: null
  },
  // Offer data for quick access (denormalized)
  offerData: {
    amount: {
      type: Number,
      default: null
    },
    originalPrice: {
      type: Number,
      default: null
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'expired', 'cancelled'],
      default: null
    }
  },
  // Soft delete fields
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

// Indexes for efficient queries
messageSchema.index({ chat: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ receiver: 1 });
messageSchema.index({ seen: 1 });

// Static method to mark messages as seen
messageSchema.statics.markAsSeen = async function(chatId, userId) {
  return await this.updateMany(
    {
      chat: chatId,
      receiver: userId,
      seen: false
    },
    {
      seen: true,
      seenAt: new Date(),
      status: 'seen'
    }
  );
};

// Static method to get unread count
messageSchema.statics.getUnreadCount = async function(chatId, userId) {
  return await this.countDocuments({
    chat: chatId,
    receiver: userId,
    seen: false
  });
};

module.exports = mongoose.model('Message', messageSchema);
