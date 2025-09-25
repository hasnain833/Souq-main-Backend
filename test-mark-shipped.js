const axios = require('axios');
require('dotenv').config();

async function testMarkShipped() {
  try {
    const orderId = '68650cd0e14b7e0bfd244bc2';
    const baseURL = 'http://localhost:5000';
    
    // You'll need to replace this with a valid access token
    const accessToken = 'your_access_token_here';
    
    console.log('🔄 Testing mark shipped API...');
    console.log('Order ID:', orderId);
    console.log('API URL:', `${baseURL}/api/user/orders/${orderId}/status`);
    
    const response = await axios.put(
      `${baseURL}/api/user/orders/${orderId}/status`,
      {
        status: 'shipped',
        notes: 'Order marked as shipped by seller'
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Success:', response.data);
    
  } catch (error) {
    console.error('❌ Error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    
    if (error.response?.status === 404) {
      console.log('💡 The order was not found. This could mean:');
      console.log('   1. The order ID is incorrect');
      console.log('   2. The order exists in a different collection');
      console.log('   3. The order belongs to a different user');
    }
    
    if (error.response?.status === 400) {
      console.log('💡 Bad request. This could mean:');
      console.log('   1. Invalid status transition');
      console.log('   2. Missing required fields');
      console.log('   3. Order is not in the correct state');
    }
    
    if (error.response?.status === 403) {
      console.log('💡 Access denied. This could mean:');
      console.log('   1. You are not the seller of this order');
      console.log('   2. Invalid or expired access token');
    }
  }
}

// Instructions for testing
console.log('📋 To test this script:');
console.log('1. Make sure the backend server is running (npm run dev)');
console.log('2. Replace "your_access_token_here" with a valid access token');
console.log('3. Make sure you are logged in as the seller of the order');
console.log('4. Run: node test-mark-shipped.js');
console.log('');

// Uncomment the line below to run the test
// testMarkShipped();
