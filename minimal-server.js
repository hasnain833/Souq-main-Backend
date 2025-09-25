const express = require('express');

// Create main app
const app = express();
const PORT = 5000;

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Minimal server is running'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'SOUQ Marketplace API - Minimal Version',
    version: '1.0.0',
    status: 'running'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Minimal SOUQ Marketplace API running on http://localhost:${PORT}`);
  console.log(`❤️ Health Check: http://localhost:${PORT}/health`);
});
