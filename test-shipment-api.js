const mongoose = require('mongoose');
require('dotenv').config();

async function testShipmentAPI() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Import the shipping controller
    const controller = require('./app/admin/shipping/controllers/shippingManagementController');

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

    console.log('\n🔍 Testing Shipment Stats API...');
    const statsReq = { query: {} };
    await controller.getShipmentStats(statsReq, createMockResponse('Shipment Stats'));

    console.log('\n🔍 Testing Get All Shipments API...');
    const shipmentsReq = { query: { page: 1, limit: 10 } };
    await controller.getAllShipments(shipmentsReq, createMockResponse('All Shipments'));

  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

// Run the test
testShipmentAPI();
