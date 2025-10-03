const serverless = require('serverless-http');
require('dotenv').config();

const app = require('../server');
const connectDB = require('../db');

// Vercel serverless entry point
module.exports = async (req, res) => {
  try {
    await connectDB();
  } catch (err) {
    // Log but continue; route handlers can still return errors gracefully
    console.error('DB connect error in serverless handler:', err?.message || err);
  }

  // On Vercel, the function is mounted under "/api". Vercel strips that prefix
  // before invoking the function. Our Express app defines routes starting with
  // "/api/...". Setting basePath ensures route matching works as expected.
  const handler = serverless(app, { basePath: '/api' });
  return handler(req, res);
};
