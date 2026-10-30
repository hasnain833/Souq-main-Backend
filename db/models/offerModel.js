const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  chat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  offerAmount: {
    type: Number,
    required: true,
    min: 0
  },
  originalPrice: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined', 'expired', 'cancelled'],
    default: 'pending'
  },
  message: {
    type: String,
    trim: true,
    maxlength: 500,
    default: ''
  },
  // When seller responds
  sellerResponse: {
    message: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ''
    },
    respondedAt: {
      type: Date,
      default: null
    }
  },
  // Expiration (offers expire after 48 hours by default)
  expiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours from now
    }
  },
  // Related message in chat
  relatedMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  }
}, { timestamps: true });

// Indexes for efficient queries
offerSchema.index({ chat: 1, status: 1 });
offerSchema.index({ buyer: 1, status: 1 });
offerSchema.index({ seller: 1, status: 1 });
offerSchema.index({ product: 1, status: 1 });
offerSchema.index({ expiresAt: 1 });

// Static method to get active offer for a chat
offerSchema.statics.getActiveOffer = async function(chatId) {
  return await this.findOne({
    chat: chatId,
    status: { $in: ['pending', 'accepted'] },
    expiresAt: { $gt: new Date() }
  }).populate('buyer', 'userName firstName lastName profile')
    .populate('seller', 'userName firstName lastName profile')
    .populate('product', 'title price product_photos');
};

// Static method to expire old offers
offerSchema.statics.expireOldOffers = async function() {
  return await this.updateMany(
    {
      status: 'pending',
      expiresAt: { $lt: new Date() }
    },
    {
      status: 'expired'
    }
  );
};

// Instance method to check if offer is still valid
offerSchema.methods.isValid = function() {
  return this.status === 'pending' && this.expiresAt > new Date();
};

// Instance method to accept offer
offerSchema.methods.accept = async function(sellerMessage = '') {
  if (!this.isValid()) {
    throw new Error('Offer is no longer valid');
  }
  
  this.status = 'accepted';
  this.sellerResponse.message = sellerMessage;
  this.sellerResponse.respondedAt = new Date();
  
  return await this.save();
};

// Instance method to decline offer
offerSchema.methods.decline = async function(sellerMessage = '') {
  if (!this.isValid()) {
    throw new Error('Offer is no longer valid');
  }
  
  this.status = 'declined';
  this.sellerResponse.message = sellerMessage;
  this.sellerResponse.respondedAt = new Date();
  
  return await this.save();
};

// Pre-save middleware to ensure only one active offer per chat
offerSchema.pre('save', async function(next) {
  if (this.isNew && this.status === 'pending') {
    // Cancel any existing pending offers for this chat
    await this.constructor.updateMany(
      {
        chat: this.chat,
        status: 'pending',
        _id: { $ne: this._id }
      },
      {
        status: 'cancelled'
      }
    );
  }
  next();
});

module.exports = mongoose.model('Offer', offerSchema);
