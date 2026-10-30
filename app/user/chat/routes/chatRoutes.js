const express = require('express');
const router = express.Router();
const verifyToken = require('../../../../utils/verifyToken');
const chatController = require('../controllers/chatController');

// All chat routes require authentication
router.use(verifyToken);
router.post('/product/:productId', chatController.createOrGetChat);

router.get('/', chatController.getUserChats);

router.get('/:chatId/messages', chatController.getChatMessages);

router.post('/:chatId/messages', chatController.sendMessage);

router.patch('/:chatId/seen', chatController.markMessagesAsSeen);

router.delete('/:chatId', chatController.deleteChat);

router.post('/block/:userId', chatController.blockUser);

router.delete('/block/:userId', chatController.unblockUser);

router.post('/report/:userId', chatController.reportUser);

router.get('/blocked', chatController.getBlockedUsers);
// router.delete('/messages/:messageId', chatController.deleteMessage); // Commented out - function not implemented

module.exports = router;
