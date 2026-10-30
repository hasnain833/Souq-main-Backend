const mongoose = require('mongoose');
const Offer = require('../../../../db/models/offerModel');
const Chat = require('../../../../db/models/chatModel');
const Message = require('../../../../db/models/messageModel');
const Product = require('../../../../db/models/productModel');
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');
const NotificationService = require('../../../../services/NotificationService');

// Get socket.io instance (will be set by the main app)
let io = null;
const setSocketIO = (socketInstance) => {
  io = socketInstance;
};

const getSocketIO = () => io;

// Create a new offer
exports.createOffer = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { offerAmount, message = '' } = req.body;
    const buyerId = req.user._id;

    // Validate inputs
    if (!offerAmount || offerAmount <= 0) {
      return errorResponse(res, 'Valid offer amount is required', 400);
    }

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return errorResponse(res, 'Invalid chat ID', 400);
    }

    // Get chat and verify user is the buyer
    const chat = await Chat.findById(chatId)
      .populate('product', 'title price user')
      .populate('buyer', 'userName firstName lastName')
      .populate('seller', 'userName firstName lastName');

    if (!chat) {
      return errorResponse(res, 'Chat not found', 404);
    }

    if (chat.buyer._id.toString() !== buyerId.toString()) {
      return errorResponse(res, 'Only the buyer can make offers', 403);
    }

    // Check if offer amount is reasonable (not higher than original price)
    if (offerAmount > chat.product.price) {
      return errorResponse(res, 'Offer amount cannot exceed the original price', 400);
    }

    // Check if there's already an active offer
    const existingOffer = await Offer.getActiveOffer(chatId);
    if (existingOffer) {
      return errorResponse(res, 'There is already an active offer for this chat', 400);
    }

    // Create the offer
    const offer = new Offer({
      chat: chatId,
      product: chat.product._id,
      buyer: buyerId,
      seller: chat.seller._id,
      offerAmount,
      originalPrice: chat.product.price,
      message: message.trim()
    });

    await offer.save();

    // Create offer message in chat
    const offerMessage = new Message({
      chat: chatId,
      sender: buyerId,
      receiver: chat.seller._id,
      text: `Made an offer of $${offerAmount}${message ? `: ${message}` : ''}`,
      messageType: 'offer',
      offer: offer._id,
      offerData: {
        amount: offerAmount,
        originalPrice: chat.product.price,
        status: 'pending'
      }
    });

    await offerMessage.save();

    // Update chat's last message
    await chat.updateLastMessage(offerMessage._id);

    // Update offer with related message
    offer.relatedMessage = offerMessage._id;
    await offer.save();

    // Populate offer for response
    await offer.populate([
      { path: 'buyer', select: 'userName firstName lastName profile' },
      { path: 'seller', select: 'userName firstName lastName profile' },
      { path: 'product', select: 'title price product_photos' }
    ]);

    // Send notification to seller about new offer
    await NotificationService.notifyOfferReceived(
      offer,
      chat.buyer,
      chat.seller,
      chat.product
    );

    // Emit socket event for real-time updates
    if (io) {
      io.to(chat.roomId).emit('new_message', {
        id: offerMessage._id,
        text: offerMessage.text,
        messageType: offerMessage.messageType,
        offer: offer._id,
        offerData: offerMessage.offerData,
        sender: {
          id: offer.buyer._id,
          userName: offer.buyer.userName,
          firstName: offer.buyer.firstName,
          lastName: offer.buyer.lastName,
          profile: offer.buyer.profile
        },
        receiver: {
          id: offer.seller._id,
          userName: offer.seller.userName,
          firstName: offer.seller.firstName,
          lastName: offer.seller.lastName,
          profile: offer.seller.profile
        },
        seen: false,
        status: 'sent',
        createdAt: offerMessage.createdAt,
        chatId: chat._id,
        roomId: chat.roomId
      });
    }

    successResponse(res, 'Offer created successfully', {
      offer,
      message: offerMessage
    });

  } catch (error) {
    console.error('Create offer error:', error);
    errorResponse(res, 'Failed to create offer', 500);
  }
};

