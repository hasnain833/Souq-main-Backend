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

  const handler = serverless(app);
  return handler(req, res);
};
