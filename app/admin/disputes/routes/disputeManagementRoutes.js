const express = require('express');
const router = express.Router();
const disputeManagementController = require('../controllers/disputeManagementController');
const { verifyAdminToken, checkPermission } = require('../../auth/middleware/adminAuthMiddleware');

// All routes require admin authentication
router.use(verifyAdminToken);

// Get all disputes with pagination and filters
router.get('/', checkPermission('disputes', 'view'), disputeManagementController.getAllDisputes);

// Get dispute statistics
router.get('/stats', checkPermission('disputes', 'view'), disputeManagementController.getDisputeStats);

// Get dispute by ID
router.get('/:disputeId', checkPermission('disputes', 'view'), disputeManagementController.getDisputeById);

// Assign dispute to admin
router.post('/:disputeId/assign', checkPermission('disputes', 'resolve'), disputeManagementController.assignDispute);

// Add message to dispute
router.post('/:disputeId/messages', checkPermission('disputes', 'resolve'), disputeManagementController.addMessage);

// Update dispute priority
router.put('/:disputeId/priority', checkPermission('disputes', 'resolve'), disputeManagementController.updatePriority);

// Resolve dispute
router.post('/:disputeId/resolve', checkPermission('disputes', 'resolve'), disputeManagementController.resolveDispute);

// Escalate dispute
router.post('/:disputeId/escalate', checkPermission('disputes', 'escalate'), disputeManagementController.escalateDispute);

// Close dispute
router.post('/:disputeId/close', checkPermission('disputes', 'resolve'), disputeManagementController.closeDispute);

module.exports = router;
