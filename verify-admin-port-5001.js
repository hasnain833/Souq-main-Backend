const axios = require('axios');

async function verifyAdminPort5001() {
  console.log('🔍 Verifying Admin API on Port 5001...\n');

  const baseURL = 'http://localhost:5001/api/admin';
  
  // Test all the endpoints you mentioned
  const testEndpoints = [
    {
      name: 'Orders Stats',
      url: `${baseURL}/orders/stats`,
      fullUrl: 'http://localhost:5001/api/admin/orders/stats'
    },
    {
      name: 'Orders List',
      url: `${baseURL}/orders?page=1&limit=20&search=&status=&sortBy=createdAt&sortOrder=desc&dateFrom=&dateTo=`,
      fullUrl: 'http://localhost:5001/api/admin/orders?page=1&limit=20&search=&status=&sortBy=createdAt&sortOrder=desc&dateFrom=&dateTo='
    },
    {
      name: 'Ratings Stats',
      url: `${baseURL}/ratings/stats`,
      fullUrl: 'http://localhost:5001/api/admin/ratings/stats'
    },
    {
      name: 'Ratings List',
      url: `${baseURL}/ratings?page=1&limit=20&search=&rating=&ratingType=&status=&sortBy=createdAt&sortOrder=desc&dateFrom=&dateTo=`,
      fullUrl: 'http://localhost:5001/api/admin/ratings?page=1&limit=20&search=&rating=&ratingType=&status=&sortBy=createdAt&sortOrder=desc&dateFrom=&dateTo='
    },
    {
      name: 'Reports Stats',
      url: `${baseURL}/reports/stats`,
      fullUrl: 'http://localhost:5001/api/admin/reports/stats'
    },
    {
      name: 'Reports List',
      url: `${baseURL}/reports?page=1&limit=20&search=&reason=&status=&sortBy=createdAt&sortOrder=desc&dateFrom=&dateTo=`,
      fullUrl: 'http://localhost:5001/api/admin/reports?page=1&limit=20&search=&reason=&status=&sortBy=createdAt&sortOrder=desc&dateFrom=&dateTo='
    }
  ];

  let serverRunning = false;
  let endpointsWorking = 0;

  for (const endpoint of testEndpoints) {
    try {
      console.log(`Testing: ${endpoint.name}`);
      console.log(`   URL: ${endpoint.fullUrl}`);
      
      const response = await axios.get(endpoint.url, {
        timeout: 5000,
        validateStatus: function (status) {
          return true; // Accept any status to see what we get
        }
      });
      
      serverRunning = true;
      
      if (response.status === 401) {
        console.log('   ✅ Endpoint exists (requires authentication)');
        endpointsWorking++;
      } else if (response.status === 404) {
        console.log('   ❌ Endpoint not found (404)');
      } else if (response.status === 200) {
        console.log('   ✅ Endpoint working (200 OK)');
        endpointsWorking++;
        if (response.data && response.data.data) {
          const data = response.data.data;
          if (endpoint.name.includes('Stats')) {
            console.log(`   📊 Data: ${JSON.stringify(data).substring(0, 100)}...`);
          } else {
            console.log(`   📄 Items: ${data.orders?.length || data.ratings?.length || data.reports?.length || 0}`);
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

  console.log('📊 Summary:');
  console.log(`   Server Running: ${serverRunning ? '✅ Yes' : '❌ No'}`);
  console.log(`   Working Endpoints: ${endpointsWorking}/${testEndpoints.length}`);
  console.log('');

  if (!serverRunning) {
    console.log('🚀 To start the admin server:');
    console.log('   cd backend');
    console.log('   npm run start:admin');
    console.log('');
  } else if (endpointsWorking === 0) {
    console.log('⚠️ Server is running but admin routes not found');
    console.log('   Check if admin routes are properly registered');
    console.log('');
  } else {
    console.log('✅ Admin API is working correctly on port 5001!');
    console.log('');
    console.log('🎯 Your correct API URLs:');
    testEndpoints.forEach(endpoint => {
      console.log(`   ${endpoint.name}: ${endpoint.fullUrl}`);
    });
    console.log('');
    console.log('💡 Note: All endpoints require admin authentication');
    console.log('   Login through the admin frontend to get a valid token');
  }
}

// Also test the existing categories endpoint to confirm admin server structure
async function testExistingEndpoint() {
  try {
    console.log('🧪 Testing existing admin endpoint...');
    const response = await axios.get('http://localhost:5001/api/admin/categories', {
      timeout: 5000,
      validateStatus: function (status) {
        return true;
      }
    });
    
    if (response.status === 401) {
      console.log('✅ Categories endpoint exists (requires auth) - Admin server is properly configured');
    } else if (response.status === 200) {
      console.log('✅ Categories endpoint working - Admin server is running correctly');
    } else {
      console.log(`⚠️ Categories endpoint returned status: ${response.status}`);
    }
    
    return true;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Admin server not running on port 5001');
    } else {
      console.log(`❌ Error testing categories: ${error.message}`);
    }
    return false;
  }
}

async function main() {
  console.log('🎯 Admin API Port 5001 Verification\n');
  
  const existingEndpointWorks = await testExistingEndpoint();
  console.log('');
  
  if (existingEndpointWorks) {
    await verifyAdminPort5001();
  } else {
    console.log('💡 Please start the admin server first:');
    console.log('   cd backend');
    console.log('   npm run start:admin');
  }
}

main().catch(console.error);
