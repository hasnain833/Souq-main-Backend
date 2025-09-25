require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Create main app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Simple server is running'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'SOUQ Marketplace API - Simple Version',
    version: '1.0.0',
    status: 'running'
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

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Simple SOUQ Marketplace API running on http://localhost:${PORT}`);
  console.log(`❤️ Health Check: http://localhost:${PORT}/health`);
});

module.exports = app;
