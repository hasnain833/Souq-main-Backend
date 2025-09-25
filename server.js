require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const passport = require('passport');
require('./utils/passport');
const connectDB = require('./db');
const paymentGatewayFactory = require('./services/payment/PaymentGatewayFactory');

// Create main app
const app = express();
const PORT = process.env.PORT || 5000;

// Connect to database
connectDB();

// Middleware
// CORS configuration
// - In production: allow only FRONTEND_ORIGIN (e.g., https://app.souq.com)
// - In development: explicitly allow common localhost Vite ports regardless of FRONTEND_ORIGIN
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || process.env.FRONTEND_URL;
const isProduction = process.env.NODE_ENV === 'production';

const devAllowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (e.g., curl, mobile apps)
    if (!origin) return callback(null, true);

    if (isProduction) {
      if (!FRONTEND_ORIGIN) {
        return callback(new Error('CORS blocked: FRONTEND_ORIGIN not configured'));
      }
      return callback(null, origin === FRONTEND_ORIGIN);
    }

    // Development: allow localhost Vite dev servers and FRONTEND_ORIGIN if provided
    if (devAllowedOrigins.includes(origin)) return callback(null, true);
    if (FRONTEND_ORIGIN && origin === FRONTEND_ORIGIN) return callback(null, true);

    // Fallback: allow any localhost origin in dev
    if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return callback(null, true);

    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie'],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
// app.use(passport.initialize());

// Serve static files (images, uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// User API routes
const userRoutes = require('./app/user');
app.use('/api/user', userRoutes);

// Admin API routes
const adminRoutes = require('./app/admin');
app.use('/api/admin', adminRoutes);

// Webhook routes (no authentication required)
const webhookRoutes = require('./app/webhooks');
app.use('/webhooks', webhookRoutes);
const escrowPaymentRoutes = require('./app/user/payments/routes/escrowPaymentRoutes')
app.use(express.json())
app.use('/api/user/escrow', escrowPaymentRoutes);


// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    services: {
      user: 'running',
      admin: 'running'
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'SOUQ Marketplace API',
    version: '1.0.0',
    endpoints: {
      user: '/api/user',
      admin: '/api/admin',
      health: '/health'
    },
    documentation: 'See API_DOCUMENTATION.md'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler (no path pattern to avoid path-to-regexp issues)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});


// Start server
app.listen(PORT, () => {
  console.log(`🚀 SOUQ Marketplace API running on http://localhost:${PORT}`);
  console.log(`📊 User API: http://localhost:${PORT}/api/user`);
  console.log(`⚙️ Admin API: http://localhost:${PORT}/api/admin`);
  console.log(`❤️ Health Check: http://localhost:${PORT}/health`);
  console.log('');
  console.log('📋 Admin API Endpoints:');
  console.log(`   📦 Orders: http://localhost:${PORT}/api/admin/orders`);
  console.log(`   📊 Order Stats: http://localhost:${PORT}/api/admin/orders/stats`);
  console.log(`   🛡️ Escrow Orders: http://localhost:${PORT}/api/admin/orders/method/escrow`);
  console.log(`   💳 Standard Orders: http://localhost:${PORT}/api/admin/orders/method/standard`);
  console.log(`   ⭐ Ratings: http://localhost:${PORT}/api/admin/ratings`);
  console.log(`   📊 Rating Stats: http://localhost:${PORT}/api/admin/ratings/stats`);
  console.log(`   🚨 Reports: http://localhost:${PORT}/api/admin/reports`);
  console.log(`   📊 Report Stats: http://localhost:${PORT}/api/admin/reports/stats`);
  console.log('');
  console.log('💡 Note: All admin endpoints require authentication');

  // Initialize payment gateways after server starts (ensures DB connection is ready)
  (async () => {
    try {
      await paymentGatewayFactory.initialize();
      console.log('✅ Payment gateways initialized (server.js)');
    } catch (err) {
      console.error('❌ Failed to initialize payment gateways:', err?.message || err);
    }
  })();
});

module.exports = app;
