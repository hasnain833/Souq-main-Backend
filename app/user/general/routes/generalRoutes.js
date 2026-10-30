const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/generalController');
const contactRoutes = require('./contactRoutes');

// Contact routes - must come before parameterized routes
router.use('/contact', contactRoutes);

// Fixed: Added /category route to match frontend API call
// IMPORTANT: Order matters - specific routes must come before parameterized routes
router.get('/category', categoryController.getAllCategories);
router.get('/size/:childCategoryId', categoryController.getSizesByChildCategory);
router.get('/size/slug/:slug', categoryController.getSizesByChildCategory);
router.get('/:id', categoryController.getCategory); // This must come last
router.get('/', categoryController.getAllCategories); // Keep root for backward compatibility

module.exports = router;