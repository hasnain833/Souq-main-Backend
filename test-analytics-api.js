const mongoose = require('mongoose');
require('dotenv').config();

async function testAnalyticsAPI() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Import the analytics controller
    const analyticsController = require('./app/admin/analytics/controllers/analyticsController');

    // Mock request and response objects
    const req = {};
    const res = {
      status: (code) => ({
        json: (data) => {
          console.log(`📊 Response Status: ${code}`);
          console.log('📊 Response Data:', JSON.stringify(data, null, 2));
          return data;
        }
      }),
      json: (data) => {
        console.log('📊 Response Data:', JSON.stringify(data, null, 2));
        return data;
      }
    };

    console.log('\n🔍 Testing Dashboard Stats API...');
    await analyticsController.getDashboardStats(req, res);

  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

// Run the test
testAnalyticsAPI();
