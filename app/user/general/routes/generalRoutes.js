const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/generalController');

router.get('/', categoryController.getAllCategories);
router.get('/:id', categoryController.getCategory);

router.get('/size/:childCategoryId', categoryController.getSizesByChildCategory);
router.get('/size/slug/:slug', categoryController.getSizesByChildCategory);

module.exports = router;