// Get offer details
exports.getOffer = async (req, res) => {
  try {
    const { offerId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(offerId)) {
      return errorResponse(res, 'Invalid offer ID', 400);
    }

    const offer = await Offer.findById(offerId)
      .populate('buyer', 'userName firstName lastName profile')
      .populate('seller', 'userName firstName lastName profile')
      .populate('product', 'title product_photos price user brand size condition colors material category shipping_cost status')
      .populate('chat');

    if (!offer) {
      return errorResponse(res, 'Offer not found', 404);
    }

    // Check if user is participant
    if (offer.buyer._id.toString() !== userId.toString() && 
        offer.seller._id.toString() !== userId.toString()) {
      return errorResponse(res, 'Access denied', 403);
    }

    successResponse(res, 'Offer retrieved successfully', offer);

  } catch (error) {
    console.error('Get offer error:', error);
    errorResponse(res, 'Failed to retrieve offer', 500);
  }
};

// Accept offer (seller only)
exports.acceptOffer = async (req, res) => {
  try {
    const { offerId } = req.params;
    const { message = '' } = req.body;
    const sellerId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(offerId)) {
      return errorResponse(res, 'Invalid offer ID', 400);
    }

    const offer = await Offer.findById(offerId)
      .populate('buyer', 'userName firstName lastName profile')
      .populate('seller', 'userName firstName lastName profile')
      .populate('product', 'title price product_photos')
      .populate('chat');

    if (!offer) {
      return errorResponse(res, 'Offer not found', 404);
    }

    // Check if user is the seller
    if (offer.seller._id.toString() !== sellerId.toString()) {
      return errorResponse(res, 'Only the seller can accept offers', 403);
    }

    // Check if offer is still valid
    if (!offer.isValid()) {
      // If offer has expired, update its status
      if (offer.status === 'pending' && offer.expiresAt < new Date()) {
        offer.status = 'expired';
        await offer.save();

        // Update related message
        if (offer.relatedMessage) {
          await Message.findByIdAndUpdate(
            offer.relatedMessage,
            { 'offerData.status': 'expired' }
          );
        }
      }
      return errorResponse(res, 'This offer has expired and can no longer be accepted', 400);
    }

    // Accept the offer
    await offer.accept(message.trim());

    // Send notification to buyer about accepted offer
    await NotificationService.notifyOfferAccepted(
      offer,
      offer.seller,
      offer.buyer,
      offer.product
    );

    // Update original offer message status instead of creating new message
    let updatedMessage = null;
    if (offer.relatedMessage) {
      updatedMessage = await Message.findByIdAndUpdate(
        offer.relatedMessage,
        {
          'offerData.status': 'accepted',
          text: `Made an offer of $${offer.offerAmount}${message ? ` - Seller response: ${message}` : ''}`
        },
        { new: true }
      ).populate('sender', 'userName firstName lastName profile')
       .populate('receiver', 'userName firstName lastName profile');
    }

    // Emit socket event for real-time updates
    if (io && updatedMessage) {
      io.to(offer.chat.roomId).emit('message_updated', {
        id: updatedMessage._id,
        text: updatedMessage.text,
        messageType: updatedMessage.messageType,
        offer: offer._id,
        offerData: updatedMessage.offerData,
        sender: {
          id: updatedMessage.sender._id,
          userName: updatedMessage.sender.userName,
          firstName: updatedMessage.sender.firstName,
          lastName: updatedMessage.sender.lastName,
          profile: updatedMessage.sender.profile
        },
        receiver: {
          id: updatedMessage.receiver._id,
          userName: updatedMessage.receiver.userName,
          firstName: updatedMessage.receiver.firstName,
          lastName: updatedMessage.receiver.lastName,
          profile: updatedMessage.receiver.profile
        },
        seen: updatedMessage.seen,
        status: updatedMessage.status,
        createdAt: updatedMessage.createdAt,
        chatId: offer.chat._id,
        roomId: offer.chat.roomId
      });
    }

    successResponse(res, 'Offer accepted successfully', {
      offer,
      message: updatedMessage
    });

  } catch (error) {
    console.error('Accept offer error:', error);
    errorResponse(res, 'Failed to accept offer', 500);
  }
};

