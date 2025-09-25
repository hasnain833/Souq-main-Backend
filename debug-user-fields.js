// debug-user-fields.js
// Check what fields are available in user records

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./db/models/userModel');

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/souq');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
}

async function checkUserFields() {
  console.log('🔍 Checking user fields...\n');
  
  // Find a few users to see what fields they have
  const users = await User.find({}).limit(3);
  
  users.forEach((user, index) => {
    console.log(`👤 User ${index + 1}:`, {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      userName: user.userName,
      email: user.email,
      profile: user.profile,
      emailVerifiedAt: user.emailVerifiedAt,
      // Show all available fields
      allFields: Object.keys(user.toObject())
    });
    console.log('---');
  });
}

async function runCheck() {
  await connectDB();
  await checkUserFields();
  await mongoose.connection.close();
  console.log('✅ Database connection closed');
}

runCheck().catch(console.error);