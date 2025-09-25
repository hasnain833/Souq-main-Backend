const express = require('express');
const router = express.Router();
const verifyToken = require('../../../../utils/verifyToken');
const chatController = require('../controllers/chatController');

// All chat routes require authentication
router.use(verifyToken);

// Create or get chat for a product
router.post('/product/:productId', chatController.createOrGetChat);

// Get all chats for the authenticated user
router.get('/', chatController.getUserChats);

// Get messages for a specific chat
router.get('/:chatId/messages', chatController.getChatMessages);

// Send a message (HTTP fallback)
router.post('/:chatId/messages', chatController.sendMessage);

// Mark messages as seen
router.patch('/:chatId/seen', chatController.markMessagesAsSeen);

// Delete chat
router.delete('/:chatId', chatController.deleteChat);

// Block user
router.post('/block/:userId', chatController.blockUser);

// Unblock user
router.delete('/block/:userId', chatController.unblockUser);

// Report user
router.post('/report/:userId', chatController.reportUser);

// Get blocked users
router.get('/blocked', chatController.getBlockedUsers);

// Delete a message
// router.delete('/messages/:messageId', chatController.deleteMessage); // Commented out - function not implemented

module.exports = router;