// Decline offer (seller only)
exports.declineOffer = async (req, res) => {
  try {
    const { offerId } = req.params;
    const { message = '' } = req.body;
    const sellerId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(offerId)) {
      return errorResponse(res, 'Invalid offer ID', 400);
    }

    const offer = await Offer.findById(offerId)
      .populate('buyer', 'userName firstName lastName profile')
      .populate('seller', 'userName firstName lastName profile')
      .populate('product', 'title price product_photos')
      .populate('chat');

    if (!offer) {
      return errorResponse(res, 'Offer not found', 404);
    }

    // Check if user is the seller
    if (offer.seller._id.toString() !== sellerId.toString()) {
      return errorResponse(res, 'Only the seller can decline offers', 403);
    }

    // Check if offer is still valid
    if (!offer.isValid()) {
      // If offer has expired, update its status
      if (offer.status === 'pending' && offer.expiresAt < new Date()) {
        offer.status = 'expired';
        await offer.save();

        // Update related message
        if (offer.relatedMessage) {
          await Message.findByIdAndUpdate(
            offer.relatedMessage,
            { 'offerData.status': 'expired' }
          );
        }
      }
      return errorResponse(res, 'This offer has expired and can no longer be declined', 400);
    }

    // Decline the offer
    await offer.decline(message.trim());

    // Send notification to buyer about declined offer
    await NotificationService.notifyOfferDeclined(
      offer,
      offer.seller,
      offer.buyer,
      offer.product
    );

    // Update original offer message status instead of creating new message
    let updatedMessage = null;
    if (offer.relatedMessage) {
      updatedMessage = await Message.findByIdAndUpdate(
        offer.relatedMessage,
        {
          'offerData.status': 'declined',
          text: `Made an offer of $${offer.offerAmount}${message ? ` - Seller response: ${message}` : ''}`
        },
        { new: true }
      ).populate('sender', 'userName firstName lastName profile')
       .populate('receiver', 'userName firstName lastName profile');
    }

    // Emit socket event for real-time updates
    if (io && updatedMessage) {
      io.to(offer.chat.roomId).emit('message_updated', {
        id: updatedMessage._id,
        text: updatedMessage.text,
        messageType: updatedMessage.messageType,
        offer: offer._id,
        offerData: updatedMessage.offerData,
        sender: {
          id: updatedMessage.sender._id,
          userName: updatedMessage.sender.userName,
          firstName: updatedMessage.sender.firstName,
          lastName: updatedMessage.sender.lastName,
          profile: updatedMessage.sender.profile
        },
        receiver: {
          id: updatedMessage.receiver._id,
          userName: updatedMessage.receiver.userName,
          firstName: updatedMessage.receiver.firstName,
          lastName: updatedMessage.receiver.lastName,
          profile: updatedMessage.receiver.profile
        },
        seen: updatedMessage.seen,
        status: updatedMessage.status,
        createdAt: updatedMessage.createdAt,
        chatId: offer.chat._id,
        roomId: offer.chat.roomId
      });
    }

    successResponse(res, 'Offer declined successfully', {
      offer,
      message: updatedMessage
    });

  } catch (error) {
    console.error('Decline offer error:', error);
    errorResponse(res, 'Failed to decline offer', 500);
  }
};

// Get active offer for a chat
exports.getChatOffer = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return errorResponse(res, 'Invalid chat ID', 400);
    }

    // Verify user is participant in chat
    const chat = await Chat.findOne({
      _id: chatId,
      participants: userId
    });

    if (!chat) {
      return errorResponse(res, 'Chat not found or access denied', 404);
    }

    const offer = await Offer.getActiveOffer(chatId);

    successResponse(res, 'Chat offer retrieved successfully', offer);

  } catch (error) {
    console.error('Get chat offer error:', error);
    errorResponse(res, 'Failed to retrieve chat offer', 500);
  }
};

// Manual expire offers (for testing)
exports.expireOffers = async (req, res) => {
  try {
    const { expireOldOffers } = require('../../../utils/scheduler');
    await expireOldOffers();
    successResponse(res, 'Offer expiration job completed successfully');
  } catch (error) {
    console.error('Manual expire offers error:', error);
    errorResponse(res, 'Failed to expire offers', 500);
  }
};

// Export the socket setter function
module.exports.setSocketIO = setSocketIO;
