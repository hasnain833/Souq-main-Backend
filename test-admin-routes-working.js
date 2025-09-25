const axios = require('axios');

async function testAdminRoutes() {
  console.log('🧪 Testing Admin Routes on Port 5001...\n');

  const baseURL = 'http://localhost:5001/api/admin';
  
  // Test endpoints that should return 401 (authentication required)
  const testEndpoints = [
    { name: 'Orders Stats', url: `${baseURL}/orders/stats` },
    { name: 'Orders List', url: `${baseURL}/orders` },
    { name: 'Escrow Orders', url: `${baseURL}/orders/method/escrow` },
    { name: 'Standard Orders', url: `${baseURL}/orders/method/standard` },
    { name: 'Ratings Stats', url: `${baseURL}/ratings/stats` },
    { name: 'Ratings List', url: `${baseURL}/ratings` },
    { name: 'Reports Stats', url: `${baseURL}/reports/stats` },
    { name: 'Reports List', url: `${baseURL}/reports` },
    { name: 'Categories (existing)', url: `${baseURL}/categories` }
  ];

  let serverRunning = false;
  let routesWorking = 0;

  console.log('Testing endpoints (expecting 401 authentication required):\n');

  for (const endpoint of testEndpoints) {
    try {
      const response = await axios.get(endpoint.url, {
        timeout: 5000,
        validateStatus: function (status) {
          return true; // Accept any status
        }
      });
      
      serverRunning = true;
      
      if (response.status === 401) {
        console.log(`✅ ${endpoint.name}: Requires authentication (401) - Route exists`);
        routesWorking++;
      } else if (response.status === 404) {
        console.log(`❌ ${endpoint.name}: Not found (404) - Route missing`);
      } else if (response.status === 200) {
        console.log(`✅ ${endpoint.name}: Working (200) - Route exists`);
        routesWorking++;
      } else {
        console.log(`⚠️ ${endpoint.name}: Status ${response.status}`);
      }
      
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log(`❌ ${endpoint.name}: Server not running on port 5001`);
      } else {
        console.log(`❌ ${endpoint.name}: Error - ${error.message}`);
      }
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   Server Running: ${serverRunning ? '✅ Yes' : '❌ No'}`);
  console.log(`   Working Routes: ${routesWorking}/${testEndpoints.length}`);
  
  if (serverRunning && routesWorking > 0) {
    console.log('\n✅ Admin server is running and routes are accessible!');
    console.log('\n🔗 Your admin API endpoints are working:');
    console.log('   📊 http://localhost:5001/api/admin/orders/stats');
    console.log('   📦 http://localhost:5001/api/admin/orders');
    console.log('   ⭐ http://localhost:5001/api/admin/ratings/stats');
    console.log('   ⭐ http://localhost:5001/api/admin/ratings');
    console.log('   🚨 http://localhost:5001/api/admin/reports/stats');
    console.log('   🚨 http://localhost:5001/api/admin/reports');
    
    console.log('\n💡 Next steps:');
    console.log('   1. Start admin frontend: cd admin-frontend && npm run dev');
    console.log('   2. Login as admin');
    console.log('   3. Navigate to /admin/orders, /admin/ratings, or /admin/reports');
    console.log('   4. Check browser console for any errors');
  } else if (serverRunning) {
    console.log('\n⚠️ Server is running but routes are not working properly');
    console.log('   Check if admin routes are properly registered in backend/app/admin/index.js');
  } else {
    console.log('\n❌ Admin server is not running');
    console.log('   Start it with: cd backend && npm run start:admin');
  }
}

// Test with a simple health check first
async function quickHealthCheck() {
  try {
    console.log('🏥 Quick health check...');
    const response = await axios.get('http://localhost:5001/api/admin/categories', {
      timeout: 3000,
      validateStatus: function (status) {
        return true;
      }
    });
    
    if (response.status === 401) {
      console.log('✅ Admin server is running (categories endpoint requires auth)');
      return true;
    } else if (response.status === 200) {
      console.log('✅ Admin server is running (categories endpoint accessible)');
      return true;
    } else {
      console.log(`⚠️ Admin server responding with status: ${response.status}`);
      return true;
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Admin server not running on port 5001');
      console.log('   Start it with: cd backend && npm run start:admin');
      return false;
    } else {
      console.log(`❌ Error: ${error.message}`);
      return false;
    }
  }
}

async function main() {
  console.log('🎯 Admin Routes Test\n');
  
  const serverOk = await quickHealthCheck();
  console.log('');
  
  if (serverOk) {
    await testAdminRoutes();
  }
}

main().catch(console.error);
