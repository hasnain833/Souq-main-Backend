require('dotenv').config();
const express = require('express');
const cors = require('cors');
const passport = require('passport');
require('./utils/passport');
const connectDB = require('./db');
const path = require('path');
const initSocket = require('./utils/socket');
const http = require('http');
const { startScheduler, setSocketIO: setSchedulerSocketIO } = require('./utils/scheduler');
const paymentGatewayFactory = require('./services/payment/PaymentGatewayFactory');
// ESCROW_DISABLED: Escrow scheduler disabled for now.
// const escrowScheduler = require('./services/scheduler/EscrowScheduler');
const currencyService = require('./services/currency/CurrencyService');
const shippingFactory = require('./services/shipping/ShippingServiceFactory');

const app = express();
const PORT = process.env.USER_PORT;

// Connect to the database
connectDB();

// CORS configuration

const allowedOrigins = [
  "https://souq-fashion-staging-web.netlify.app",
  'https://souq-fashion-staging.netlify.app',
  'http://localhost:5173',
  'http://192.168.1.79:5173',
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// Middleware
app.use(express.json());
app.use(passport.initialize())
// app.use('/uploads', express.static(path.join(__dirname, 'utils/upload')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint for socket connection testing
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'souq-backend',
    socket: 'available'
  });
});

// Routes
const userRoutes = require('./app/user');
app.use('/api/user', userRoutes);

// SEO Routes (at root level for sitemap.xml and robots.txt)
const seoRoutes = require('./app/user/seo/routes/seoRoutes');
app.use('/', seoRoutes);

// Server & Socket
const server = http.createServer(app);
const io = initSocket(server);

// Set socket instance in offer controller
const { setSocketIO } = require('./app/user/offer/controllers/offerController');
setSocketIO(io);

// Set socket instance in notification controller
const { setSocketIO: setNotificationSocketIO } = require('./app/user/notifications/controllers/notificationController');
setNotificationSocketIO(io);

// Set socket instance in scheduler and start it
setSchedulerSocketIO(io);
startScheduler();

// Initialize payment gateway factory, escrow scheduler, and shipping system
async function initializeEscrowSystem() {
  try {
    console.log('🔄 Initializing escrow system...');

    // Initialize payment gateways
    await paymentGatewayFactory.initialize();

    // Initialize shipping providers
    await shippingFactory.initialize();

    // ESCROW_DISABLED: Skip escrow scheduler wiring and start.
    // escrowScheduler.setSocketIO(io);
    // escrowScheduler.start();

    // Start currency service auto-update
    currencyService.startAutoUpdate();

    // Start shipping service health checks (every 30 minutes)
    setInterval(() => {
      shippingFactory.performHealthChecks();
    }, 30 * 60 * 1000);

    console.log('✅ Escrow and shipping systems initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize systems:', error);
  }
}

// Start the server
server.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);

  // Initialize escrow system after server starts
  await initializeEscrowSystem();
});

