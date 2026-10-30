const express = require('express');
const router = express.Router();
const sizeController = require('../controllers/sizeController');
const { verifyAdminToken, checkPermission } = require('../../auth/middleware/adminAuthMiddleware');

// All routes require admin authentication
router.use(verifyAdminToken);

// Get all size charts with pagination
router.get('/', checkPermission('sizes', 'view'), sizeController.getAllSizeCharts);

// Get child categories for dropdown
router.get('/child-categories', checkPermission('sizes', 'view'), sizeController.getChildCategories);

// Get size chart by ID
router.get('/:id', checkPermission('sizes', 'view'), sizeController.getSizeChartById);

// Create size chart
router.post('/', checkPermission('sizes', 'create'), sizeController.createSizeChart);

// Update size chart
router.put('/:id', checkPermission('sizes', 'edit'), sizeController.updateSizeChart);

// Delete size chart
router.delete('/:id', checkPermission('sizes', 'delete'), sizeController.deleteSizeChart);

// Get sizes by child category (public endpoint for frontend)
router.get('/category/:childCategoryId/:slug', sizeController.getSizesByChildCategory);

// Add sizes to a child category (legacy endpoint)
router.post('/:childCategoryId/:slug', checkPermission('sizes', 'create'), sizeController.addSize);

module.exports = router;