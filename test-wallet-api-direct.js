const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

async function testWalletAPIDirectly() {
  try {
    console.log('🧪 Testing wallet API directly...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    // Import wallet controller
    const walletController = require('./app/user/wallet/controllers/walletController');
    console.log('✅ Wallet controller imported');
    
    // Create a mock request and response
    const mockReq = {
      body: {
        transactionId: 'ESC-1751528763981-2XEUZ498W',
        transactionType: 'escrow'
      },
      user: {
        _id: new mongoose.Types.ObjectId('68496f654c309a90fd9fbbe8') // Mock user ID
      }
    };
    
    const mockRes = {
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        this.responseData = data;
        return this;
      }
    };
    
    console.log('📋 Mock request:', JSON.stringify(mockReq.body, null, 2));
    console.log('👤 Mock user:', mockReq.user._id.toString());
    
    // Test the completePayment function directly
    console.log('🔄 Calling completePayment function...');
    await walletController.completePayment(mockReq, mockRes);
    
    console.log('📊 Response status:', mockRes.statusCode);
    console.log('📊 Response data:', JSON.stringify(mockRes.responseData, null, 2));
    
    if (mockRes.statusCode === 200) {
      console.log('✅ API call successful!');
    } else {
      console.log('❌ API call failed with status:', mockRes.statusCode);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('🔌 Disconnected from MongoDB');
    }
  }
}

// Run the test
testWalletAPIDirectly();
