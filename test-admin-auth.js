/**
 * Test script to verify admin authentication is working
 */

require('dotenv').config();
const axios = require('axios');

const BASE_URL = 'http://localhost:5001/api/admin';

async function testAdminAuth() {
  console.log('🧪 Testing Admin Authentication...\n');

  try {
    // Step 1: Test admin signup
    console.log('1️⃣ Testing Admin Signup...');
    const signupData = {
      firstName: 'Test',
      lastName: 'Admin',
      email: 'test@admin.com',
      password: 'admin123',
      role: 'super_admin'
    };

    let signupResponse;
    try {
      signupResponse = await axios.post(`${BASE_URL}/auth/signup`, signupData);
      console.log('✅ Signup successful');
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.message?.includes('already exists')) {
        console.log('ℹ️ Admin already exists, proceeding to login...');
      } else {
        console.log('❌ Signup failed:', error.response?.data?.message || error.message);
        return;
      }
    }

    // Step 2: Test admin login
    console.log('\n2️⃣ Testing Admin Login...');
    const loginData = {
      email: 'test@admin.com',
      password: 'admin123'
    };

    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, loginData);
    
    if (loginResponse.data.success) {
      console.log('✅ Login successful');
      const { accessToken, admin } = loginResponse.data.data;
      console.log(`👤 Admin: ${admin.firstName} ${admin.lastName} (${admin.email})`);
      
      // Step 3: Test profile endpoint
      console.log('\n3️⃣ Testing Profile Endpoint...');
      const profileResponse = await axios.get(`${BASE_URL}/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (profileResponse.data.success) {
        console.log('✅ Profile endpoint working');
        console.log(`👤 Profile: ${profileResponse.data.data.admin.firstName} ${profileResponse.data.data.admin.lastName}`);
      } else {
        console.log('❌ Profile endpoint failed:', profileResponse.data.message);
      }

    } else {
      console.log('❌ Login failed:', loginResponse.data.message);
    }

  } catch (error) {
    console.log('❌ Test failed:', error.response?.data?.message || error.message);
    if (error.response?.data) {
      console.log('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run the test
testAdminAuth();
