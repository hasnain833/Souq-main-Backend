const compression = require('compression');
const helmet = require('helmet');

/**
 * Performance optimization middleware
 */

// Compression middleware for response optimization
const compressionMiddleware = compression({
  level: 6, // Compression level (1-9)
  threshold: 1024, // Only compress responses larger than 1KB
  filter: (req, res) => {
    // Don't compress if client doesn't support it
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Use compression for JSON responses
    return compression.filter(req, res);
  }
});

// Security headers middleware
const securityMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
});

// Request size limiting
const requestSizeLimit = (maxSize = '10mb') => {
  return (req, res, next) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    const maxBytes = parseSize(maxSize);
    
    if (contentLength > maxBytes) {
      return res.status(413).json({
        success: false,
        message: 'Request entity too large',
        maxSize: maxSize
      });
    }
    
    next();
  };
};

// Parse size string to bytes
function parseSize(size) {
  const units = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024
  };
  
  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
  if (!match) return 0;
  
  const value = parseFloat(match[1]);
  const unit = match[2] || 'b';
  
  return Math.floor(value * units[unit]);
}

// Response time middleware
const responseTimeMiddleware = (req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    res.set('X-Response-Time', `${duration}ms`);
    
    // Log slow requests
    if (duration > 2000) {
      console.warn(`🐌 Slow request: ${req.method} ${req.path} - ${duration}ms`);
    } else if (duration > 1000) {
      console.log(`⏱️ Moderate request: ${req.method} ${req.path} - ${duration}ms`);
    }
  });
  
  next();
};

// Cache control middleware
const cacheControlMiddleware = (maxAge = 60) => {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method === 'GET') {
      // Set cache headers for public endpoints
      if (req.path.includes('/products') || req.path.includes('/categories')) {
        res.set('Cache-Control', `public, max-age=${maxAge}`);
      }
    }
    next();
  };
};

// Database connection monitoring
const dbHealthMiddleware = (req, res, next) => {
  const mongoose = require('mongoose');
  
  if (mongoose.connection.readyState !== 1) {
    console.warn('⚠️ Database connection not ready:', mongoose.connection.readyState);
  }
  
  next();
};

// Memory usage monitoring
const memoryMonitoringMiddleware = (req, res, next) => {
  const memoryUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
  
  // Warn if memory usage is high
  if (heapUsedMB > 500) {
    console.warn(`⚠️ High memory usage: ${heapUsedMB}MB`);
  }
  
  // Add memory info to response headers in development
  if (process.env.NODE_ENV === 'development') {
    res.set('X-Memory-Usage', `${heapUsedMB}MB`);
  }
  
  next();
};

// Rate limiting middleware (simple in-memory rate limiting)
const rateLimitMap = new Map();

const rateLimitMiddleware = (windowMs = 60000, maxRequests = 100) => {
  return (req, res, next) => {
    const clientId = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean old entries
    if (rateLimitMap.has(clientId)) {
      const requests = rateLimitMap.get(clientId).filter(time => time > windowStart);
      rateLimitMap.set(clientId, requests);
      
      if (requests.length >= maxRequests) {
        return res.status(429).json({
          success: false,
          message: 'Too many requests',
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }
    } else {
      rateLimitMap.set(clientId, []);
    }
    
    // Add current request
    rateLimitMap.get(clientId).push(now);
    
    next();
  };
};

// Combine all performance middlewares
const performanceMiddlewares = {
  compression: compressionMiddleware,
  security: securityMiddleware,
  requestSizeLimit,
  responseTime: responseTimeMiddleware,
  cacheControl: cacheControlMiddleware,
  dbHealth: dbHealthMiddleware,
  memoryMonitoring: memoryMonitoringMiddleware,
  rateLimit: rateLimitMiddleware
};

module.exports = performanceMiddlewares;
