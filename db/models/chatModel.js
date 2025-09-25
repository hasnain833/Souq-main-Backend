const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
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
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Room ID for socket connections - combination of product and participants
  roomId: {
    type: String,
    required: true,
    unique: true
  }
}, { timestamps: true });

// Create compound index for efficient queries
chatSchema.index({ product: 1, buyer: 1, seller: 1 }, { unique: true });
chatSchema.index({ participants: 1 });
chatSchema.index({ roomId: 1 });

// Static method to create or find existing chat
chatSchema.statics.findOrCreateChat = async function(productId, buyerId, sellerId) {
  // Check if chat already exists
  let chat = await this.findOne({
    product: productId,
    buyer: buyerId,
    seller: sellerId
  }).populate('product', 'title user')
    .populate('buyer', 'userName firstName lastName profile')
    .populate('seller', 'userName firstName lastName profile')
    .populate('lastMessage');

  if (!chat) {
    // Create new chat with room ID
    const roomId = `${productId}_${buyerId}_${sellerId}`;
    chat = await this.create({
      product: productId,
      participants: [buyerId, sellerId],
      buyer: buyerId,
      seller: sellerId,
      roomId: roomId
    });

    // Populate the newly created chat
    chat = await this.findById(chat._id)
      .populate('product', 'title user')
      .populate('buyer', 'userName firstName lastName profile')
      .populate('seller', 'userName firstName lastName profile')
      .populate('lastMessage');
  }

  return chat;
};

// Method to update last message
chatSchema.methods.updateLastMessage = async function(messageId) {
  this.lastMessage = messageId;
  this.lastMessageAt = new Date();
  return await this.save();
};

module.exports = mongoose.model('Chat', chatSchema);
