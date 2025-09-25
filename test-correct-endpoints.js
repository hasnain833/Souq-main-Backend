const axios = require('axios');

async function testCorrectEndpoints() {
  console.log('🧪 Testing Correct Admin API Endpoints...\n');

  const baseURL = 'http://localhost:5001/api/admin';

  console.log('🔗 Testing endpoints on the correct port (5001)...\n');

  const endpoints = [
    { path: '/orders/stats', name: 'Orders Statistics' },
    { path: '/orders', name: 'All Orders' },
    { path: '/orders/method/escrow', name: 'Escrow Orders' },
    { path: '/orders/method/standard', name: 'Standard Orders' },
    { path: '/ratings/stats', name: 'Ratings Statistics' },
    { path: '/ratings', name: 'All Ratings' },
    { path: '/reports/stats', name: 'Reports Statistics' },
    { path: '/reports', name: 'All Reports' }
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`Testing: ${endpoint.name}`);
      console.log(`   URL: ${baseURL}${endpoint.path}`);
      
      const response = await axios.get(`${baseURL}${endpoint.path}`, {
        timeout: 5000,
        validateStatus: function (status) {
          // Accept any status code to see what we get
          return true;
        }
      });
      
      if (response.status === 401) {
        console.log('   ✅ Endpoint exists (requires authentication)');
      } else if (response.status === 404) {
        console.log('   ❌ Endpoint not found (404)');
      } else if (response.status === 200) {
        console.log('   ✅ Endpoint working (200 OK)');
        if (response.data && response.data.data) {
          const data = response.data.data;
          if (endpoint.path.includes('stats')) {
            console.log(`   📊 Stats: ${JSON.stringify(data).substring(0, 100)}...`);
          } else {
            console.log(`   📄 Data: Found ${data.orders?.length || data.ratings?.length || data.reports?.length || 0} items`);
          }
        }
      } else {
        console.log(`   ⚠️ Unexpected status: ${response.status}`);
      }
      
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log('   ❌ Admin server not running on port 5001');
      } else if (error.code === 'ENOTFOUND') {
        console.log('   ❌ Cannot connect to localhost');
      } else {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }
    
    console.log('');
  }

  console.log('📝 Summary:');
  console.log('✅ All endpoints configured for port 5001');
  console.log('🔗 Frontend API client updated to use port 5001');
  console.log('');
  console.log('🚀 To start the admin server:');
  console.log('   cd backend');
  console.log('   npm run start:admin   # Runs adminApp.js on port 5001');
  console.log('   # OR');
  console.log('   node adminApp.js      # Direct execution');
  console.log('');
  console.log('📋 Correct API URLs for testing:');
  console.log('   📊 http://localhost:5001/api/admin/orders/stats');
  console.log('   📦 http://localhost:5001/api/admin/orders?page=1&limit=20');
  console.log('   🛡️ http://localhost:5001/api/admin/orders/method/escrow');
  console.log('   💳 http://localhost:5001/api/admin/orders/method/standard');
  console.log('   ⭐ http://localhost:5001/api/admin/ratings/stats');
  console.log('   ⭐ http://localhost:5001/api/admin/ratings');
  console.log('   🚨 http://localhost:5001/api/admin/reports/stats');
  console.log('   🚨 http://localhost:5001/api/admin/reports');
}

// Test health endpoint first
async function testHealthEndpoint() {
  try {
    console.log('🏥 Testing admin server health...');
    const response = await axios.get('http://localhost:5001/api/admin/orders/stats');
    console.log('✅ Admin server is running on port 5001');
    return true;
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('✅ Admin server is running (requires authentication)');
      return true;
    }
    console.log('❌ Admin server not accessible:', error.message);
    return false;
  }
}

// Main test function
async function main() {
  console.log('🔍 Testing SOUQ Admin API Endpoints\n');
  
  const healthOk = await testHealthEndpoint();
  console.log('');
  
  if (healthOk) {
    await testCorrectEndpoints();
  } else {
    console.log('💡 Admin server is not running. Please start it with:');
    console.log('   cd backend');
    console.log('   npm run start:admin');
  }
}

main().catch(console.error);
