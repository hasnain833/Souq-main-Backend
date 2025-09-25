require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const passport = require('passport');
require('./utils/passport');
const connectDB = require('./db');

const app = express();
const PORT = process.env.ADMIN_PORT || 5001;

// Connect to DB
connectDB();

// CORS setup — allow local and Render domains
app.use(cors({
  origin: [
    'http://localhost:5174',
    'http://localhost:5173',
    'https://souq-admin-web.netlify.app',
    'https://souq-admin.onrender.com'         // Production admin frontend
  ],
  credentials: true
}));

app.use(express.json());
app.use(passport.initialize());

// Serve static files (images, uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
const adminRoutes = require('./app/admin/');
app.use('/api/admin', adminRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Admin API running on ${process.env.ADMIN_BASE_URL || `http://localhost:${PORT}`}`);
});
