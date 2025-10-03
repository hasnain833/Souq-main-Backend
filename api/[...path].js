const serverless = require('serverless-http');
require('dotenv').config();

const app = require('../server');
const connectDB = require('../db');

// Catch-all serverless entry for any /api/* path on Vercel
module.exports = async (req, res) => {
  try {
    await connectDB();
  } catch (err) {
    console.error('DB connect error in serverless catch-all handler:', err?.message || err);
  }

  // Ensure Express sees routes with the /api prefix our app expects
  if (req.url && !req.url.startsWith('/api')) {
    req.url = `/api${req.url}`;
  }

  const handler = serverless(app);
  return handler(req, res);
};
