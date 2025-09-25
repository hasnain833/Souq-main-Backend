const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();

// Test configuration
const API_BASE_URL = 'http://localhost:5000/api/user';
const TEST_TOKEN = 'your-test-token-here'; // Replace with actual token

const testWalletAPIs = async () => {
  try {
    console.log('🧪 Testing Wallet APIs...');
    
    // Connect to MongoDB first to ensure database is accessible
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/souq', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
    
    const headers = {
      'Authorization': `Bearer ${TEST_TOKEN}`,
      'Content-Type': 'application/json'
    };
    
    // Test 1: Test wallet API connection
    console.log('\n1. Testing wallet API connection...');
    try {
      const response = await axios.get(`${API_BASE_URL}/wallet/test`, { headers });
      console.log('✅ Wallet test API:', response.data.success ? 'PASS' : 'FAIL');
      console.log('   Response:', response.data.message);
    } catch (error) {
      console.log('❌ Wallet test API: FAIL');
      console.log('   Error:', error.response?.data?.message || error.message);
    }
    
    // Test 2: Get wallet details
    console.log('\n2. Testing get wallet...');
    try {
      const response = await axios.get(`${API_BASE_URL}/wallet`, { headers });
      console.log('✅ Get wallet API:', response.data.success ? 'PASS' : 'FAIL');
      console.log('   Wallet ID:', response.data.data?.wallet?.id);
      console.log('   Balances:', response.data.data?.wallet?.balances);
    } catch (error) {
      console.log('❌ Get wallet API: FAIL');
      console.log('   Error:', error.response?.data?.message || error.message);
    }
    
    // Test 3: Get wallet balance
    console.log('\n3. Testing get wallet balance...');
    try {
      const response = await axios.get(`${API_BASE_URL}/wallet/balance?currency=USD`, { headers });
      console.log('✅ Get balance API:', response.data.success ? 'PASS' : 'FAIL');
      console.log('   Balance:', response.data.data?.formattedBalance);
    } catch (error) {
      console.log('❌ Get balance API: FAIL');
      console.log('   Error:', error.response?.data?.message || error.message);
    }
    
    // Test 4: Get transaction history
    console.log('\n4. Testing get transaction history...');
    try {
      const response = await axios.get(`${API_BASE_URL}/wallet/transactions?limit=5`, { headers });
      console.log('✅ Get transactions API:', response.data.success ? 'PASS' : 'FAIL');
      console.log('   Transactions count:', response.data.data?.transactions?.length || 0);
    } catch (error) {
      console.log('❌ Get transactions API: FAIL');
      console.log('   Error:', error.response?.data?.message || error.message);
    }
    
    // Test 5: Get wallet statistics
    console.log('\n5. Testing get wallet statistics...');
    try {
      const response = await axios.get(`${API_BASE_URL}/wallet/statistics?period=30`, { headers });
      console.log('✅ Get statistics API:', response.data.success ? 'PASS' : 'FAIL');
      console.log('   Total balance:', response.data.data?.totalBalance);
    } catch (error) {
      console.log('❌ Get statistics API: FAIL');
      console.log('   Error:', error.response?.data?.message || error.message);
    }
    
    // Test 6: Debug payment status
    console.log('\n6. Testing debug payment status...');
    try {
      const response = await axios.get(`${API_BASE_URL}/wallet/debug`, { headers });
      console.log('✅ Debug API:', response.data.success ? 'PASS' : 'FAIL');
    } catch (error) {
      console.log('❌ Debug API: FAIL');
      console.log('   Error:', error.response?.data?.message || error.message);
    }
    
    console.log('\n🎉 Wallet API testing completed!');
    console.log('💡 If any tests failed, check the server logs for more details.');
    
  } catch (error) {
    console.error('❌ Error during API testing:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('📝 Database connection closed');
    process.exit(0);
  }
};

// Instructions
console.log('📋 Wallet API Test Instructions:');
console.log('1. Make sure your backend server is running on http://localhost:5000');
console.log('2. Replace TEST_TOKEN with a valid JWT token from a logged-in user');
console.log('3. Run: node scripts/test-wallet-apis.js');
console.log('');

// Uncomment the line below to run the tests
// testWalletAPIs();
