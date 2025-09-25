// debug-specific-users.js
// Check specific users from the test order

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

async function checkSpecificUsers() {
  console.log('🔍 Checking specific users from test order...\n');
  
  // These are the user IDs from the test order
  const buyerId = '68496f654c309a90fd9fbbe8';
  const sellerId = '687f3442159cec998a4b8d8d';
  
  console.log('👤 Checking buyer:', buyerId);
  const buyer = await User.findById(buyerId);
  if (buyer) {
    console.log('✅ Buyer found:', {
      id: buyer._id,
      firstName: buyer.firstName,
      lastName: buyer.lastName,
      userName: buyer.userName,
      email: buyer.email,
      emailVerifiedAt: buyer.emailVerifiedAt
    });
  } else {
    console.log('❌ Buyer not found');
  }
  
  console.log('\n👤 Checking seller:', sellerId);
  const seller = await User.findById(sellerId);
  if (seller) {
    console.log('✅ Seller found:', {
      id: seller._id,
      firstName: seller.firstName,
      lastName: seller.lastName,
      userName: seller.userName,
      email: seller.email,
      emailVerifiedAt: seller.emailVerifiedAt
    });
  } else {
    console.log('❌ Seller not found');
  }
  
  // Test populate query
  console.log('\n🧪 Testing populate query...');
  const Transaction = require('./db/models/transactionModel');
  
  const transaction = await Transaction.findById('68b561c2f3003af7f1a5aa22')
    .populate('buyer', 'userName profile firstName lastName email')
    .populate('seller', 'userName profile firstName lastName email');
    
  if (transaction) {
    console.log('✅ Transaction with populated data:', {
      buyer: transaction.buyer,
      seller: transaction.seller
    });
  } else {
    console.log('❌ Transaction not found');
  }
}

async function runCheck() {
  await connectDB();
  await checkSpecificUsers();
  await mongoose.connection.close();
  console.log('✅ Database connection closed');
}

runCheck().catch(console.error);