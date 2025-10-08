const express = require('express');
const router = express.Router();
const ratingManagementController = require('../controllers/ratingManagementController');
const { verifyAdminToken, checkPermission } = require('../../auth/middleware/adminAuthMiddleware');

// All routes require admin authentication
router.use(verifyAdminToken);
router.get('/', checkPermission('ratings', 'view'), ratingManagementController.getAllRatings);
router.get('/stats', checkPermission('ratings', 'view'), ratingManagementController.getRatingStats);
router.get('/:ratingId', checkPermission('ratings', 'view'), ratingManagementController.getRatingById);
router.put('/:ratingId/status', checkPermission('ratings', 'update'), ratingManagementController.updateRatingStatus);
router.delete('/:ratingId', checkPermission('ratings', 'delete'), ratingManagementController.deleteRating);

module.exports = router;
