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

  // Vercel routes functions under "/api" but strips that prefix before calling us,
  // so requests arrive like "/user/..." while our Express app expects "/api/user/...".
  if (req.url && !req.url.startsWith('/api')) {
    req.url = `/api${req.url}`;
  }

  const handler = serverless(app);
  return handler(req, res);
};
