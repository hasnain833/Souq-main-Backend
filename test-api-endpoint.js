// Test script to verify API endpoints
const axios = require('axios');

const testEndpoints = async () => {
  const baseURL = 'http://localhost:5000/api/user';
  
  try {
    console.log('🧪 Testing card API endpoints...');
    
    // Test the test endpoint (no auth required)
    console.log('1. Testing /cards/test endpoint...');
    try {
      const testResponse = await axios.get(`${baseURL}/cards/test`);
      console.log('✅ Test endpoint response:', testResponse.data);
    } catch (error) {
      console.log('❌ Test endpoint failed:', error.response?.status, error.response?.data || error.message);
    }
    
    // Test the verify endpoint (requires auth - should get 401)
    console.log('2. Testing /cards/verify-and-save endpoint (without auth)...');
    try { 
      const verifyResponse = await axios.post(`${baseURL}/cards/verify-and-save`, {
        cardNumber: '4111111111111111',
        expiryMonth: '12',
        expiryYear: '25',
        cvv: '123',
        cardholderName: 'Test User'
      });
      console.log('✅ Verify endpoint response:', verifyResponse.data);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Verify endpoint correctly requires authentication (401)');
      } else {
        console.log('❌ Verify endpoint failed:', error.response?.status, error.response?.data || error.message);
      }
    }
    
    console.log('🎉 API endpoint tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

// Run the test
testEndpoints();
