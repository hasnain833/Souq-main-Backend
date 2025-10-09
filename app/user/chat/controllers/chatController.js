const Chat = require('../../../../db/models/chatModel');
const Message = require('../../../../db/models/messageModel');
const Product = require('../../../../db/models/productModel');
const User = require('../../../../db/models/userModel');
const BlockedUser = require('../../../../db/models/blockedUserModel');
const UserReport = require('../../../../db/models/userReportModel');
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');
const { createInitialSellerMessage } = require('../../../../utils/chatHelpers');
const mongoose = require('mongoose');

// Create or get existing chat for a product
exports.createOrGetChat = async (req, res) => {
  try {
    const { productId } = req.params;
    const buyerId = req.user._id;

    // Validate product ID
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return errorResponse(res, 'Invalid product ID', 400);
    }

    // Get product details with full seller information (populate if available)
    const product = await Product.findById(productId).populate('user', 'userName firstName lastName profile city country lastLoginAt');
    if (!product) {
      return errorResponse(res, 'Product not found', 404);
    }

    // Ensure product.user exists; if only ObjectId is stored, fetch the user
    let sellerUser = product.user;
    if (!sellerUser) {
      return errorResponse(res, 'Product seller not found', 404);
    }

    // If sellerUser is an ObjectId (no fields), hydrate it
    if (sellerUser && !sellerUser.userName) {
      sellerUser = await User.findById(sellerUser).select('userName firstName lastName profile city country lastLoginAt');
      if (!sellerUser) {
        return errorResponse(res, 'Seller user not found', 404);
      }
    }

    const sellerId = sellerUser._id;

    // Check if user is trying to chat with themselves
    if (buyerId.toString() === sellerId.toString()) {
      return errorResponse(res, 'You cannot chat with yourself', 400);
    }

    // Check if chat already exists first
    const existingChat = await Chat.findOne({
      product: productId,
      buyer: buyerId,
      seller: sellerId
    }).populate('product', 'title product_photos price user brand size condition colors material category shipping_cost status')
      .populate('buyer', 'userName firstName lastName profile')
      .populate('seller', 'userName firstName lastName profile')
      .populate('lastMessage');

    let chat;
    let isExisting = false;

    if (existingChat) {
      // Chat already exists - redirect to existing chat
      chat = existingChat;
      isExisting = true;
    } else {
      // Create new chat
      chat = await Chat.findOrCreateChat(productId, buyerId, sellerId);
      isExisting = false;

      // Create initial welcome message from seller for new chats
      const sellerName = sellerUser.firstName && sellerUser.lastName
        ? `${sellerUser.firstName} ${sellerUser.lastName}`
        : sellerUser.userName;

      // Format location
      const location = sellerUser.city && sellerUser.country
        ? `📍 ${sellerUser.country}, ${sellerUser.city}`
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

      const lastSeenText = getLastSeenText(sellerUser.lastLoginAt);

      const welcomeText = `Hi, I'm ${sellerName}

No reviews yet

${location}
${lastSeenText}`;

      // Create the initial message from seller using helper function
      const initialMessage = await createInitialSellerMessage(
        chat._id,
        sellerId,
        buyerId,
        sellerUser
      );

      // Update chat's last message to the initial message
      await chat.updateLastMessage(initialMessage._id);

      // Re-populate the chat with the new last message
      chat = await Chat.findById(chat._id)
        .populate('product', 'title product_photos price user brand size condition colors material category shipping_cost status')
        .populate('buyer', 'userName firstName lastName profile')
        .populate('seller', 'userName firstName lastName profile')
        .populate('lastMessage');
    }

    const responseMessage = isExisting ? 'Existing chat found - redirecting to chat' : 'New chat created successfully';

    return successResponse(res, responseMessage, {
      chat: {
        id: chat._id,
        roomId: chat.roomId,
        isExisting: isExisting,
        product: {
          id: chat.product._id,
          title: chat.product.title,
          photos: chat.product.product_photos,
          price: chat.product.price,
          brand: chat.product.brand,
          size: chat.product.size,
          condition: chat.product.condition,
          colors: chat.product.colors,
          material: chat.product.material,
          category: chat.product.category,
          shippingCost: chat.product.shipping_cost,
          status: chat.product.status,
          seller: {
            id: chat.seller._id,
            userName: chat.seller.userName,
            firstName: chat.seller.firstName,
            lastName: chat.seller.lastName,
            profile: chat.seller.profile
          }
        },
        buyer: {
          id: chat.buyer._id,
          userName: chat.buyer.userName,
          firstName: chat.buyer.firstName,
          lastName: chat.buyer.lastName,
          profile: chat.buyer.profile
        },
        lastMessage: chat.lastMessage,
        lastMessageAt: chat.lastMessageAt,
        createdAt: chat.createdAt
      }
    });

  } catch (error) {
    console.error('Create/Get chat error:', error);
    return errorResponse(res, 'Failed to create or get chat', 500, error.message);
  }
};

