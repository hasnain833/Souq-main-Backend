const axios = require('axios');
require('dotenv').config();

async function testCompletePaymentAPI() {
  try {
    console.log('🧪 Testing /api/user/wallet/complete-payment endpoint...');
    
    // Test data
    const testData = {
      transactionId: 'ESC-1751528763981-2XEUZ498W',
      transactionType: 'escrow'
    };
    
    // You'll need to replace this with a valid access token
    const accessToken = 'your_access_token_here';
    
    console.log('📋 Request data:', JSON.stringify(testData, null, 2));
    console.log('🌐 Making request to: http://localhost:5000/api/user/wallet/complete-payment');
    
    const response = await axios.post(
      'http://localhost:5000/api/user/wallet/complete-payment',
      testData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
    
    console.log('✅ Success Response:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error Response:');
    
    if (error.response) {
      // Server responded with error status
      console.error('Status:', error.response.status);
      console.error('Status Text:', error.response.statusText);
      console.error('Headers:', error.response.headers);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      // Request was made but no response received
      console.error('No response received:', error.request);
    } else {
      // Something else happened
      console.error('Error:', error.message);
    }
    
    console.error('Full error:', error);
  }
}

// Test without authentication first to see if the route exists
async function testRouteExists() {
  try {
    console.log('🔍 Testing if route exists (without auth)...');
    
    const response = await axios.post(
      'http://localhost:5000/api/user/wallet/complete-payment',
      { transactionId: 'test' },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      }
    );
    
    console.log('✅ Route exists, got response:', response.status);
    
  } catch (error) {
    if (error.response) {
      console.log('✅ Route exists, got error response:', error.response.status);
      if (error.response.status === 401) {
        console.log('✅ Route requires authentication (expected)');
      } else if (error.response.status === 500) {
        console.log('❌ Route has internal server error');
        console.log('Error data:', error.response.data);
      }
    } else {
      console.error('❌ Route might not exist or server is down:', error.message);
    }
  }
}

// Run tests
console.log('🚀 Starting API tests...');
testRouteExists()
  .then(() => {
    console.log('\n📝 To test with authentication:');
    console.log('1. Get a valid access token from login');
    console.log('2. Replace "your_access_token_here" in the script');
    console.log('3. Uncomment the line below and run again');
    console.log('');
    // testCompletePaymentAPI();
  })
  .catch(console.error);
