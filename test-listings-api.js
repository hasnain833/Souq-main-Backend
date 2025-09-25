const mongoose = require('mongoose');
require('dotenv').config();

async function testListingsAPI() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Import the listings controller
    const listingController = require('./app/admin/listings/controllers/listingManagementController');

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

    console.log('\n🔍 Testing Get All Listings API...');
    const listingsReq = { 
      query: { 
        page: 1, 
        limit: 10,
        search: '',
        status: 'all',
        category: '',
        sortBy: 'createdAt',
        sortOrder: 'desc'
      } 
    };
    await listingController.getAllListings(listingsReq, createMockResponse('Get All Listings'));

    console.log('\n🔍 Testing Get Listing Stats API...');
    const statsReq = { query: {} };
    await listingController.getListingStats(statsReq, createMockResponse('Listing Stats'));

    // Test with filters
    console.log('\n🔍 Testing Filtered Listings (active status)...');
    const filteredReq = { 
      query: { 
        page: 1, 
        limit: 10,
        status: 'active'
      } 
    };
    await listingController.getAllListings(filteredReq, createMockResponse('Filtered Listings'));

  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

// Run the test
testListingsAPI();
