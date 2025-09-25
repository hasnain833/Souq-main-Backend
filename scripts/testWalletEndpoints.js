const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:5000/api/user';
const TEST_USER_TOKEN = 'your-test-token-here'; // Replace with actual token

// Test wallet endpoints
async function testWalletEndpoints() {
  console.log('🧪 Testing Wallet Endpoints...\n');

  const headers = {
    'Authorization': `Bearer ${TEST_USER_TOKEN}`,
    'Content-Type': 'application/json'
  };

  try {
    // Test 1: Test endpoint
    console.log('1. Testing wallet test endpoint...');
    try {
      const testResponse = await axios.get(`${BASE_URL}/wallet/test`, { headers });
      console.log('✅ Test endpoint response:', testResponse.data);
    } catch (error) {
      console.error('❌ Test endpoint failed:', error.response?.data || error.message);
    }

    // Test 2: Get wallet
    console.log('\n2. Testing get wallet...');
    try {
      const walletResponse = await axios.get(`${BASE_URL}/wallet`, { headers });
      console.log('✅ Wallet response:', walletResponse.data);
    } catch (error) {
      console.error('❌ Get wallet failed:', error.response?.data || error.message);
    }

    // Test 3: Get balance
    console.log('\n3. Testing get balance...');
    try {
      const balanceResponse = await axios.get(`${BASE_URL}/wallet/balance?currency=USD`, { headers });
      console.log('✅ Balance response:', balanceResponse.data);
    } catch (error) {
      console.error('❌ Get balance failed:', error.response?.data || error.message);
    }

    // Test 4: Get transactions
    console.log('\n4. Testing get transactions...');
    try {
      const transactionsResponse = await axios.get(`${BASE_URL}/wallet/transactions`, { headers });
      console.log('✅ Transactions response:', transactionsResponse.data);
    } catch (error) {
      console.error('❌ Get transactions failed:', error.response?.data || error.message);
    }

    // Test 5: Get statistics
    console.log('\n5. Testing get statistics...');
    try {
      const statsResponse = await axios.get(`${BASE_URL}/wallet/statistics`, { headers });
      console.log('✅ Statistics response:', statsResponse.data);
    } catch (error) {
      console.error('❌ Get statistics failed:', error.response?.data || error.message);
    }

  } catch (error) {
    console.error('❌ General error:', error.message);
  }

  console.log('\n🏁 Wallet endpoint testing completed!');
}

// Instructions for running the test
console.log(`
📋 Instructions:
1. Make sure your backend server is running on port 5000
2. Get a valid JWT token by logging in through the frontend or API
3. Replace 'your-test-token-here' with the actual token
4. Run: node scripts/testWalletEndpoints.js

🔧 To get a token:
- Login through frontend and check localStorage.getItem('accessToken')
- Or use Postman to call POST /api/user/auth/login
`);

// Uncomment the line below to run the test (after setting the token)
// testWalletEndpoints();

module.exports = testWalletEndpoints;
