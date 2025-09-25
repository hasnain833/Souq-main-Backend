// test-populate-query.js
// Test the populate query directly

require('dotenv').config();
const mongoose = require('mongoose');
const Transaction = require('./db/models/transactionModel');

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/souq');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
}

async function testPopulateQuery() {
  console.log('🧪 Testing populate query directly...\n');
  
  // Use the same transaction ID from the test
  const transactionId = '68b69fd10f929a9920b7db28';
  
  console.log('🔍 Testing different populate queries...\n');
  
  // Test 1: Basic populate
  console.log('1️⃣ Basic populate with email:');
  const transaction1 = await Transaction.findById(transactionId)
    .populate('buyer', 'email firstName lastName')
    .populate('seller', 'email firstName lastName');
    
  console.log('Buyer:', transaction1?.buyer);
  console.log('Seller:', transaction1?.seller);
  console.log('---');
  
  // Test 2: Populate with userName
  console.log('2️⃣ Populate with userName:');
  const transaction2 = await Transaction.findById(transactionId)
    .populate('buyer', 'userName email firstName lastName')
    .populate('seller', 'userName email firstName lastName');
    
  console.log('Buyer:', transaction2?.buyer);
  console.log('Seller:', transaction2?.seller);
  console.log('---');
  
  // Test 3: Populate all fields
  console.log('3️⃣ Populate all fields:');
  const transaction3 = await Transaction.findById(transactionId)
    .populate('buyer')
    .populate('seller');
    
  console.log('Buyer email:', transaction3?.buyer?.email);
  console.log('Seller email:', transaction3?.seller?.email);
  console.log('---');
  
  // Test 4: Check if buyer/seller IDs are valid
  console.log('4️⃣ Check buyer/seller IDs:');
  const transaction4 = await Transaction.findById(transactionId);
  console.log('Buyer ID:', transaction4?.buyer);
  console.log('Seller ID:', transaction4?.seller);
  
  // Check if these users exist
  const User = require('./db/models/userModel');
  const buyer = await User.findById(transaction4?.buyer);
  const seller = await User.findById(transaction4?.seller);
  
  console.log('Buyer exists:', !!buyer, buyer ? `(${buyer.email})` : '');
  console.log('Seller exists:', !!seller, seller ? `(${seller.email})` : '');
}

async function runTest() {
  await connectDB();
  await testPopulateQuery();
  await mongoose.connection.close();
  console.log('✅ Database connection closed');
}

runTest().catch(console.error);