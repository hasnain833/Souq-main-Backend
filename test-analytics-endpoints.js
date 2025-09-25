const mongoose = require('mongoose');
require('dotenv').config();

async function testAnalyticsEndpoints() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Import the analytics controller
    const analyticsController = require('./app/admin/analytics/controllers/analyticsController');

    // Mock request and response objects
    const createMockResponse = (testName) => ({
      status: (code) => ({
        json: (data) => {
          console.log(`\n📊 ${testName} - Status: ${code}`);
          console.log('📊 Response Data:', JSON.stringify(data, null, 2));
          return data;
        }
      }),
      json: (data) => {
        console.log(`\n📊 ${testName} - Response Data:`, JSON.stringify(data, null, 2));
        return data;
      }
    });

    console.log('\n🔍 Testing Sales Analytics API...');
    const salesReq = { query: { period: '30d' } };
    await analyticsController.getSalesAnalytics(salesReq, createMockResponse('Sales Analytics'));

    console.log('\n🔍 Testing Top Sellers API...');
    const sellersReq = { query: { period: '30d', limit: '10' } };
    await analyticsController.getTopSellers(sellersReq, createMockResponse('Top Sellers'));

    console.log('\n🔍 Testing Category Trends API...');
    const categoryReq = { query: { period: '30d' } };
    await analyticsController.getCategoryTrends(categoryReq, createMockResponse('Category Trends'));

    console.log('\n🔍 Testing User Analytics API...');
    const userReq = { query: {} };
    await analyticsController.getUserAnalytics(userReq, createMockResponse('User Analytics'));

  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

// Run the test
testAnalyticsEndpoints();
