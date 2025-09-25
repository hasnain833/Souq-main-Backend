const axios = require('axios');

// Test the admin API endpoints on the correct port (5001)
async function testAdminEndpoints() {
  console.log('🧪 Testing Admin API Endpoints on Port 5001...\n');

  const baseURL = 'http://localhost:5001/api/admin';
  
  // Mock admin token (you'll need to get a real token from login)
  const adminToken = 'your-admin-token-here'; // Replace with actual token
  
  const headers = {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  };

  try {
    console.log('📋 Testing Orders API Endpoints...\n');

    // Test 1: Orders Stats
    console.log('1. Testing GET /api/admin/orders/stats');
    console.log('   URL: http://localhost:5001/api/admin/orders/stats');
    try {
      const statsResponse = await axios.get(`${baseURL}/orders/stats`, { headers });
      console.log('   ✅ Success:', statsResponse.data.success);
      console.log('   📊 Total Orders:', statsResponse.data.data?.totalOrders || 0);
      console.log('   📦 Escrow Orders:', statsResponse.data.data?.paymentMethods?.escrow || 0);
      console.log('   💳 Standard Orders:', statsResponse.data.data?.paymentMethods?.standard || 0);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('   ⚠️ Authentication required - Please provide valid admin token');
      } else {
        console.log('   ❌ Error:', error.message);
      }
    }

    console.log('\n2. Testing GET /api/admin/orders (with pagination)');
    console.log('   URL: http://localhost:5001/api/admin/orders?page=1&limit=20&search=&status=&sortBy=createdAt&sortOrder=desc&dateFrom=&dateTo=');
    try {
      const ordersResponse = await axios.get(`${baseURL}/orders`, {
        headers,
        params: {
          page: 1,
          limit: 20,
          search: '',
          status: '',
          sortBy: 'createdAt',
          sortOrder: 'desc',
          dateFrom: '',
          dateTo: ''
        }
      });
      console.log('   ✅ Success:', ordersResponse.data.success);
      console.log('   📦 Orders Found:', ordersResponse.data.data?.orders?.length || 0);
      console.log('   📄 Current Page:', ordersResponse.data.data?.pagination?.currentPage || 1);
      console.log('   📄 Total Pages:', ordersResponse.data.data?.pagination?.totalPages || 1);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('   ⚠️ Authentication required - Please provide valid admin token');
      } else {
        console.log('   ❌ Error:', error.message);
      }
    }

    console.log('\n3. Testing GET /api/admin/orders/method/escrow');
    console.log('   URL: http://localhost:5001/api/admin/orders/method/escrow');
    try {
      const escrowOrdersResponse = await axios.get(`${baseURL}/orders/method/escrow`, { headers });
      console.log('   ✅ Success:', escrowOrdersResponse.data.success);
      console.log('   🛡️ Escrow Orders:', escrowOrdersResponse.data.data?.orders?.length || 0);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('   ⚠️ Authentication required - Please provide valid admin token');
      } else {
        console.log('   ❌ Error:', error.message);
      }
    }

    console.log('\n4. Testing GET /api/admin/orders/method/standard');
    console.log('   URL: http://localhost:5001/api/admin/orders/method/standard');
    try {
      const standardOrdersResponse = await axios.get(`${baseURL}/orders/method/standard`, { headers });
      console.log('   ✅ Success:', standardOrdersResponse.data.success);
      console.log('   💳 Standard Orders:', standardOrdersResponse.data.data?.orders?.length || 0);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('   ⚠️ Authentication required - Please provide valid admin token');
      } else {
        console.log('   ❌ Error:', error.message);
      }
    }

    console.log('\n📋 Testing Ratings API Endpoints...\n');

    console.log('5. Testing GET /api/admin/ratings/stats');
    console.log('   URL: http://localhost:5001/api/admin/ratings/stats');
    try {
      const ratingStatsResponse = await axios.get(`${baseURL}/ratings/stats`, { headers });
      console.log('   ✅ Success:', ratingStatsResponse.data.success);
      console.log('   ⭐ Total Ratings:', ratingStatsResponse.data.data?.totalRatings || 0);
      console.log('   📊 Average Rating:', ratingStatsResponse.data.data?.averageRating?.toFixed(2) || 'N/A');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('   ⚠️ Authentication required - Please provide valid admin token');
      } else {
        console.log('   ❌ Error:', error.message);
      }
    }

    console.log('\n6. Testing GET /api/admin/ratings');
    console.log('   URL: http://localhost:5001/api/admin/ratings');
    try {
      const ratingsResponse = await axios.get(`${baseURL}/ratings`, { headers });
      console.log('   ✅ Success:', ratingsResponse.data.success);
      console.log('   ⭐ Ratings Found:', ratingsResponse.data.data?.ratings?.length || 0);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('   ⚠️ Authentication required - Please provide valid admin token');
      } else {
        console.log('   ❌ Error:', error.message);
      }
    }

    console.log('\n📋 Testing Reports API Endpoints...\n');

    console.log('7. Testing GET /api/admin/reports/stats');
    console.log('   URL: http://localhost:5001/api/admin/reports/stats');
    try {
      const reportStatsResponse = await axios.get(`${baseURL}/reports/stats`, { headers });
      console.log('   ✅ Success:', reportStatsResponse.data.success);
      console.log('   🚨 Total Reports:', reportStatsResponse.data.data?.totalReports || 0);
      console.log('   ⏳ Pending Reports:', reportStatsResponse.data.data?.pendingReports || 0);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('   ⚠️ Authentication required - Please provide valid admin token');
      } else {
        console.log('   ❌ Error:', error.message);
      }
    }

    console.log('\n8. Testing GET /api/admin/reports');
    console.log('   URL: http://localhost:5001/api/admin/reports');
    try {
      const reportsResponse = await axios.get(`${baseURL}/reports`, { headers });
      console.log('   ✅ Success:', reportsResponse.data.success);
      console.log('   🚨 Reports Found:', reportsResponse.data.data?.reports?.length || 0);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('   ⚠️ Authentication required - Please provide valid admin token');
      } else {
        console.log('   ❌ Error:', error.message);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }

  console.log('\n📝 Summary:');
  console.log('✅ All endpoints are configured for port 5001');
  console.log('⚠️ Authentication required - Please login as admin to get a valid token');
  console.log('\n🔗 Correct API URLs:');
  console.log('📊 Orders Stats: http://localhost:5001/api/admin/orders/stats');
  console.log('📦 All Orders: http://localhost:5001/api/admin/orders?page=1&limit=20');
  console.log('🛡️ Escrow Orders: http://localhost:5001/api/admin/orders/method/escrow');
  console.log('💳 Standard Orders: http://localhost:5001/api/admin/orders/method/standard');
  console.log('⭐ Ratings Stats: http://localhost:5001/api/admin/ratings/stats');
  console.log('⭐ All Ratings: http://localhost:5001/api/admin/ratings');
  console.log('🚨 Reports Stats: http://localhost:5001/api/admin/reports/stats');
  console.log('🚨 All Reports: http://localhost:5001/api/admin/reports');
}

// Test without authentication (will show 401 errors but confirm endpoints exist)
async function testEndpointsWithoutAuth() {
  console.log('\n🔓 Testing endpoints without authentication (expecting 401 errors)...\n');
  
  const baseURL = 'http://localhost:5001/api/admin';
  
  const endpoints = [
    '/orders/stats',
    '/orders',
    '/orders/method/escrow',
    '/orders/method/standard',
    '/ratings/stats',
    '/ratings',
    '/reports/stats',
    '/reports'
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`Testing: ${baseURL}${endpoint}`);
      await axios.get(`${baseURL}${endpoint}`);
      console.log('   ✅ Unexpected success (should require auth)');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('   ✅ Correctly requires authentication (401)');
      } else if (error.code === 'ECONNREFUSED') {
        console.log('   ❌ Server not running on port 5001');
      } else {
        console.log(`   ❌ Unexpected error: ${error.message}`);
      }
    }
  }
}

// Run tests
if (require.main === module) {
  console.log('🚀 Starting API endpoint tests for port 5001...\n');
  testEndpointsWithoutAuth().then(() => {
    console.log('\n' + '='.repeat(60));
    return testAdminEndpoints();
  });
}

module.exports = { testAdminEndpoints, testEndpointsWithoutAuth };
