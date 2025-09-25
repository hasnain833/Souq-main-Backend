const express = require('express');
const router = express.Router();
const reportManagementController = require('../controllers/reportManagementController');
const { verifyAdminToken, checkPermission } = require('../../auth/middleware/adminAuthMiddleware');

// All routes require admin authentication
router.use(verifyAdminToken);

// Get all reports with pagination and filters
router.get('/', checkPermission('reports', 'view'), reportManagementController.getAllReports);

// Get report statistics
router.get('/stats', checkPermission('reports', 'view'), reportManagementController.getReportStats);

// Get report by ID
router.get('/:reportId', checkPermission('reports', 'view'), reportManagementController.getReportById);

// Update report status
router.put('/:reportId/status', checkPermission('reports', 'update'), reportManagementController.updateReportStatus);

// Delete report
router.delete('/:reportId', checkPermission('reports', 'delete'), reportManagementController.deleteReport);

module.exports = router;
