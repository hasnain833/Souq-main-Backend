// test-order-api-endpoint.js
// Test script to verify the order update API endpoint is working

require('dotenv').config();
const mongoose = require('mongoose');
const Transaction = require('./db/models/transactionModel');
const StandardPayment = require('./db/models/standardPaymentModel');
const User = require('./db/models/userModel');
const Product = require('./db/models/productModel');

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

// Find a real order that can be tested
async function findTestOrder() {
  console.log('🔍 Looking for a test order...');
  
  // Try to find a completed standard payment that can be marked as shipped
  const standardPayment = await StandardPayment.findOne({
    status: 'completed',
    orderStatus: { $in: [null, 'paid'] }
  })
  .populate('buyer', 'userName firstName lastName email')
  .populate('seller', 'userName firstName lastName email')
  .populate('product', 'title price');
  
  if (standardPayment) {
    console.log('✅ Found standard payment order:', {
      id: standardPayment._id,
      transactionId: standardPayment.transactionId,
      status: standardPayment.status,
      orderStatus: standardPayment.orderStatus,
      buyer: standardPayment.buyer?.email,
      seller: standardPayment.seller?.email,
      product: standardPayment.product?.title
    });
    return { order: standardPayment, type: 'standard' };
  }
  
  // Try to find a completed transaction that can be marked as shipped
  const transaction = await Transaction.findOne({
    status: 'completed',
    orderStatus: { $in: [null, 'paid'] }
  })
  .populate('buyer', 'userName firstName lastName email')
  .populate('seller', 'userName firstName lastName email')
  .populate('product', 'title price');
  
  if (transaction) {
    console.log('✅ Found transaction order:', {
      id: transaction._id,
      transactionId: transaction.transactionId,
      status: transaction.status,
      orderStatus: transaction.orderStatus,
      buyer: transaction.buyer?.email,
      seller: transaction.seller?.email,
      product: transaction.product?.title
    });
    return { order: transaction, type: 'transaction' };
  }
  
  console.log('❌ No suitable test orders found');
  return null;
}

// Test the order controller directly
async function testOrderController() {
  console.log('🧪 Testing Order Controller directly...\n');
  
  const testData = await findTestOrder();
  if (!testData) {
    console.log('⚠️ No test order found, creating mock data for testing...');
    return;
  }
  
  const { order, type } = testData;
  
  // Import the order controller
  const orderController = require('./app/user/shipping/controllers/orderController');
  
  // Create mock request and response objects
  const mockReq = {
    params: { orderId: order._id.toString() },
    body: {
      status: 'shipped',
      notes: 'Test shipment from API test',
      shippingDetails: {
        trackingNumber: 'TEST123456789',
        provider: 'aramex',
        estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      }
    },
    user: { _id: order.seller._id } // Simulate seller making the request
  };
  
  const mockRes = {
    json: (data) => {
      console.log('📤 Response:', JSON.stringify(data, null, 2));
      return mockRes;
    },
    status: (code) => {
      console.log('📊 Status Code:', code);
      return mockRes;
    }
  };
  
  try {
    console.log('🚀 Calling updateOrderStatus...');
    console.log('📝 Request data:', {
      orderId: mockReq.params.orderId,
      status: mockReq.body.status,
      shippingDetails: mockReq.body.shippingDetails,
      sellerId: mockReq.user._id.toString()
    });
    
    await orderController.updateOrderStatus(mockReq, mockRes);
    
  } catch (error) {
    console.error('❌ Order controller test failed:', error);
    console.error('❌ Error stack:', error.stack);
  }
}

// Run the test
async function runTest() {
  console.log('🚀 Starting Order API Endpoint Test...\n');
  
  await connectDB();
  await testOrderController();
  
  console.log('\n🏁 Test completed!');
  
  // Close database connection
  await mongoose.connection.close();
  console.log('✅ Database connection closed');
}

// Execute test
runTest().catch(console.error);