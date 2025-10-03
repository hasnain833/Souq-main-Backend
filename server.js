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

// Trust proxy so Secure cookies work on Vercel/HTTPS
app.set('trust proxy', 1);

// Connect to database (skip in Vercel serverless; api/index.js handles it per-invocation)
if (!process.env.VERCEL) {
  connectDB();
}

// CORS setup
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || process.env.FRONTEND_URL || 'https://souq-frontend.vercel.app'; // fallback to production frontend
const isProduction = process.env.NODE_ENV === 'production';
const devAllowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (e.g., curl, server-to-server)
    if (!origin) return callback(null, true);

    if (isProduction) {
      if (!FRONTEND_ORIGIN) {
        return callback(new Error('CORS blocked: FRONTEND_ORIGIN not configured'));
      }
      return callback(null, origin === FRONTEND_ORIGIN);
    }

    // Development: allow localhost and optional configured frontend
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

// Global OPTIONS preflight handler (must be before routes)
app.use((req, res, next) => {
  if (req.method !== 'OPTIONS') return next();
  cors(corsOptions)(req, res, () => {
    res.sendStatus(204);
  });
});
app.use(express.json());
app.use(passport.initialize());

// Minimal backend: only expose core flows (auth, product, orders)
// All other routes are disabled temporarily for Vercel testing

// Serve static files (images, uploads) — disabled temporarily
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// User API routes (minimal): expose only auth, product, and orders
const userAuthRoutes = require('./app/user/auth/routes/userAuthRoutes');
const productRoutes = require('./app/user/product/routes/productRoutes');
const orderRoutes = require('./app/user/shipping/routes/orderRoutes');
const standardPaymentRoutes = require('./app/user/payments/routes/standardPaymentRoutes'); // re-enabled for E2E payments testing

// Auth (login/signup)
app.use('/api/user/auth', userAuthRoutes);

// Product system
app.use('/api/user/product', productRoutes); // note: existing codebase uses singular 'product'
app.use('/api/user/products', productRoutes); // alias path for plural form

// Ordering system
app.use('/api/user/orders', orderRoutes);

// Payments (Standard, includes PayPal)
app.use('/api/user/payments', standardPaymentRoutes);

// Admin API routes — disabled temporarily
// const adminRoutes = require('./app/admin');
// app.use('/api/admin', adminRoutes);

// Webhook routes — disabled temporarily
// const webhookRoutes = require('./app/webhooks');
// app.use('/webhooks', webhookRoutes);

// Payments / Escrow — enable full escrow API (routes include create, initialize, webhooks)
const escrowRoutes = require('./app/user/escrow/routes/escrowRoutes');
app.use('/api/user/escrow', escrowRoutes);


// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    services: {
      user: 'running'
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


// Start server only when running locally (not on Vercel)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 SOUQ Marketplace API running on http://localhost:${PORT}`);
    console.log(`📊 User Auth: http://localhost:${PORT}/api/user/auth`);
    console.log(`🛍️ Product: http://localhost:${PORT}/api/user/product`);
    console.log(`🧾 Orders: http://localhost:${PORT}/api/user/orders`);
    console.log(`❤️ Health Check: http://localhost:${PORT}/health`);
    console.log('');
    console.log('🔧 Minimal backend mode: only auth, product, and orders are enabled');

    // Initialize payment gateways
    (async () => {
      try {
        await paymentGatewayFactory.initialize();
        console.log('✅ Payment gateways initialized (server.js)');
      } catch (err) {
        console.error('❌ Failed to initialize payment gateways:', err?.message || err);
      }
    })();
  });
}

module.exports = app;
