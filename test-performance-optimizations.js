/**
 * Performance Optimization Test Script
 * Tests the optimized API endpoints to verify improvements
 */

const axios = require('axios');

const BASE_URL = 'https://souq-main-backend.vercel.app/api/user';
const OPTIMIZED_BASE_URL = 'https://souq-main-backend.vercel.app/api/user/products';

async function testPerformanceOptimizations() {
  console.log('🧪 Testing Performance Optimizations...\n');

  const tests = [
    {
      name: 'Original Products Endpoint',
      url: `${BASE_URL}/product`,
      method: 'GET'
    },
    {
      name: 'Optimized Products Endpoint',
      url: `${OPTIMIZED_BASE_URL}/optimized`,
      method: 'GET'
    },
    {
      name: 'Original Categories Endpoint',
      url: `${BASE_URL}/general/category`,
      method: 'GET'
    },
    {
      name: 'Optimized Categories Endpoint',
      url: `${OPTIMIZED_BASE_URL}/optimized/categories/all`,
      method: 'GET'
    },
    {
      name: 'Performance Health Check',
      url: `${OPTIMIZED_BASE_URL}/performance/health`,
      method: 'GET'
    }
  ];

  const results = [];

  for (const test of tests) {
    console.log(`🔍 Testing: ${test.name}`);
    
    try {
      const startTime = Date.now();
      const response = await axios({
        method: test.method,
        url: test.url,
        timeout: 30000, // 30 second timeout
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      const result = {
        name: test.name,
        url: test.url,
        status: response.status,
        responseTime: responseTime,
        dataSize: JSON.stringify(response.data).length,
        success: response.status >= 200 && response.status < 300
      };
      
      results.push(result);
      
      // Log result
      if (result.success) {
        console.log(`   ✅ Success: ${responseTime}ms (${result.dataSize} bytes)`);
      } else {
        console.log(`   ❌ Failed: ${response.status} - ${responseTime}ms`);
      }
      
    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - Date.now();
      
      const result = {
        name: test.name,
        url: test.url,
        status: error.response?.status || 0,
        responseTime: responseTime,
        dataSize: 0,
        success: false,
        error: error.message
      };
      
      results.push(result);
      
      console.log(`   ❌ Error: ${error.message} - ${responseTime}ms`);
    }
    
    console.log(''); // Empty line for readability
  }

  // Performance Analysis
  console.log('📊 Performance Analysis:\n');
  
  const originalProducts = results.find(r => r.name === 'Original Products Endpoint');
  const optimizedProducts = results.find(r => r.name === 'Optimized Products Endpoint');
  const originalCategories = results.find(r => r.name === 'Original Categories Endpoint');
  const optimizedCategories = results.find(r => r.name === 'Optimized Categories Endpoint');
  const healthCheck = results.find(r => r.name === 'Performance Health Check');

  // Products comparison
  if (originalProducts && optimizedProducts && originalProducts.success && optimizedProducts.success) {
    const improvement = ((originalProducts.responseTime - optimizedProducts.responseTime) / originalProducts.responseTime * 100).toFixed(1);
    console.log(`📦 Products Endpoint:`);
    console.log(`   Original: ${originalProducts.responseTime}ms`);
    console.log(`   Optimized: ${optimizedProducts.responseTime}ms`);
    console.log(`   Improvement: ${improvement}% faster`);
    console.log(`   Data Size: ${originalProducts.dataSize} → ${optimizedProducts.dataSize} bytes`);
    console.log('');
  }

  // Categories comparison
  if (originalCategories && optimizedCategories && originalCategories.success && optimizedCategories.success) {
    const improvement = ((originalCategories.responseTime - optimizedCategories.responseTime) / originalCategories.responseTime * 100).toFixed(1);
    console.log(`📂 Categories Endpoint:`);
    console.log(`   Original: ${originalCategories.responseTime}ms`);
    console.log(`   Optimized: ${optimizedCategories.responseTime}ms`);
    console.log(`   Improvement: ${improvement}% faster`);
    console.log(`   Data Size: ${originalCategories.dataSize} → ${optimizedCategories.dataSize} bytes`);
    console.log('');
  }

  // Health check
  if (healthCheck && healthCheck.success) {
    console.log(`🏥 Performance Health Check:`);
    console.log(`   Status: ✅ Healthy`);
    console.log(`   Response Time: ${healthCheck.responseTime}ms`);
    console.log('');
  }

  // Overall summary
  const successfulTests = results.filter(r => r.success).length;
  const totalTests = results.length;
  
  console.log(`📋 Test Summary:`);
  console.log(`   Total Tests: ${totalTests}`);
  console.log(`   Successful: ${successfulTests}`);
  console.log(`   Failed: ${totalTests - successfulTests}`);
  console.log(`   Success Rate: ${((successfulTests / totalTests) * 100).toFixed(1)}%`);

  // Recommendations
  console.log('\n💡 Recommendations:');
  
  if (optimizedProducts && optimizedProducts.success) {
    if (optimizedProducts.responseTime < 500) {
      console.log('   ✅ Products endpoint is performing well');
    } else if (optimizedProducts.responseTime < 1000) {
      console.log('   ⚠️ Products endpoint could be optimized further');
    } else {
      console.log('   ❌ Products endpoint needs immediate optimization');
    }
  }

  if (optimizedCategories && optimizedCategories.success) {
    if (optimizedCategories.responseTime < 200) {
      console.log('   ✅ Categories endpoint is performing well');
    } else if (optimizedCategories.responseTime < 500) {
      console.log('   ⚠️ Categories endpoint could be optimized further');
    } else {
      console.log('   ❌ Categories endpoint needs immediate optimization');
    }
  }

  console.log('\n🎯 Next Steps:');
  console.log('1. Update frontend to use optimized endpoints');
  console.log('2. Monitor performance metrics in production');
  console.log('3. Set up performance alerts');
  console.log('4. Consider implementing CDN for static assets');

  return results;
}

// Run the test
if (require.main === module) {
  testPerformanceOptimizations()
    .then((results) => {
      console.log('\n✅ Performance test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Performance test failed:', error.message);
      process.exit(1);
    });
}

module.exports = testPerformanceOptimizations;