// Get all chats for a user
exports.getUserChats = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const chats = await Chat.find({
      participants: userId,
      isActive: true
    })
      .populate('product', 'title product_photos price user brand size condition colors material category shipping_cost status')
      .populate('buyer', 'userName firstName lastName profile')
      .populate('seller', 'userName firstName lastName profile')
      .populate({
        path: 'lastMessage',
        populate: {
          path: 'sender',
          select: 'userName firstName lastName'
        }
      })
      .sort({ lastMessageAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get unread count for each chat
    const chatsWithUnreadCount = await Promise.all(
      chats.map(async (chat) => {
        const unreadCount = await Message.getUnreadCount(chat._id, userId);
        const otherUser = chat.buyer._id.toString() === userId.toString() ? chat.seller : chat.buyer;

        return {
          id: chat._id,
          roomId: chat.roomId,
          product: {
            id: chat.product._id,
            title: chat.product.title,
            photos: chat.product.product_photos,
            price: chat.product.price,
            brand: chat.product.brand,
            size: chat.product.size,
            condition: chat.product.condition,
            colors: chat.product.colors,
            material: chat.product.material,
            category: chat.product.category,
            shippingCost: chat.product.shipping_cost,
            status: chat.product.status
          },
          otherUser: {
            id: otherUser._id,
            userName: otherUser.userName,
            firstName: otherUser.firstName,
            lastName: otherUser.lastName,
            profile: otherUser.profile
          },
          lastMessage: chat.lastMessage ? {
            id: chat.lastMessage._id,
            text: chat.lastMessage.text,
            messageType: chat.lastMessage.messageType,
            imageUrl: chat.lastMessage.imageUrl,
            sender: chat.lastMessage.sender,
            createdAt: chat.lastMessage.createdAt
          } : null,
          lastMessageAt: chat.lastMessageAt,
          unreadCount,
          createdAt: chat.createdAt
        };
      })
    );

    const total = await Chat.countDocuments({
      participants: userId,
      isActive: true
    });

    return successResponse(res, 'Chats retrieved successfully', {
      chats: chatsWithUnreadCount,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalChats: total,
        hasNextPage: skip + chats.length < total
      }
    });

  } catch (error) {
    console.error('Get user chats error:', error);
    return errorResponse(res, 'Failed to get chats', 500, error.message);
  }
};

