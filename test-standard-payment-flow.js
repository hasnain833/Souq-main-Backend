/**
 * Test script to verify the standard payment status flow
 * Tests: Payment → Shipped → Delivered → Completed
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const StandardPayment = require('./db/models/standardPaymentModel');
const User = require('./db/models/userModel');
const Product = require('./db/models/productModel');

// Test data
const testData = {
  buyer: {
    firstName: 'Test',
    lastName: 'Buyer',
    email: 'testbuyer@example.com',
    username: 'testbuyer',
    password: 'password123'
  },
  seller: {
    firstName: 'Test',
    lastName: 'Seller',
    email: 'testseller@example.com',
    username: 'testseller',
    password: 'password123'
  },
  product: {
    title: 'Test Product for Status Flow',
    description: 'A test product to verify status transitions',
    price: 100,
    category: 'Electronics',
    condition: 'new',
    product_photos: ['test-image.jpg']
  }
};

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/souq-test');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function createTestUsers() {
  console.log('\n📝 Creating test users...');
  
  // Create buyer
  let buyer = await User.findOne({ email: testData.buyer.email });
  if (!buyer) {
    buyer = new User(testData.buyer);
    await buyer.save();
    console.log('✅ Test buyer created:', buyer._id);
  } else {
    console.log('✅ Test buyer exists:', buyer._id);
  }
  
  // Create seller
  let seller = await User.findOne({ email: testData.seller.email });
  if (!seller) {
    seller = new User(testData.seller);
    await seller.save();
    console.log('✅ Test seller created:', seller._id);
  } else {
    console.log('✅ Test seller exists:', seller._id);
  }
  
  return { buyer, seller };
}

async function createTestProduct(seller) {
  console.log('\n📦 Creating test product...');
  
  let product = await Product.findOne({ title: testData.product.title });
  if (!product) {
    product = new Product({
      ...testData.product,
      seller: seller._id,
      location: {
        country: 'Test Country',
        city: 'Test City'
      }
    });
    await product.save();
    console.log('✅ Test product created:', product._id);
  } else {
    console.log('✅ Test product exists:', product._id);
  }
  
  return product;
}

async function createStandardPayment(buyer, seller, product) {
  console.log('\n💳 Creating standard payment...');
  
  const payment = new StandardPayment({
    transactionId: `STD-${Date.now()}-TEST`,
    buyer: buyer._id,
    seller: seller._id,
    product: product._id,
    productPrice: product.price,
    totalAmount: product.price,
    currency: 'USD',
    status: 'completed', // Simulate completed payment
    paymentGateway: 'stripe',
    gatewayTransactionId: `pi_test_${Date.now()}`,
    shippingAddress: {
      fullName: `${buyer.firstName} ${buyer.lastName}`,
      addressLine1: '123 Test Street',
      city: 'Test City',
      country: 'Test Country',
      postalCode: '12345'
    }
  });
  
  await payment.save();
  console.log('✅ Standard payment created:', payment._id);
  console.log('   Transaction ID:', payment.transactionId);
  console.log('   Payment Status:', payment.status);
  console.log('   Order Status:', payment.orderStatus || 'undefined (defaults to paid)');
  
  return payment;
}

async function testStatusTransitions(paymentId) {
  console.log('\n🔄 Testing status transitions...');
  
  const validTransitions = {
    'pending_payment': ['paid', 'cancelled'],
    'paid': ['processing', 'shipped', 'cancelled'],
    'processing': ['shipped', 'cancelled'],
    'shipped': ['in_transit', 'delivered'],
    'in_transit': ['out_for_delivery', 'delivered'],
    'out_for_delivery': ['delivered'],
    'delivered': ['completed', 'returned'],
    'completed': [],
    'cancelled': [],
    'returned': [],
    'refunded': []
  };
  
  // Test the flow: paid → shipped → delivered → completed
  const testFlow = [
    { from: 'paid', to: 'shipped', description: 'Seller marks as shipped' },
    { from: 'shipped', to: 'delivered', description: 'Seller marks as delivered' },
    { from: 'delivered', to: 'completed', description: 'Transaction completed' }
  ];
  
  let payment = await StandardPayment.findById(paymentId);
  let currentStatus = payment.orderStatus || 'paid'; // Default to paid if no orderStatus
  
  console.log(`📊 Starting status: ${currentStatus}`);
  
  for (const transition of testFlow) {
    console.log(`\n🔄 Testing transition: ${transition.from} → ${transition.to}`);
    console.log(`   Description: ${transition.description}`);
    
    // Check if current status matches expected
    if (currentStatus !== transition.from) {
      console.log(`❌ Status mismatch. Expected: ${transition.from}, Actual: ${currentStatus}`);
      continue;
    }
    
    // Check if transition is valid
    if (!validTransitions[currentStatus]?.includes(transition.to)) {
      console.log(`❌ Invalid transition from ${currentStatus} to ${transition.to}`);
      console.log(`   Valid transitions: ${validTransitions[currentStatus]?.join(', ') || 'none'}`);
      continue;
    }
    
    // Simulate the status update
    try {
      payment.orderStatus = transition.to;
      payment.statusHistory = payment.statusHistory || [];
      payment.statusHistory.push({
        status: transition.to,
        timestamp: new Date(),
        description: transition.description,
        updatedBy: 'test-script'
      });
      
      await payment.save();
      currentStatus = transition.to;
      
      console.log(`✅ Successfully transitioned to: ${transition.to}`);
    } catch (error) {
      console.log(`❌ Error updating status: ${error.message}`);
    }
  }
  
  console.log(`\n🎉 Final status: ${currentStatus}`);
  
  // Verify final payment state
  const finalPayment = await StandardPayment.findById(paymentId);
  console.log('\n📋 Final payment state:');
  console.log('   Payment Status:', finalPayment.status);
  console.log('   Order Status:', finalPayment.orderStatus);
  console.log('   Status History:', finalPayment.statusHistory?.length || 0, 'entries');
  
  return finalPayment;
}

async function cleanup() {
  console.log('\n🧹 Cleaning up test data...');
  
  try {
    await StandardPayment.deleteMany({ transactionId: { $regex: /STD-.*-TEST/ } });
    await Product.deleteMany({ title: testData.product.title });
    await User.deleteMany({ 
      $or: [
        { email: testData.buyer.email },
        { email: testData.seller.email }
      ]
    });
    console.log('✅ Test data cleaned up');
  } catch (error) {
    console.log('❌ Error cleaning up:', error.message);
  }
}

async function runTest() {
  console.log('🚀 Starting Standard Payment Status Flow Test\n');
  
  try {
    await connectDB();
    
    // Create test data
    const { buyer, seller } = await createTestUsers();
    const product = await createTestProduct(seller);
    const payment = await createStandardPayment(buyer, seller, product);
    
    // Test status transitions
    await testStatusTransitions(payment._id);
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    // Uncomment the next line if you want to clean up test data
    // await cleanup();
    
    await mongoose.connection.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run the test
if (require.main === module) {
  runTest();
}

module.exports = { runTest };
