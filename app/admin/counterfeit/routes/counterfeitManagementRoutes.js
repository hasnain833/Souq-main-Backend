const express = require('express');
const router = express.Router();
const counterfeitManagementController = require('../controllers/counterfeitManagementController');
const { verifyAdminToken, checkPermission } = require('../../auth/middleware/adminAuthMiddleware');

// All routes require admin authentication
router.use(verifyAdminToken);

// Get all counterfeit flags with pagination and filters
router.get('/', checkPermission('counterfeit', 'view'), counterfeitManagementController.getAllFlags);

// Get counterfeit statistics
router.get('/stats', checkPermission('counterfeit', 'view'), counterfeitManagementController.getCounterfeitStats);

// Get flag by ID
router.get('/:flagId', checkPermission('counterfeit', 'view'), counterfeitManagementController.getFlagById);

// Assign flag for investigation
router.post('/:flagId/assign', checkPermission('counterfeit', 'investigate'), counterfeitManagementController.assignInvestigation);

// Add investigation note
router.post('/:flagId/notes', checkPermission('counterfeit', 'investigate'), counterfeitManagementController.addInvestigationNote);

// Update flag priority
router.put('/:flagId/priority', checkPermission('counterfeit', 'investigate'), counterfeitManagementController.updatePriority);

// Complete investigation with verdict
router.post('/:flagId/complete', checkPermission('counterfeit', 'resolve'), counterfeitManagementController.completeInvestigation);

// Take action on counterfeit flag
router.post('/:flagId/action', checkPermission('counterfeit', 'resolve'), counterfeitManagementController.takeAction);

// Dismiss flag
router.post('/:flagId/dismiss', checkPermission('counterfeit', 'resolve'), counterfeitManagementController.dismissFlag);

module.exports = router;
