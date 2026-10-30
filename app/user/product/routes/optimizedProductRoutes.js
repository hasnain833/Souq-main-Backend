const express = require('express');
const router = express.Router();
const optimizedProductController = require('../controllers/optimizedProductController');
const verifyToken = require('../../../../utils/verifyToken');
const optionalAuth = require('../../../../utils/optionalAuth');

// Performance monitoring middleware
const performanceMiddleware = (req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    if (duration > 1000) { // Log slow requests
      console.warn(`🐌 Slow request: ${req.method} ${req.path} - ${duration}ms`);
    }
  });
  
  next();
};

// Apply performance middleware to all routes
router.use(performanceMiddleware);

// Optimized public endpoints (no authentication required)
router.get('/optimized', optionalAuth, optimizedProductController.getAllProductsOptimized);
router.get('/optimized/:id', optionalAuth, optimizedProductController.getProductOptimized);
router.get('/optimized/categories/all', optimizedProductController.getAllCategoriesOptimized);

// Performance monitoring endpoint
router.get('/performance/health', optimizedProductController.getPerformanceHealth);

// Legacy endpoints with optional auth for backward compatibility
router.get('/', optionalAuth, optimizedProductController.getAllProductsOptimized);
router.get('/categories', optimizedProductController.getAllCategoriesOptimized);

module.exports = router;
