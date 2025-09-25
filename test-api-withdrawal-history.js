const axios = require('axios');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import models for getting user token
const User = require('./db/models/userModel');
const BankAccount = require('./db/models/bankAccountModel');

async function testAPIWithdrawalHistory() {
  try {
    console.log('🧪 Testing API Withdrawal History Endpoint...\n');

    // Connect to MongoDB to get user info
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/souq-marketplace');
    console.log('✅ Connected to MongoDB');

    // Find a user with a bank account
    const bankAccount = await BankAccount.findOne({ isActive: true });
    if (!bankAccount) {
      console.log('❌ No active bank account found');
      return;
    }

    const user = await User.findById(bankAccount.user);
    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('👤 Testing with user:', {
      id: user._id,
      email: user.email,
      name: user.name
    });

    // For testing, we'll need to simulate authentication
    // In a real scenario, you would get the JWT token from login
    console.log('⚠️ Note: This test requires a valid JWT token');
    console.log('🔧 You can get a token by logging in through the frontend');

    // Test API endpoints
    const baseURL = 'http://localhost:5000';
    const endpoints = [
      {
        name: 'Get All Withdrawals',
        url: `${baseURL}/api/user/wallet/withdrawals`,
        params: {}
      },
      {
        name: 'Get Pending Withdrawals',
        url: `${baseURL}/api/user/wallet/withdrawals`,
        params: { status: 'pending' }
      },
      {
        name: 'Get Completed Withdrawals',
        url: `${baseURL}/api/user/wallet/withdrawals`,
        params: { status: 'completed' }
      },
      {
        name: 'Get Failed Withdrawals',
        url: `${baseURL}/api/user/wallet/withdrawals`,
        params: { status: 'failed' }
      }
    ];

    console.log('\n📋 API Endpoints to test:');
    endpoints.forEach((endpoint, index) => {
      const queryString = new URLSearchParams(endpoint.params).toString();
      const fullUrl = queryString ? `${endpoint.url}?${queryString}` : endpoint.url;
      console.log(`   ${index + 1}. ${endpoint.name}: ${fullUrl}`);
    });

    console.log('\n🔧 To test these endpoints manually:');
    console.log('1. Start the backend server: npm start');
    console.log('2. Login through the frontend to get a JWT token');
    console.log('3. Use the token in Authorization header: Bearer <token>');
    console.log('4. Make GET requests to the endpoints above');

    console.log('\n📝 Example curl command:');
    console.log(`curl -H "Authorization: Bearer YOUR_JWT_TOKEN" "${baseURL}/api/user/wallet/withdrawals"`);

    console.log('\n📊 Expected Response Format:');
    console.log(`{
  "success": true,
  "message": "Withdrawal history retrieved successfully",
  "data": {
    "transactions": [
      {
        "transactionId": "WTX_...",
        "payoutId": "po_...",
        "amount": 100.00,
        "currency": "USD",
        "status": "pending",
        "description": "Withdrawal to Bank ****1234",
        "bankAccount": {
          "bankName": "Bank Name",
          "lastFourDigits": "1234"
        },
        "createdAt": "2025-07-28T...",
        "estimatedArrival": "2025-07-30T...",
        "message": "Your withdrawal is being processed..."
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalTransactions": 1,
      "hasNext": false,
      "hasPrev": false
    }
  }
}`);

    console.log('\n🐛 Debugging Steps:');
    console.log('1. Check browser console for API call logs');
    console.log('2. Check Network tab in browser dev tools');
    console.log('3. Verify JWT token is being sent correctly');
    console.log('4. Check backend logs for API requests');
    console.log('5. Verify withdrawal transactions exist in database');

    console.log('\n🔍 Frontend Debugging:');
    console.log('1. Open browser dev tools (F12)');
    console.log('2. Go to Console tab');
    console.log('3. Click "Withdrawal History" button');
    console.log('4. Look for these log messages:');
    console.log('   - "🔄 Loading withdrawals with filters:"');
    console.log('   - "📥 Withdrawal history response:"');
    console.log('   - "📊 Parsed data:"');

  } catch (error) {
    console.error('❌ Test setup failed:', error);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('\n✅ MongoDB connection closed');
  }
}

// Run the test
if (require.main === module) {
  testAPIWithdrawalHistory();
}

module.exports = testAPIWithdrawalHistory;
