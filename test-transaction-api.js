const axios = require('axios');

async function testTransactionAPI() {
  try {
    const baseURL = 'http://localhost:5000';
    const transactionId = 'TXN_1753269981362_4NEG0L';
    
    console.log(`🧪 Testing transaction API for: ${transactionId}`);
    
    // Test 1: Transaction Status
    console.log('\n1. Testing transaction status API...');
    try {
      const statusResponse = await axios.get(`${baseURL}/api/user/transactions/${transactionId}/status`, {
        headers: {
          'Authorization': 'Bearer test-token', // This will fail auth but we can see if the endpoint is found
          'Content-Type': 'application/json'
        }
      });
      console.log('✅ Status API response:', statusResponse.data);
    } catch (error) {
      if (error.response) {
        console.log(`📋 Status API response (${error.response.status}):`, error.response.data);
      } else {
        console.log('❌ Status API error:', error.message);
      }
    }
    
    // Test 2: Transaction Transitions
    console.log('\n2. Testing transaction transitions API...');
    try {
      const transitionsResponse = await axios.get(`${baseURL}/api/user/transactions/${transactionId}/transitions`, {
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json'
        }
      });
      console.log('✅ Transitions API response:', transitionsResponse.data);
    } catch (error) {
      if (error.response) {
        console.log(`📋 Transitions API response (${error.response.status}):`, error.response.data);
      } else {
        console.log('❌ Transitions API error:', error.message);
      }
    }
    
    // Test 3: Debug endpoint
    console.log('\n3. Testing debug endpoint...');
    try {
      const debugResponse = await axios.get(`${baseURL}/api/user/transactions/debug/${transactionId}`, {
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json'
        }
      });
      console.log('✅ Debug API response:', debugResponse.data);
    } catch (error) {
      if (error.response) {
        console.log(`📋 Debug API response (${error.response.status}):`, error.response.data);
      } else {
        console.log('❌ Debug API error:', error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

// Run the test
testTransactionAPI();
