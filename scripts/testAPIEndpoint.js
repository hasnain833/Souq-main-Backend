const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const ShippingProvider = require('../db/models/shippingProviderModel');
require('dotenv').config();

// Create a simple test server
const app = express();
const PORT = 5001; // Different port to avoid conflicts

// CORS configuration
app.use(cors({
  origin: '*',
  credentials: true,
}));

app.use(express.json());

// Simple test route
app.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Test endpoint working',
    timestamp: new Date().toISOString()
  });
});

// Test shipping providers endpoint (without auth)
app.get('/api/user/shipping/providers', async (req, res) => {
  try {
    console.log('📦 Shipping providers endpoint called');
    
    const providers = await ShippingProvider.find({ isActive: true })
      .select('name displayName supportedServices supportedCountries pricing features limits');
    
    console.log(`Found ${providers.length} providers`);
    
    res.json({
      success: true,
      data: { providers }
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch shipping providers'
    });
  }
});

// Test shipping providers endpoint (with mock auth)
app.get('/api/user/shipping/providers-auth', (req, res, next) => {
  // Mock auth middleware
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'No authorization token provided'
    });
  }
  next();
}, async (req, res) => {
  try {
    console.log('🔐 Authenticated shipping providers endpoint called');
    
    const providers = await ShippingProvider.find({ isActive: true })
      .select('name displayName supportedServices supportedCountries pricing features limits');
    
    console.log(`Found ${providers.length} providers`);
    
    res.json({
      success: true,
      data: { providers }
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch shipping providers'
    });
  }
});

// Start test server
async function startTestServer() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/souq');
    console.log('✅ Connected to MongoDB');

    // Start server
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🧪 Test server running on http://localhost:${PORT}`);
      console.log('\n📋 Available test endpoints:');
      console.log(`   GET http://localhost:${PORT}/test`);
      console.log(`   GET http://localhost:${PORT}/api/user/shipping/providers`);
      console.log(`   GET http://localhost:${PORT}/api/user/shipping/providers-auth`);
      console.log('\n💡 Test these endpoints in your browser or with curl:');
      console.log(`   curl http://localhost:${PORT}/test`);
      console.log(`   curl http://localhost:${PORT}/api/user/shipping/providers`);
      console.log(`   curl -H "Authorization: Bearer test-token" http://localhost:${PORT}/api/user/shipping/providers-auth`);
      console.log('\n⏹️  Press Ctrl+C to stop the test server');
    });

  } catch (error) {
    console.error('❌ Failed to start test server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down test server...');
  await mongoose.connection.close();
  process.exit(0);
});

// Start the test server
startTestServer();
