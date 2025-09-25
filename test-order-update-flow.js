// test-order-update-flow.js
// Test script to debug the order update and email flow

require('dotenv').config();
const mongoose = require('mongoose');
const OrderEmailService = require('./services/OrderEmailService');

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/souq');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
}

// Test the email service with realistic data structure
async function testEmailService() {
  console.log('🧪 Testing Order Email Service with realistic data...\n');
  
  // Simulate data structure as it would come from the database
  const mockOrderData = {
    _id: new mongoose.Types.ObjectId(),
    transactionId: 'TXN-2025-001234',
    orderNumber: 'ORD-2025-001234'
  };

  const mockBuyer = {
    _id: new mongoose.Types.ObjectId(),
    firstName: 'John',
    lastName: 'Doe',
    userName: 'johndoe',
    email: 'john.doe@example.com'
  };

  const mockSeller = {
    _id: new mongoose.Types.ObjectId(),
    firstName: 'Jane',
    lastName: 'Smith',
    userName: 'janesmith',
    email: 'jane.smith@example.com'
  };

  const mockProduct = {
    _id: new mongoose.Types.ObjectId(),
    title: 'Vintage Leather Jacket - Brown',
    price: 150.00
  };

  const mockShippingDetails = {
    trackingNumber: 'TRK123456789',
    provider: 'aramex',
    carrier: 'Aramex',
    estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  };

  try {
    console.log('📧 Calling OrderEmailService.sendOrderShippedEmail...');
    
    const result = await OrderEmailService.sendOrderShippedEmail(
      mockOrderData,
      mockBuyer,
      mockSeller,
      mockProduct,
      mockShippingDetails
    );
    
    console.log('\n✅ Email service test completed!');
    console.log('📊 Result:', result);
    
    if (result.success) {
      console.log('🎉 Email service is working correctly!');
      if (result.simulated) {
        console.log('⚠️  Email was simulated (development mode)');
      } else {
        console.log('📬 Real email was sent');
      }
    } else {
      console.log('❌ Email service failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Email service test failed:', error);
  }
}

// Test with missing data to see error handling
async function testEmailServiceWithMissingData() {
  console.log('\n🧪 Testing with missing buyer email...\n');
  
  const mockOrderData = {
    _id: new mongoose.Types.ObjectId(),
    transactionId: 'TXN-2025-001235'
  };

  const mockBuyerNoEmail = {
    _id: new mongoose.Types.ObjectId(),
    firstName: 'John',
    userName: 'johndoe'
    // Missing email field
  };

  const mockSeller = {
    _id: new mongoose.Types.ObjectId(),
    firstName: 'Jane',
    userName: 'janesmith',
    email: 'jane.smith@example.com'
  };

  const mockProduct = {
    _id: new mongoose.Types.ObjectId(),
    title: 'Test Product'
  };

  try {
    const result = await OrderEmailService.sendOrderShippedEmail(
      mockOrderData,
      mockBuyerNoEmail,
      mockSeller,
      mockProduct,
      {}
    );
    
    console.log('📊 Missing email test result:', result);
    
    if (!result.success && result.error.includes('email')) {
      console.log('✅ Error handling is working correctly for missing email');
    } else {
      console.log('❌ Error handling may not be working as expected');
    }
    
  } catch (error) {
    console.error('❌ Missing email test failed:', error);
  }
}

// Run all tests
async function runTests() {
  console.log('🚀 Starting Order Update Flow Tests...\n');
  
  await connectDB();
  
  // Test normal flow
  await testEmailService();
  
  // Test error handling
  await testEmailServiceWithMissingData();
  
  console.log('\n🏁 All tests completed!');
  
  // Close database connection
  await mongoose.connection.close();
  console.log('✅ Database connection closed');
}

// Execute tests
runTests().catch(console.error);