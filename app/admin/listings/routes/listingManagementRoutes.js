const express = require('express');
const router = express.Router();
const listingManagementController = require('../controllers/listingManagementController');
const { verifyAdminToken, checkPermission } = require('../../auth/middleware/adminAuthMiddleware');

// All routes require admin authentication
router.use(verifyAdminToken);

// Get all listings with pagination and filters
router.get('/', listingManagementController.getAllListings);

// Get listing statistics
router.get('/stats', listingManagementController.getListingStats);

// Bulk actions on listings
router.post('/bulk-actions', listingManagementController.bulkActions);

// Get listing by ID
router.get('/:listingId', listingManagementController.getListingById);

// Update listing
router.put('/:listingId', listingManagementController.updateListing);

// Update listing status
router.put('/:listingId/status', listingManagementController.updateListingStatus);

// Approve listing
router.post('/:listingId/approve', listingManagementController.approveListing);

// Reject listing
router.post('/:listingId/reject', listingManagementController.rejectListing);

// Suspend listing
router.post('/:listingId/suspend', listingManagementController.suspendListing);

// Delete listing
router.delete('/:listingId', listingManagementController.deleteListing);

module.exports = router;
