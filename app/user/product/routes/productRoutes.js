const express = require('express');
const router = express.Router();
const verifyToken = require('../../../../utils/verifyToken')
const uploadS3 = require('../../../../middlewares/s3Uploader');
const productController = require('../controllers/productController')
const optionalAuth = require('../../../../utils/optionalAuth')

// Routes
router.get('/favorites', verifyToken, productController.getUserFavoriteProducts);
router.get('/my-products', verifyToken, productController.getMyProducts);
router.get('/filter', productController.filterProducts);
router.get('/all', productController.getAllProducts);
router.get('/seller/:sellerId', productController.getSellerProducts);
router.get('/sizes/category/:childCategoryId/:slug?', productController.getSizesForChildCategory);
router.post('/sell', verifyToken, productController.sellProduct);
router.post('/sell-product', 
  verifyToken, 
  uploadS3.array('product_photos', 10),
  uploadS3.errorHandler,
  productController.createProduct
);
router.put('/:id/status', verifyToken, productController.updateProductStatus);
router.patch('/:id/update-quantity', verifyToken, productController.updateProductQuantity);
router.get('/:id/items', productController.getUserWithProducts);
router.get('/:productId/count', productController.getProductWithFavorites);
router.post('/:productId/favorite', verifyToken, productController.toggleFavorite);
router.post('/:productId/hide-toggle', verifyToken, productController.toggleProductVisibility);
router.post('/:productId/bump', verifyToken, productController.bumpProduct);
router.post('/:productId/mark-sold', verifyToken, productController.markAsSold);
router.post('/:productId/mark-reserved', verifyToken, productController.markAsReserved);
router.post('/:productId/reactivate', verifyToken, productController.reactivateProduct);
// Handle product updates with file uploads
router.put('/:id', 
  verifyToken, 
  uploadS3.array('product_photos', 10),
  uploadS3.errorHandler,
  productController.updateProduct
);
router.delete('/:id', verifyToken, productController.deleteProduct);
router.get('/:id', optionalAuth, productController.getProduct); 

// Stream product image by index from MongoDB (with legacy fallback)
router.get('/image/:productId/:index', productController.streamProductImage);

module.exports = router;
