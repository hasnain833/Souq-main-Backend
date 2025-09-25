const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactManagementController');
const { verifyAdminToken } = require('../../../admin/auth/middleware/adminAuthMiddleware');

// Apply authentication middleware to all routes
router.use(verifyAdminToken);

// GET /api/admin/contacts - Get all contact messages
router.get('/', contactController.getAllContacts);

// GET /api/admin/contacts/:id - Get a specific contact message
router.get('/:id', contactController.getContactById);

// DELETE /api/admin/contacts/:id - Delete a contact message
router.delete('/:id', contactController.deleteContact);

module.exports = router;