// Get chat messages
exports.getChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;
    const { page = 1, limit = 50 } = req.query;

    // Validate chat ID
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return errorResponse(res, 'Invalid chat ID', 400);
    }

    // Check if user is participant in this chat
    const chat = await Chat.findOne({
      _id: chatId,
      participants: userId
    });

    if (!chat) {
      return errorResponse(res, 'Chat not found or access denied', 404);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const messages = await Message.find({ chat: chatId })
      .populate('sender', 'userName firstName lastName profile')
      .populate('receiver', 'userName firstName lastName profile')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Mark messages as seen
    await Message.markAsSeen(chatId, userId);

    const total = await Message.countDocuments({ chat: chatId });

    return successResponse(res, 'Messages retrieved successfully', {
      messages: messages.reverse().map(msg => ({
        id: msg._id,
        text: msg.text,
        messageType: msg.messageType,
        attachments: msg.attachments,
        // Include imageUrl for image messages
        imageUrl: msg.imageUrl ||
          (msg.messageType === 'image' && msg.attachments?.[0]?.url
            ? msg.attachments[0].url
            : undefined),
        // Include offer data for offer messages
        offer: msg.offer,
        offerData: msg.offerData,
        sender: {
          id: msg.sender._id,
          userName: msg.sender.userName,
          firstName: msg.sender.firstName,
          lastName: msg.sender.lastName,
          profile: msg.sender.profile
        },
        receiver: {
          id: msg.receiver._id,
          userName: msg.receiver.userName,
          firstName: msg.receiver.firstName,
          lastName: msg.receiver.lastName,
          profile: msg.receiver.profile
        },
        seen: msg.seen,
        seenAt: msg.seenAt,
        status: msg.status,
        edited: msg.edited,
        editedAt: msg.editedAt,
        createdAt: msg.createdAt
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalMessages: total,
        hasNextPage: skip + messages.length < total
      }
    });

  } catch (error) {
    console.error('Get chat messages error:', error);
    return errorResponse(res, 'Failed to get messages', 500, error.message);
  }
};

// Send message (HTTP endpoint - for fallback)
exports.sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { text, messageType = 'text' } = req.body;
    const senderId = req.user._id;

    // Validate inputs
    if (!text || !text.trim()) {
      return errorResponse(res, 'Message text is required', 400);
    }

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return errorResponse(res, 'Invalid chat ID', 400);
    }

    // Check if user is participant in this chat
    const chat = await Chat.findOne({
      _id: chatId,
      participants: senderId
    });

    if (!chat) {
      return errorResponse(res, 'Chat not found or access denied', 404);
    }

    // Determine receiver
    const receiverId = chat.participants.find(p => p.toString() !== senderId.toString());

    // Create message
    const message = await Message.create({
      chat: chatId,
      sender: senderId,
      receiver: receiverId,
      text: text.trim(),
      messageType
    });

    // Update chat's last message
    await chat.updateLastMessage(message._id);

    // Populate message for response
    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'userName firstName lastName profile')
      .populate('receiver', 'userName firstName lastName profile');

    return successResponse(res, 'Message sent successfully', {
      message: {
        id: populatedMessage._id,
        text: populatedMessage.text,
        messageType: populatedMessage.messageType,
        sender: {
          id: populatedMessage.sender._id,
          userName: populatedMessage.sender.userName,
          firstName: populatedMessage.sender.firstName,
          lastName: populatedMessage.sender.lastName,
          profile: populatedMessage.sender.profile
        },
        receiver: {
          id: populatedMessage.receiver._id,
          userName: populatedMessage.receiver.userName,
          firstName: populatedMessage.receiver.firstName,
          lastName: populatedMessage.receiver.lastName,
          profile: populatedMessage.receiver.profile
        },
        seen: populatedMessage.seen,
        status: populatedMessage.status,
        createdAt: populatedMessage.createdAt
      }
    });

  } catch (error) {
    console.error('Send message error:', error);
    return errorResponse(res, 'Failed to send message', 500, error.message);
  }
};

// Mark messages as seen
exports.markMessagesAsSeen = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return errorResponse(res, 'Invalid chat ID', 400);
    }

    // Check if user is participant in this chat
    const chat = await Chat.findOne({
      _id: chatId,
      participants: userId
    });

    if (!chat) {
      return errorResponse(res, 'Chat not found or access denied', 404);
    }

    const result = await Message.markAsSeen(chatId, userId);

    return successResponse(res, 'Messages marked as seen', {
      modifiedCount: result.modifiedCount
    });

  } catch (error) {
    console.error('Mark messages as seen error:', error);
    return errorResponse(res, 'Failed to mark messages as seen', 500, error.message);
  }
};

