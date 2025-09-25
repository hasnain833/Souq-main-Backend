const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const Message = require("../db/models/messageModel");
const Chat = require("../db/models/chatModel");
const User = require("../db/models/userModel");
const Offer = require("../db/models/offerModel");
const { setSocketIO } = require("../app/user/notifications/controllers/notificationController");
const NotificationService = require("../services/NotificationService");


const initSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    // Add connection limits and timeouts
    pingTimeout: 60000, // 60 seconds
    pingInterval: 25000, // 25 seconds
    maxHttpBufferSize: 1e6, // 1MB
    transports: ['websocket', 'polling']
  });

  // Store connected users
  const connectedUsers = new Map();

  // Rate limiting for join_chat events
  const joinChatRateLimit = new Map();

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error("Authentication error: No token provided"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded._id || decoded.id;

      // Get user details
      const user = await User.findById(userId).select('userName firstName lastName profile email deletedAt');
      if (!user) {
        return next(new Error("Authentication error: User not found"));
      }

      // Check if user is suspended
      if (user.deletedAt) {
        return next(new Error("Authentication error: Account suspended"));
      }

      socket.user = {
        _id: userId,
        userName: user.userName,
        firstName: user.firstName,
        lastName: user.lastName,
        profile: user.profile,
        email: user.email
      };

      next();
    } catch (error) {
      console.error("Socket authentication error:", error);
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.user.userName} (${socket.user._id})`);

    // Check if user is already connected and disconnect old connection
    const existingConnection = connectedUsers.get(socket.user._id.toString());
    if (existingConnection) {
      console.log(`🔄 User ${socket.user.userName} already connected, disconnecting old connection`);
      const oldSocket = io.sockets.sockets.get(existingConnection.socketId);
      if (oldSocket) {
        oldSocket.disconnect(true);
      }
    }

    // Store user connection
    connectedUsers.set(socket.user._id.toString(), {
      socketId: socket.id,
      user: socket.user,
      joinedAt: new Date()
    });

    // Join user to their personal room for notifications
    socket.join(`user_${socket.user._id}`);

    // Set socket instance for notifications
    setSocketIO(io);

    // Handle joining a chat room
    socket.on("join_chat", async (data) => {
      try {
        const { chatId, roomId } = data;

        // Rate limiting - prevent rapid join_chat calls
        const userId = socket.user._id.toString();
        const now = Date.now();
        const lastJoin = joinChatRateLimit.get(userId);

        if (lastJoin && (now - lastJoin) < 1000) { // 1 second rate limit
          console.log(`⚠️ Rate limit: User ${socket.user.userName} trying to join chat too quickly`);
          return;
        }

        joinChatRateLimit.set(userId, now);

        // Verify user is participant in this chat
        const chat = await Chat.findOne({
          _id: chatId,
          participants: socket.user._id
        });

        if (!chat) {
          socket.emit("error", { message: "Access denied to this chat" });
          return;
        }

        // Join the chat room
        socket.join(roomId);
        console.log(`🚪 User ${socket.user.userName} joined chat room: ${roomId} (Chat ID: ${chatId})`);

        // Notify other participants that user joined
        socket.to(roomId).emit("user_joined", {
          user: {
            id: socket.user._id,
            userName: socket.user.userName,
            firstName: socket.user.firstName,
            lastName: socket.user.lastName,
            profile: socket.user.profile
          },
          joinedAt: new Date()
        });

        // Mark messages as seen when user joins
        await Message.markAsSeen(chatId, socket.user._id);

        // Notify that messages were seen
        socket.to(roomId).emit("messages_seen", {
          chatId,
          seenBy: socket.user._id,
          seenAt: new Date()
        });

      } catch (error) {
        console.error("Join chat error:", error);
        socket.emit("error", { message: "Failed to join chat" });
      }
    });

    // Handle sending messages
    socket.on("send_message", async (data) => {
      try {
        const { chatId, roomId, text, messageType = 'text', imageUrl } = data;

        // Validate message content based on type
        if (messageType === 'text') {
          if (!text || !text.trim()) {
            socket.emit("error", { message: "Message text cannot be empty" });
            return;
          }
        } else if (messageType === 'image') {
          // Validate image data
          if (!imageUrl) {
            socket.emit("error", { message: "Image data is required for image messages" });
            return;
          }

          // Validate base64 image format
          if (!imageUrl.startsWith('data:image/')) {
            socket.emit("error", { message: "Invalid image format. Please select a valid image file" });
            return;
          }

          // Check if it's a valid base64 string
          try {
            const base64Data = imageUrl.split(',')[1];
            if (!base64Data || base64Data.length === 0) {
              socket.emit("error", { message: "Invalid image data. Please try uploading the image again" });
              return;
            }

            // Validate base64 format
            const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
            if (!base64Regex.test(base64Data)) {
              socket.emit("error", { message: "Corrupted image data. Please select a different image" });
              return;
            }
          } catch (err) {
            socket.emit("error", { message: "Failed to process image. Please try a different image" });
            return;
          }

          // Check image size (base64 encoded, so roughly 4/3 of original size)
          const imageSizeBytes = (imageUrl.length * 3) / 4;
          const maxSizeBytes = 5 * 1024 * 1024; // 5MB limit

          if (imageSizeBytes > maxSizeBytes) {
            socket.emit("error", { message: "Image is too large. Please select an image smaller than 5MB" });
            return;
          }
        }

        // For image messages, use imageUrl as text content, or allow empty text
        const messageText = messageType === 'image' ? (text || '') : text;

        // Verify user is participant in this chat and populate product
        const chat = await Chat.findOne({
          _id: chatId,
          participants: socket.user._id
        }).populate('product', 'title price product_photos');

        if (!chat) {
          socket.emit("error", { message: "You don't have permission to send messages in this chat" });
          return;
        }

        // Determine receiver
        const receiverId = chat.participants.find(p => p.toString() !== socket.user._id.toString());

        // Prepare message data for database
        const messagePayload = {
          chat: chatId,
          sender: socket.user._id,
          receiver: receiverId,
          text: messageText.trim(),
          messageType
        };

        // For image messages, store image URL directly
        if (messageType === 'image' && imageUrl) {
          // Ensure imageUrl is a string
          if (typeof imageUrl !== 'string') {
            console.error('❌ ImageUrl is not a string:', typeof imageUrl, imageUrl);
            socket.emit("error", { message: "Invalid image data format. Image must be a string." });
            return;
          }

          // Validate imageUrl format
          if (!imageUrl.startsWith('data:image/')) {
            console.error('❌ Invalid image format:', imageUrl.substring(0, 50));
            socket.emit("error", { message: "Invalid image format. Must be a data URL." });
            return;
          }

          // Store image URL directly in the message
          messagePayload.imageUrl = imageUrl;

          console.log('📎 Adding image URL:', {
            urlLength: imageUrl.length,
            urlPreview: imageUrl.substring(0, 50) + '...'
          });
        }

        // Debug: Log the message payload
        console.log('📝 Creating message with payload:', {
          chat: messagePayload.chat,
          sender: messagePayload.sender,
          receiver: messagePayload.receiver,
          text: messagePayload.text,
          messageType: messagePayload.messageType,
          attachments: messagePayload.attachments ? messagePayload.attachments.length : 0
        });

        // Create message
        const message = await Message.create(messagePayload);
        console.log('✅ Message created successfully:', message._id);

        // Update chat's last message
        await chat.updateLastMessage(message._id);

        // Populate message for broadcasting
        const populatedMessage = await Message.findById(message._id)
          .populate('sender', 'userName firstName lastName profile')
          .populate('receiver', 'userName firstName lastName profile');

        const messageData = {
          id: populatedMessage._id,
          text: populatedMessage.text,
          messageType: populatedMessage.messageType,
          attachments: populatedMessage.attachments,
          // Include imageUrl for image messages
          imageUrl: populatedMessage.imageUrl ||
                   (populatedMessage.messageType === 'image' && populatedMessage.attachments?.[0]?.url
                     ? populatedMessage.attachments[0].url
                     : undefined),
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
          createdAt: populatedMessage.createdAt,
          chatId: chatId,
          roomId: roomId
        };

        // Broadcast message to all users in the chat room
        console.log('📤 Broadcasting message to room:', roomId, 'Message ID:', messageData.id);
        io.to(roomId).emit("new_message", messageData);

        // Send notification to receiver if they're online but not in this chat room
        const receiverConnection = connectedUsers.get(receiverId.toString());
        if (receiverConnection) {
          io.to(`user_${receiverId}`).emit("new_message_notification", {
            chatId,
            message: messageData,
            sender: messageData.sender
          });
        }

        // Create notification for new message
        try {
          await NotificationService.notifyNewMessage(
            populatedMessage,
            populatedMessage.sender,
            populatedMessage.receiver,
            chat.product
          );
        } catch (notificationError) {
          console.error('Error sending new message notification:', notificationError);
          // Don't fail the message sending if notification fails
        }

        console.log(`Message sent in room ${roomId} by ${socket.user.userName}`);

      } catch (error) {
        console.error("Send message error:", error);

        // Provide more specific error messages
        let errorMessage = "Failed to send message";

        if (error.name === 'ValidationError') {
          const validationErrors = Object.values(error.errors).map(err => err.message);
          errorMessage = `Message validation failed: ${validationErrors.join(', ')}`;
        } else if (error.name === 'CastError') {
          if (error.path === 'attachments') {
            errorMessage = "Invalid image data format. Please try uploading the image again";
          } else {
            errorMessage = "Invalid data format. Please refresh and try again";
          }
        } else if (error.code === 11000) {
          errorMessage = "Duplicate message detected";
        } else if (error.message.includes('timeout')) {
          errorMessage = "Request timeout. Please try again";
        } else if (error.message.includes('network')) {
          errorMessage = "Network error. Please check your connection";
        } else if (error.message.includes('base64') || error.message.includes('image')) {
          errorMessage = "Invalid image format. Please select a valid image file";
        }

        socket.emit("error", { message: errorMessage });
      }
    });

    // Handle typing indicators
    socket.on("typing_start", (data) => {
      const { roomId, chatId } = data;
      socket.to(roomId).emit("user_typing", {
        chatId,
        user: {
          id: socket.user._id,
          userName: socket.user.userName,
          firstName: socket.user.firstName,
          lastName: socket.user.lastName
        },
        isTyping: true
      });
    });

    socket.on("typing_stop", (data) => {
      const { roomId, chatId } = data;
      socket.to(roomId).emit("user_typing", {
        chatId,
        user: {
          id: socket.user._id,
          userName: socket.user.userName,
          firstName: socket.user.firstName,
          lastName: socket.user.lastName
        },
        isTyping: false
      });
    });

    // Handle marking messages as seen
    socket.on("mark_seen", async (data) => {
      try {
        const { chatId, roomId } = data;

        await Message.markAsSeen(chatId, socket.user._id);

        // Notify other participants
        socket.to(roomId).emit("messages_seen", {
          chatId,
          seenBy: socket.user._id,
          seenAt: new Date()
        });

      } catch (error) {
        console.error("Mark seen error:", error);
        socket.emit("error", { message: "Failed to mark messages as seen" });
      }
    });

    // Handle leaving chat room
    socket.on("leave_chat", (data) => {
      const { roomId } = data;
      socket.leave(roomId);

      // Notify other participants that user left
      socket.to(roomId).emit("user_left", {
        user: {
          id: socket.user._id,
          userName: socket.user.userName,
          firstName: socket.user.firstName,
          lastName: socket.user.lastName
        },
        leftAt: new Date()
      });

      console.log(`User ${socket.user.userName} left chat room: ${roomId}`);
    });

    // Handle offer events
    socket.on("offer_created", async (data) => {
      try {
        const { chatId, roomId, offerId } = data;

        // Verify user is participant in this chat
        const chat = await Chat.findOne({
          _id: chatId,
          participants: socket.user._id
        });

        if (!chat) {
          socket.emit("error", { message: "Access denied to this chat" });
          return;
        }

        // Get the offer details
        const offer = await Offer.findById(offerId)
          .populate('buyer', 'userName firstName lastName profile')
          .populate('seller', 'userName firstName lastName profile')
          .populate('product', 'title price product_photos');

        if (!offer) {
          socket.emit("error", { message: "Offer not found" });
          return;
        }

        // Broadcast offer created event to all users in the chat room
        io.to(roomId).emit("offer_created", {
          offer,
          chatId,
          roomId
        });

        console.log(`Offer created in room ${roomId} by ${socket.user.userName}`);

      } catch (error) {
        console.error("Offer created event error:", error);
        socket.emit("error", { message: "Failed to process offer event" });
      }
    });

    socket.on("offer_updated", async (data) => {
      try {
        const { chatId, roomId, offerId, status } = data;

        // Verify user is participant in this chat
        const chat = await Chat.findOne({
          _id: chatId,
          participants: socket.user._id
        });

        if (!chat) {
          socket.emit("error", { message: "Access denied to this chat" });
          return;
        }

        // Get the updated offer details
        const offer = await Offer.findById(offerId)
          .populate('buyer', 'userName firstName lastName profile')
          .populate('seller', 'userName firstName lastName profile')
          .populate('product', 'title price product_photos');

        if (!offer) {
          socket.emit("error", { message: "Offer not found" });
          return;
        }

        // Broadcast offer updated event to all users in the chat room
        io.to(roomId).emit("offer_updated", {
          offer,
          status,
          chatId,
          roomId
        });

        console.log(`Offer ${status} in room ${roomId} by ${socket.user.userName}`);

      } catch (error) {
        console.error("Offer updated event error:", error);
        socket.emit("error", { message: "Failed to process offer update event" });
      }
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.user.userName} (${socket.user._id})`);

      const userId = socket.user._id.toString();

      // Remove user from connected users
      connectedUsers.delete(userId);

      // Clean up rate limiting
      joinChatRateLimit.delete(userId);

      // Broadcast user offline status
      socket.broadcast.emit("user_offline", {
        userId: socket.user._id,
        userName: socket.user.userName,
        disconnectedAt: new Date()
      });
    });

    // Send online users list to newly connected user
    socket.emit("online_users", Array.from(connectedUsers.values()).map(conn => ({
      id: conn.user._id,
      userName: conn.user.userName,
      firstName: conn.user.firstName,
      lastName: conn.user.lastName,
      profile: conn.user.profile,
      joinedAt: conn.joinedAt
    })));

    // Broadcast user online status
    socket.broadcast.emit("user_online", {
      id: socket.user._id,
      userName: socket.user.userName,
      firstName: socket.user.firstName,
      lastName: socket.user.lastName,
      profile: socket.user.profile,
      joinedAt: new Date()
    });
  });

  return io;
};


module.exports = initSocket;


