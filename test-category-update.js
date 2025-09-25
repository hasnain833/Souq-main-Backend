/**
 * Test script to verify category update functionality
 */

require('dotenv').config();
const axios = require('axios');

const BASE_URL = 'http://localhost:5001/api/admin';

async function testCategoryUpdate() {
  console.log('🧪 Testing Category Update...\n');

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

    // Step 2: Get categories to find one to update
    console.log('\n2️⃣ Fetching categories...');
    const categoriesResponse = await axios.get(`${BASE_URL}/categories`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!categoriesResponse.data.categories || categoriesResponse.data.categories.length === 0) {
      console.log('❌ No categories found');
      return;
    }

    const firstCategory = categoriesResponse.data.categories[0];
    console.log(`✅ Found category: ${firstCategory.name} (ID: ${firstCategory._id})`);

    // Step 3: Test update with frontend format
    console.log('\n3️⃣ Testing category update...');
    const updateData = {
      category: `${firstCategory.name} - Updated`,  // Using 'category' field like frontend
      subcategories: ['Test Subcategory 1', 'Test Subcategory 2'],
      isSubCategories: true
    };

    console.log('Update payload:', JSON.stringify(updateData, null, 2));

    const updateResponse = await axios.put(`${BASE_URL}/categories/${firstCategory._id}`, updateData, {
      headers: { 
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (updateResponse.data.message) {
      console.log('✅ Category update successful');
      console.log('Updated category:', updateResponse.data.category.name);
    } else {
      console.log('❌ Category update failed:', updateResponse.data);
    }

    // Step 4: Verify the update
    console.log('\n4️⃣ Verifying update...');
    const verifyResponse = await axios.get(`${BASE_URL}/categories/${firstCategory._id}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (verifyResponse.data.category) {
      console.log('✅ Verification successful');
      console.log(`Category name: ${verifyResponse.data.category.name}`);
      console.log(`Subcategories: ${verifyResponse.data.category.subCategories?.length || 0}`);
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
testCategoryUpdate();
