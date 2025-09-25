/**
 * Test script to check listing detail API response
 */

require('dotenv').config();
const axios = require('axios');

const BASE_URL = 'http://localhost:5001/api/admin';
const LISTING_ID = '68625b7c5b0a29903478efad'; // From the URL in the screenshot

async function testListingDetail() {
  console.log('🧪 Testing Listing Detail API...\n');

  try {
    // Step 1: Login to get admin token
    console.log('1️⃣ Logging in as admin...');
    const loginData = {
      email: 'test@admin.com',
      password: 'admin123'
    };

    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, loginData);
    
    if (!loginResponse.data.success) {
      console.log('❌ Login failed:', loginResponse.data.message);
      return;
    }

    const { accessToken } = loginResponse.data.data;
    console.log('✅ Login successful');

    // Step 2: Get listing detail
    console.log(`\n2️⃣ Fetching listing detail for ID: ${LISTING_ID}...`);
    const listingResponse = await axios.get(`${BASE_URL}/listings/${LISTING_ID}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (listingResponse.data.success) {
      console.log('✅ Listing detail fetched successfully');
      
      const listing = listingResponse.data.data.listing;
      
      console.log('\n📊 Listing Information:');
      console.log(`Title: ${listing.title}`);
      console.log(`Price: $${listing.price}`);
      console.log(`Status: ${listing.status}`);
      console.log(`ID: ${listing._id}`);
      
      console.log('\n🖼️ Image Information:');
      console.log(`product_photos field:`, listing.product_photos);
      console.log(`photos field:`, listing.photos);
      console.log(`images field:`, listing.images);
      console.log(`product_photos length:`, listing.product_photos?.length || 0);
      
      if (listing.product_photos && listing.product_photos.length > 0) {
        console.log('\n📷 Individual Images:');
        listing.product_photos.forEach((photo, index) => {
          console.log(`  Image ${index + 1}: ${photo}`);
          const fullUrl = photo.startsWith('http') ? photo : `http://localhost:5000${photo}`;
          console.log(`  Full URL: ${fullUrl}`);
        });
      } else {
        console.log('❌ No images found in product_photos array');
      }
      
      console.log('\n🔍 Full Listing Object Keys:');
      console.log(Object.keys(listing));
      
      console.log('\n📝 Full Response:');
      console.log(JSON.stringify(listingResponse.data, null, 2));
      
    } else {
      console.log('❌ Failed to fetch listing:', listingResponse.data.message);
    }

  } catch (error) {
    console.log('❌ Test failed:', error.response?.data?.message || error.message);
    if (error.response?.status) {
      console.log(`HTTP Status: ${error.response.status}`);
    }
    if (error.response?.data) {
      console.log('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run the test
testListingDetail();
