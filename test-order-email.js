// test-order-email.js
// Script to test order shipped email functionality

require('dotenv').config();
const mongoose = require('mongoose');
const OrderEmailService = require('./services/OrderEmailService');

// Mock data for testing
const mockOrder = {
  _id: '507f1f77bcf86cd799439011',
  orderNumber: 'ORD-TEST-001',
  transactionId: 'TXN-TEST-001'
};

const mockBuyer = {
  _id: '507f1f77bcf86cd799439012',
  email: 'buyer@example.com',
  firstName: 'John',
  lastName: 'Doe',
  userName: 'johndoe'
};

const mockSeller = {
  _id: '507f1f77bcf86cd799439013',
  email: 'seller@example.com',
  firstName: 'Jane',
  lastName: 'Smith',
  userName: 'janesmith'
};

const mockProduct = {
  _id: '507f1f77bcf86cd799439014',
  title: 'Vintage Leather Jacket',
  price: 150
};

const mockShippingDetails = {
  trackingNumber: 'TRK123456789',
  provider: 'fedex',
  carrier: 'FedEx',
  estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
};

async function testOrderEmail() {
  console.log('🧪 Testing Order Shipped Email Functionality...');
  console.log('');
  
  console.log('📧 Email Configuration Check:');
  console.log('EMAIL_USER:', process.env.EMAIL_USER || 'Not set');
  console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? 'Set (hidden)' : 'Not set');
  console.log('DISABLE_EMAIL:', process.env.DISABLE_EMAIL);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('');

  console.log('📦 Mock Order Data:');
  console.log('Order:', mockOrder);
  console.log('Buyer:', mockBuyer);
  console.log('Seller:', mockSeller);
  console.log('Product:', mockProduct);
  console.log('Shipping Details:', mockShippingDetails);
  console.log('');

  try {
    console.log('📧 Attempting to send order shipped email...');
    
    const result = await OrderEmailService.sendOrderShippedEmail(
      mockOrder,
      mockBuyer,
      mockSeller,
      mockProduct,
      mockShippingDetails
    );

    console.log('');
    console.log('📊 Email Send Result:');
    console.log('Success:', result.success);
    console.log('Message ID:', result.messageId);
    console.log('Simulated:', result.simulated || false);
    console.log('Error:', result.error || 'None');

    if (result.success) {
      if (result.simulated) {
        console.log('');
        console.log('⚠️ EMAIL WAS SIMULATED (NOT ACTUALLY SENT)');
        console.log('To enable real email sending:');
        console.log('1. Copy .env.example to .env');
        console.log('2. Set EMAIL_USER to your Gmail address');
        console.log('3. Set EMAIL_PASS to your Gmail App Password');
        console.log('4. Set DISABLE_EMAIL=false (or remove this line)');
        console.log('');
        console.log('📝 How to get Gmail App Password:');
        console.log('1. Go to your Google Account settings');
        console.log('2. Enable 2-Factor Authentication if not already enabled');
        console.log('3. Go to Security > App Passwords');
        console.log('4. Generate an app password for this application');
        console.log('5. Use that app password (not your regular password)');
      } else {
        console.log('');
        console.log('✅ EMAIL SENT SUCCESSFULLY!');
        console.log('Check the recipient email inbox.');
      }
    } else {
      console.log('');
      console.log('❌ EMAIL FAILED TO SEND');
      console.log('Error:', result.error);
    }

  } catch (error) {
    console.error('');
    console.error('❌ Test failed with error:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testOrderEmail().catch(console.error);