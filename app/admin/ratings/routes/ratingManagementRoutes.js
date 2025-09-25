const express = require('express');
const router = express.Router();
const ratingManagementController = require('../controllers/ratingManagementController');
const { verifyAdminToken, checkPermission } = require('../../auth/middleware/adminAuthMiddleware');

// All routes require admin authentication
router.use(verifyAdminToken);

// Get all ratings with pagination and filters
router.get('/', checkPermission('ratings', 'view'), ratingManagementController.getAllRatings);

// Get rating statistics
router.get('/stats', checkPermission('ratings', 'view'), ratingManagementController.getRatingStats);

// Get rating by ID
router.get('/:ratingId', checkPermission('ratings', 'view'), ratingManagementController.getRatingById);

// Update rating status (moderate rating)
router.put('/:ratingId/status', checkPermission('ratings', 'update'), ratingManagementController.updateRatingStatus);

// Delete rating
router.delete('/:ratingId', checkPermission('ratings', 'delete'), ratingManagementController.deleteRating);

module.exports = router;
