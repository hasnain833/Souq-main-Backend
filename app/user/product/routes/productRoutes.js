const express = require('express');
const router = express.Router();
const verifyToken = require('../../../../utils/verifyToken')
const createUploader = require('../../../../utils/upload');
const productController = require('../controllers/productController')
const optionalAuth = require('../../../../utils/optionalAuth')


// === Specific routes first (no parameters) ===
router.get('/favorites', verifyToken, productController.getUserFavoriteProducts);
router.get('/my-products', verifyToken, productController.getMyProducts);
router.get('/filter', productController.filterProducts);
router.get('/all', optionalAuth, productController.getAllProducts);

// === Public Sizes endpoint (for Sell Now form) ===
// Returns sizes for a child category by ID or slug. If none found, returns empty array.
router.get('/sizes/category/:childCategoryId/:slug?', productController.getSizesForChildCategory);

// === Product creation/update ===
router.post('/sell', verifyToken, productController.sellProduct);
router.post('/sell-product', verifyToken, (req, res, next) => {
  const upload = createUploader('products');
  upload.array('product_photos', 5)(req, res, (err) => {
    if (err) return next(err);
    next();
  });
}, productController.sellProductByFormdata);

// === Specific parameterized routes ===
router.put('/:id/status', verifyToken, productController.updateProductStatus);
router.get('/:id/items', productController.getUserWithProducts);
router.get('/:productId/count', productController.getProductWithFavorites);
router.post('/:productId/favorite', verifyToken, productController.toggleFavorite);
router.post('/:productId/hide-toggle', verifyToken, productController.toggleProductVisibility);
router.post('/:productId/bump', verifyToken, productController.bumpProduct);
router.post('/:productId/mark-sold', verifyToken, productController.markAsSold);
router.post('/:productId/mark-reserved', verifyToken, productController.markAsReserved);
router.post('/:productId/reactivate', verifyToken, productController.reactivateProduct);

// === General parameterized routes (must be last) ===
router.put('/:id', verifyToken, (req, res, next) => {
  const upload = createUploader('products');
  upload.array('product_photos', 5)(req, res, (err) => {
    if (err) return next(err);
    next();
  });
}, productController.updateProduct);
router.delete('/:id', verifyToken, productController.deleteProduct);
router.get('/:id', optionalAuth, productController.getProduct); 

module.exports = router;