exports.submitRating = async (req, res) => {
  try {
    const userId = req.user.id;
    const { transactionId } = req.params;
    const {
      rating,
      review,
      categories,
      ratingType,
      transactionType = 'escrow' // Accept transactionType from body or default to escrow
    } = req.body;

    // Validate required fields
    if (!rating || !ratingType) {
      return res.status(400).json({
        success: false,
        error: 'Rating and rating type are required'
      });
    }

    // Validate rating value
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be an integer between 1 and 5'
      });
    }

    // Import transaction utils
    const { findEscrowTransaction, findStandardPayment } = require('../../../../utils/transactionUtils');
    let transaction, transactionModel, transactionField;

    // 1. Try to find as escrow or standard based on transactionType
    if (transactionType === 'standard') {
      transaction = await findStandardPayment(transactionId, true);
      transactionModel = 'standardPayment';
      transactionField = 'standardPayment';
    } else {
      transaction = await findEscrowTransaction(transactionId, true);
      transactionModel = 'escrowTransaction';
      transactionField = 'escrowTransaction';
    }

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    // User role check
    const userObjectId = req.user._id;
    const isBuyer = transaction.buyer._id.toString() === userObjectId.toString();
    const isSeller = transaction.seller._id.toString() === userObjectId.toString();

    if (!isBuyer && !isSeller) {
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to rate this transaction'
      });
    }

    // Validate rating type matches user role
    if ((isBuyer && ratingType !== 'buyer_to_seller') ||
        (isSeller && ratingType !== 'seller_to_buyer')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid rating type for your role in this transaction'
      });
    }

    // Check if transaction is completed or funds are held (payment successful)
    // You may want to adjust valid statuses for standard payments if needed
    const validStatuses = ['completed', 'funds_held'];
    if (!validStatuses.includes(transaction.status)) {
      return res.status(400).json({
        success: false,
        error: 'You can only rate transactions where payment has been processed'
      });
    }

    // Determine who is being rated
    const ratedUserId = isBuyer ? transaction.seller._id : transaction.buyer._id;

    // Check if rating already exists
    const ratingQuery = {
      [transactionField]: transaction._id,
      ratedBy: userObjectId,
      ratingType: ratingType
    };
    const existingRating = await Rating.findOne(ratingQuery);

    if (existingRating) {
      return res.status(400).json({
        success: false,
        error: 'You have already rated this transaction'
      });
    }

    // Create the rating
    const newRating = new Rating({
      [transactionField]: transaction._id,
      product: transaction.product._id,
      ratedBy: userObjectId,
      ratedUser: ratedUserId,
      ratingType: ratingType,
      rating: rating,
      review: review || '',
      categories: categories || {},
      status: 'published',
      metadata: {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip
      }
    });

    await newRating.save();

    // Populate the rating for response
    await newRating.populate([
      { path: 'ratedBy', select: 'firstName lastName profile' },
      { path: 'ratedUser', select: 'firstName lastName profile' },
      { path: 'product', select: 'title product_photos' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Rating submitted successfully',
      data: {
        rating: newRating
      }
    });

  } catch (error) {
    console.error('Error submitting rating:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit rating'
    });
  }
};

// Delete chat
exports.deleteChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return errorResponse(res, 'Invalid chat ID', 400);
    }

    // Check if user is participant in this chat
    const chat = await Chat.findOne({
      _id: chatId,
      participants: userId
    });

    if (!chat) {
      return errorResponse(res, 'Chat not found or access denied', 404);
    }

    // Soft delete - mark as inactive instead of hard delete
    await Chat.findByIdAndUpdate(chatId, { isActive: false });

    // Also soft delete all messages in this chat (only for future filtering if needed)
    await Message.updateMany(
      { chat: chatId },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date()
        }
      }
    );

    return successResponse(res, 'Chat deleted successfully');

  } catch (error) {
    console.error('Delete chat error:', error);
    return errorResponse(res, 'Failed to delete chat', 500, error.message);
  }
};

