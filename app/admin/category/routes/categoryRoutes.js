const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { verifyAdminToken, checkPermission } = require('../../auth/middleware/adminAuthMiddleware');

// router.get('/search', categoryController.searchCategories);
// router.get('/',categoryController.getAllCategories);

// /* --add Main Category----*/
// router.post('/',categoryController.createCategory);
// router.get('/:id',categoryController.getCategory);
// router.put('/:id',categoryController.updateCategory);
// router.delete('/:id',categoryController.deleteCategory);

// /* --add Sub Category----*/
// router.post('/subcategory/:categoryId',categoryController.CreateSubCategory);
// router.put('/subcategory/:categoryId/:subCategorySlug',categoryController.updateSubCategory);
// router.delete('/subcategory/:categoryId/:subCategorySlug', categoryController.deleteSubCategory);

// /* --add Child Sub Category----*/
// router.post('/childSubcategory/:categoryId/:subCategorySlug', categoryController.addChildSubCategory);
// router.put('/childSubcategory/:categoryId/:subCategorySlug/:childSlug', categoryController.updateChildSubCategory);
// router.delete('/childSubcategory/:categoryId/:subCategorySlug/:childSlug', categoryController.deleteChildSubCategory);



// Apply authentication middleware to all routes
router.use(verifyAdminToken);

// Fix missing slugs route - should be called once to fix existing data
router.post('/fix-slugs', categoryController.fixMissingSlugs);

// Main Category - Temporarily allow all authenticated admins
router.post('/', categoryController.createMainCategory);
router.get('/', categoryController.getAllCategories);
router.get('/:id', categoryController.getCategory);
router.put('/:id', categoryController.updateMainCategory);
router.delete('/:id', categoryController.deleteMainCategory);

// Sub-category - Temporarily allow all authenticated admins
router.post('/:categoryId/subcategory', categoryController.addSubCategory);
router.put('/subcategory/:subCategoryId', categoryController.updateSubCategory);
router.delete('/subcategory/:subCategoryId', categoryController.deleteSubCategory);

// Child-category - Temporarily allow all authenticated admins
router.post('/subcategory/:subCategoryId/childcategory', categoryController.addChildCategory);
router.put('/childcategory/:childCategoryId', categoryController.updateChildCategory);
router.delete('/childcategory/:childCategoryId', categoryController.deleteChildCategory);

// Items - Temporarily allow all authenticated admins
router.post('/childcategory/:childCategoryId/item', categoryController.addItem);
router.put('/item/:itemId', categoryController.updateItem);
router.delete('/item/:itemId', categoryController.deleteItem);

module.exports = router;


