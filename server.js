require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const path = require("path");
const passport = require("passport");
require("./utils/passport");
const connectDB = require("./db");
const stripeController = require("./app/user/stripe/controllers/stripeController");
const adminRoutes = require("./app/admin");
const isProduction=process.env.NODE_ENV
console.log(isProduction)

// Create main app
const app = express();
const PORT = process.env.PORT || 5000;

app.set("trust proxy", 1);

if (!process.env.VERCEL) {
  connectDB();
}

// const allowedOrigins = ["https://habibimarket.net"];

// const corsOptions = {
//   origin: allowedOrigins,
//   credentials: true,
//   methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
//   allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
//   exposedHeaders: ["Set-Cookie"],
//   optionsSuccessStatus: 204,
// };
const allowedOrigins = isProduction
  ? [
      "https://habibimarket.net",
      "https://staging.d2ejvdp70ucx64.amplifyapp.com" // ADD THIS
    ]
  : [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5173",
      "http://192.168.1.79:5173",
      "https://habibimarket.net",
      "https://staging.d2ejvdp70ucx64.amplifyapp.com",
    ];


const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  exposedHeaders: ["Set-Cookie"],
  optionsSuccessStatus: 204,
};

// Apply CORS globally BEFORE routes
app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // handles preflight

app.use((req, res, next) => {
  if (req.originalUrl === "/api/user/payment/webhook") {
    next(); // Skip express.json()
  } else {
    express.json()(req, res, next);
  }
});

// 👇 Use raw body ONLY for Stripe webhook
app.post(
  "/api/user/payment/webhook",
  express.raw({ type: "application/json" }),
  stripeController.webhooks
);

// app.use(express.json());
app.use(passport.initialize());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// User API routes
const userAuthRoutes = require("./app/user/auth/routes/userAuthRoutes");
const userSocialAuthRoutes = require("./app/user/auth/routes/userSocialAuthRoutes");
const productRoutes = require("./app/user/product/routes/productRoutes");
const optimizedProductRoutes = require("./app/user/product/routes/optimizedProductRoutes");
const orderRoutes = require("./app/user/shipping/routes/orderRoutes");
const shippingRoutes = require("./app/user/shipping/routes/shippingRoutes");
const trackingRoutes = require("./app/user/shipping/routes/trackingRoutes");
const profileRoutes = require("./app/user/profile/routes/profileRoutes");
const walletRoutes = require("./app/user/wallet/routes/walletRoutes");
const notificationRoutes = require("./app/user/notifications/routes/notificationRoutes");
const generalRoutes = require("./app/user/general/routes/generalRoutes");
const chatRoutes = require("./app/user/chat/routes/chatRoutes");
const offerRoutes = require("./app/user/offer/routes/offerRoutes");
const stripeRoutes = require("./app/user/stripe/routes/stripeRoutes");

const escrowRoutes = require("./app/user/escrowPayments/routes/escrow");
const productSuggestionRoutes = require("./app/user/suggestion/routes/suggestionRoutes");
const personalizationRoutes = require("./app/user/personalization/personalizationRoutes/personalizationRoutes");
const ratingRoutes = require("./app/user/rating/routes/ratingRoutes");
const sessionRoutes = require("./app/user/session/routes/sessionRoutes");
const addressRoutes = require("./app/user/addresses/routes/addressRoutes");
const locationRoutes = require("./app/user/location/routes/locationRoutes");

// Auth (login/signup)
app.use("/api/user/auth", userAuthRoutes);
app.use("/api/user/auth", userSocialAuthRoutes);
app.use("/api/user/product", productRoutes); // note: existing codebase uses singular 'product'
app.use("/api/user/products", productRoutes); // alias path for plural form
app.use("/api/user/products", optimizedProductRoutes); // optimized endpoints under /products/optimized
app.use("/api/user/orders", orderRoutes);
// Shipping + tracking (COD canonical shipping path)
app.use("/api/user/shipping", shippingRoutes);
app.use("/api/user/shipping", trackingRoutes);
app.use("/api/user/profile", profileRoutes);
app.use("/api/user/wallet", walletRoutes);
app.use("/api/user/notifications", notificationRoutes);
app.use("/api/user/general", generalRoutes);
app.use("/api/user/chat", chatRoutes);
app.use("/api/user/offer", offerRoutes);
app.use("/api/user/payment", stripeRoutes);
app.use("/api/user/escrow", escrowRoutes);
app.use("/api/user/suggestions", productSuggestionRoutes);
app.use("/api/user/personalization", personalizationRoutes);
app.use("/api/user/ratings", ratingRoutes);
app.use("/api/user/sessions", sessionRoutes);
app.use("/api/user/addresses", addressRoutes);
app.use("/api/user/location", locationRoutes);
// app.use('/webhooks', webhookRoutes);

// Mount admin API under the same server/port
app.use("/api/admin", adminRoutes);

// Escrow removed in COD-only mode

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
    message: "Habibi ماركت Marketplace API",
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
  const fs = require('fs');
  let server;
  const SSL_CERT_PATH = process.env.SSL_CERT_PATH;
  const SSL_KEY_PATH = process.env.SSL_KEY_PATH;

  // Use HTTPS if SSL certificates are available
  if (SSL_CERT_PATH && SSL_KEY_PATH && fs.existsSync(SSL_CERT_PATH) && fs.existsSync(SSL_KEY_PATH)) {
    const https = require('https');
    const options = {
      cert: fs.readFileSync(SSL_CERT_PATH),
      key: fs.readFileSync(SSL_KEY_PATH)
    };
    server = https.createServer(options, app);
    console.log("🔐 HTTPS Server initialized with SSL certificates");
  } else {
    server = http.createServer(app);
    console.warn("⚠️ HTTP Server initialized (SSL certificates not found)");
  }

  // Initialize Socket.IO on the same server (with delay to ensure DB is ready)
  setTimeout(() => {
    try {
      const { initSocket } = require("./utils/socket");
      initSocket(server);
      console.log("🔌 Socket.IO initialized");
    } catch (e) {
      console.warn(
        "⚠️ Socket initialization failed or unavailable:",
        e?.message || e
      );
    }
  }, 2000); // 2 second delay to ensure database is connected

  server.listen(PORT, () => {
    const protocol = server instanceof require('https').Server ? 'https' : 'http';
    console.log(`🚀 Habibi ماركت Marketplace API running on ${protocol}://localhost:${PORT}`);
    console.log(`📊 User Auth: ${protocol}://localhost:${PORT}/api/user/auth`);
    console.log(`🛍️ Product: ${protocol}://localhost:${PORT}/api/user/product`);
    console.log(`💬 Chat: ${protocol}://localhost:${PORT}/api/user/chat`);
    console.log(`🧾 Orders: ${protocol}://localhost:${PORT}/api/user/orders`);
    console.log(`💰 Wallet: ${protocol}://localhost:${PORT}/api/user/wallet`);
    console.log(`❤️ Health Check: ${protocol}://localhost:${PORT}/health`);
    console.log("");
    // console.log(
    //   "🔧 Backend mode: auth, product, chat, orders, and wallet are enabled"
    // );
  });
}

module.exports = app;