// Block user
exports.blockUser = async (req, res) => {
  try {
    const { userId: blockedUserId } = req.params;
    const blockerId = req.user._id;
    const { reason = 'other', notes = '' } = req.body;

    if (!mongoose.Types.ObjectId.isValid(blockedUserId)) {
      return errorResponse(res, 'Invalid user ID', 400);
    }

    // Check if user is trying to block themselves
    if (blockerId.toString() === blockedUserId.toString()) {
      return errorResponse(res, 'You cannot block yourself', 400);
    }

    // Check if user exists
    const userToBlock = await User.findById(blockedUserId);
    if (!userToBlock) {
      return errorResponse(res, 'User not found', 404);
    }

    // Block the user
    const blocked = await BlockedUser.blockUser(blockerId, blockedUserId, reason, notes);

    return successResponse(res, 'User blocked successfully', {
      blocked: {
        id: blocked._id,
        blockedUser: {
          id: userToBlock._id,
          userName: userToBlock.userName,
          firstName: userToBlock.firstName,
          lastName: userToBlock.lastName
        },
        reason: blocked.reason,
        createdAt: blocked.createdAt
      }
    });

  } catch (error) {
    console.error('Block user error:', error);
    if (error.message === 'User is already blocked') {
      return errorResponse(res, error.message, 400);
    }
    return errorResponse(res, 'Failed to block user', 500, error.message);
  }
};

// Unblock user
exports.unblockUser = async (req, res) => {
  try {
    const { userId: blockedUserId } = req.params;
    const blockerId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(blockedUserId)) {
      return errorResponse(res, 'Invalid user ID', 400);
    }

    // Unblock the user
    await BlockedUser.unblockUser(blockerId, blockedUserId);

    return successResponse(res, 'User unblocked successfully');

  } catch (error) {
    console.error('Unblock user error:', error);
    if (error.message === 'User is not blocked') {
      return errorResponse(res, error.message, 400);
    }
    return errorResponse(res, 'Failed to unblock user', 500, error.message);
  }
};

// Report user
exports.reportUser = async (req, res) => {
  try {
    const { userId: reportedUserId } = req.params;
    const reporterId = req.user._id;
    const { reason, description, evidence = [] } = req.body;

    if (!mongoose.Types.ObjectId.isValid(reportedUserId)) {
      return errorResponse(res, 'Invalid user ID', 400);
    }

    if (!reason || !description) {
      return errorResponse(res, 'Reason and description are required', 400);
    }

    // Check if user exists
    const userToReport = await User.findById(reportedUserId);
    if (!userToReport) {
      return errorResponse(res, 'User not found', 404);
    }

    // Create the report
    const report = await UserReport.createReport({
      reporter: reporterId,
      reported: reportedUserId,
      reason,
      description,
      evidence
    });

    return successResponse(res, 'User reported successfully', {
      report: {
        id: report._id,
        reportedUser: {
          id: userToReport._id,
          userName: userToReport.userName,
          firstName: userToReport.firstName,
          lastName: userToReport.lastName
        },
        reason: report.reason,
        status: report.status,
        createdAt: report.createdAt
      }
    });

  } catch (error) {
    console.error('Report user error:', error);
    if (error.message === 'You cannot report yourself') {
      return errorResponse(res, error.message, 400);
    }
    return errorResponse(res, 'Failed to report user', 500, error.message);
  }
};

// Get blocked users
exports.getBlockedUsers = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20 } = req.query;

    const result = await BlockedUser.getBlockedUsers(userId, parseInt(page), parseInt(limit));

    return successResponse(res, 'Blocked users retrieved successfully', {
      blockedUsers: result.blockedUsers.map(blocked => ({
        id: blocked._id,
        blockedUser: {
          id: blocked.blocked._id,
          userName: blocked.blocked.userName,
          firstName: blocked.blocked.firstName,
          lastName: blocked.blocked.lastName,
          profile: blocked.blocked.profile
        },
        reason: blocked.reason,
        notes: blocked.notes,
        createdAt: blocked.createdAt
      })),
      pagination: result.pagination
    });

  } catch (error) {
    console.error('Get blocked users error:', error);
    return errorResponse(res, 'Failed to get blocked users', 500, error.message);
  }
};
