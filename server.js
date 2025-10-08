require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const passport = require("passport");
require("./utils/passport");
const connectDB = require("./db");
const paymentGatewayFactory = require("./services/payment/PaymentGatewayFactory");

// Create main app
const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy so Secure cookies work on Vercel/HTTPS
app.set("trust proxy", 1);

// Connect to database (skip in Vercel serverless; api/index.js handles it per-invocation)
if (!process.env.VERCEL) {
  connectDB();
}

// CORS setup
const FRONTEND_ORIGIN =
  process.env.FRONTEND_ORIGIN ||
  process.env.FRONTEND_URL ||
  "https://souq-frontend.vercel.app"; // fallback to production frontend
const isProduction = process.env.NODE_ENV === "production";
const devAllowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://souq-frontend.vercel.app",
];
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (e.g., curl, server-to-server)
    if (!origin) return callback(null, true);

    const allowedOrigins = isProduction ? [FRONTEND_ORIGIN].filter(Boolean) : devAllowedOrigins;

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Allow any localhost port in development
    if (!isProduction && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
      return callback(null, true);
    }

    console.warn(`❌ CORS blocked for origin: ${origin}`);
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  exposedHeaders: ["Set-Cookie"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
// Universal preflight handling to ensure OPTIONS never hang
app.options("*", cors(corsOptions));

// Global OPTIONS preflight handler (must be before routes)
app.use((req, res, next) => {
  if (req.method !== "OPTIONS") return next();
  cors(corsOptions)(req, res, () => {
    res.sendStatus(204);
  });
});
app.use(express.json());
app.use(passport.initialize());

// Other routes remain disabled

// Serve static files (images, uploads)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// User API routes
const userAuthRoutes = require("./app/user/auth/routes/userAuthRoutes");
const productRoutes = require("./app/user/product/routes/productRoutes");
const orderRoutes = require("./app/user/shipping/routes/orderRoutes");
const standardPaymentRoutes = require("./app/user/payments/routes/standardPaymentRoutes"); // re-enabled for E2E payments testing
const profileRoutes = require("./app/user/profile/routes/profileRoutes");
const notificationRoutes = require("./app/user/notifications/routes/notificationRoutes");
const generalRoutes = require("./app/user/general/routes/generalRoutes");
const walletRoutes = require("./app/user/wallet/routes/walletRoutes");
// Add missing Chat & Offer APIs so frontend endpoints are available
const chatRoutes = require("./app/user/chat/routes/chatRoutes");
const offerRoutes = require("./app/user/offer/routes/offerRoutes");

// Auth (login/signup)
app.use("/api/user/auth", userAuthRoutes);

// Product system
app.use("/api/user/product", productRoutes); // note: existing codebase uses singular 'product'
app.use("/api/user/products", productRoutes); // alias path for plural form

// ordering system
app.use("/api/user/orders", orderRoutes);

// Payments (Standard, includes PayPal)
app.use("/api/user/payments", standardPaymentRoutes);

app.use("/api/user/profile", profileRoutes);

// Wallet
app.use("/api/user/wallet", walletRoutes);

// Notifications (unread-count and others)
app.use("/api/user/notifications", notificationRoutes);

// General (categories, sizes)
app.use("/api/user/general", generalRoutes);
 
// Chat (create/get chat, messages, seen, block/report)
app.use("/api/user/chat", chatRoutes);

// Offer (create/accept/decline/get)
app.use("/api/user/offer", offerRoutes);
// app.use('/webhooks', webhookRoutes);

// ESCROW_DISABLED: Escrow API temporarily disabled. Keeping code for future use.
// const escrowRoutes = require('./app/user/escrow/routes/escrowRoutes');
// app.use('/api/user/escrow', escrowRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    services: {
      user: "running",
    },
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "SOUQ Marketplace API",
    version: "1.0.0",
    endpoints: {
      user: "/api/user",
      admin: "/api/admin",
      health: "/health",
    },
    documentation: "See API_DOCUMENTATION.md",
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Something went wrong",
  });
});

// 404 handler (no path pattern to avoid path-to-regexp issues)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found",
    path: req.originalUrl,
    method: req.method,
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
    console.log("");
    console.log(
      "🔧 Minimal backend mode: only auth, product, and orders are enabled"
    );

    // Initialize payment gateways
    (async () => {
      try {
        await paymentGatewayFactory.initialize();
        console.log("✅ Payment gateways initialized (server.js)");
      } catch (err) {
        console.error(
          "❌ Failed to initialize payment gateways:",
          err?.message || err
        );
      }
    })();
  });
}

module.exports = app;
