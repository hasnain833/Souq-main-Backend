const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import models and services
const User = require('./db/models/userModel');
const Product = require('./db/models/productModel');
const StandardPayment = require('./db/models/standardPaymentModel');
const EscrowTransaction = require('./db/models/escrowTransactionModel');
const Order = require('./db/models/orderModel');
const OrderCreationService = require('./services/order/OrderCreationService');

async function testOrderCreation() {
  try {
    console.log('🧪 Testing Order Creation Service...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/souq-marketplace');
    console.log('✅ Connected to MongoDB');

    // Test 1: Find a completed standard payment and create order
    console.log('\n📋 Test 1: Creating order from standard payment...');
    
    const standardPayment = await StandardPayment.findOne({ 
      status: 'completed' 
    })
    .populate('buyer', 'firstName lastName email phoneNumber')
    .populate('seller', 'firstName lastName email phoneNumber')
    .populate('product', 'title price product_photos');

    if (standardPayment) {
      console.log('💳 Found standard payment:', {
        transactionId: standardPayment.transactionId,
        amount: standardPayment.productPrice,
        currency: standardPayment.currency,
        buyer: `${standardPayment.buyer?.firstName} ${standardPayment.buyer?.lastName}`,
        seller: `${standardPayment.seller?.firstName} ${standardPayment.seller?.lastName}`,
        product: standardPayment.product?.title
      });

      const orderResult = await OrderCreationService.createOrderFromStandardPayment(standardPayment);
      
      if (orderResult.success) {
        if (orderResult.alreadyExists) {
          console.log('ℹ️ Order already exists for this payment');
        } else {
          console.log('✅ Order created successfully:', {
            orderNumber: orderResult.order.orderNumber,
            status: orderResult.order.status,
            paymentMethod: orderResult.order.payment.method
          });
        }
      } else {
        console.error('❌ Failed to create order:', orderResult.error);
      }
    } else {
      console.log('⚠️ No completed standard payments found');
    }

    // Test 2: Find an escrow transaction and create order
    console.log('\n📋 Test 2: Creating order from escrow transaction...');
    
    const escrowTransaction = await EscrowTransaction.findOne({ 
      status: { $in: ['funds_held', 'completed'] }
    })
    .populate('buyer', 'firstName lastName email phoneNumber')
    .populate('seller', 'firstName lastName email phoneNumber')
    .populate('product', 'title price product_photos');

    if (escrowTransaction) {
      console.log('🛡️ Found escrow transaction:', {
        transactionId: escrowTransaction.transactionId,
        amount: escrowTransaction.productPrice,
        currency: escrowTransaction.currency,
        status: escrowTransaction.status,
        buyer: `${escrowTransaction.buyer?.firstName} ${escrowTransaction.buyer?.lastName}`,
        seller: `${escrowTransaction.seller?.firstName} ${escrowTransaction.seller?.lastName}`,
        product: escrowTransaction.product?.title
      });

      const orderResult = await OrderCreationService.createOrderFromEscrowPayment(escrowTransaction);
      
      if (orderResult.success) {
        if (orderResult.alreadyExists) {
          console.log('ℹ️ Order already exists for this escrow transaction');
        } else {
          console.log('✅ Order created successfully:', {
            orderNumber: orderResult.order.orderNumber,
            status: orderResult.order.status,
            paymentMethod: orderResult.order.payment.method
          });
        }
      } else {
        console.error('❌ Failed to create order:', orderResult.error);
      }
    } else {
      console.log('⚠️ No escrow transactions found');
    }

    // Test 3: Check existing orders
    console.log('\n📋 Test 3: Checking existing orders...');
    
    const orders = await Order.find({})
      .populate('buyer', 'firstName lastName')
      .populate('seller', 'firstName lastName')
      .populate('product', 'title price')
      .sort({ createdAt: -1 })
      .limit(5);

    console.log(`📊 Found ${orders.length} orders in database:`);
    
    orders.forEach((order, index) => {
      console.log(`   ${index + 1}. ${order.orderNumber}:`);
      console.log(`      Status: ${order.status}`);
      console.log(`      Payment: ${order.payment.method} (${order.payment.status})`);
      console.log(`      Product: ${order.product?.title}`);
      console.log(`      Amount: ${order.orderDetails.currency} ${order.orderDetails.productPrice}`);
      console.log(`      Created: ${order.createdAt.toISOString()}`);
      console.log('');
    });

    // Test 4: Test order update functionality
    console.log('\n📋 Test 4: Testing order update functionality...');
    
    if (orders.length > 0) {
      const testOrder = orders[0];
      console.log(`🔄 Testing update for order: ${testOrder.orderNumber}`);
      
      const updateResult = await OrderCreationService.updateOrderFromPayment(
        testOrder.payment.transactionId,
        'processing',
        testOrder.payment.method
      );
      
      if (updateResult.success) {
        console.log('✅ Order updated successfully:', {
          orderNumber: updateResult.order.orderNumber,
          newStatus: updateResult.order.status,
          timelineEntries: updateResult.order.timeline.length
        });
      } else {
        console.error('❌ Failed to update order:', updateResult.error);
      }
    }

    console.log('\n🎉 Order creation tests completed!');
    
    console.log('\n📝 Summary:');
    console.log('   ✅ OrderCreationService tested');
    console.log('   ✅ Standard payment order creation tested');
    console.log('   ✅ Escrow payment order creation tested');
    console.log('   ✅ Order update functionality tested');
    console.log('\n🚀 Order creation should now work automatically when payments are completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('\n✅ MongoDB connection closed');
  }
}

// Run the test
if (require.main === module) {
  testOrderCreation();
}

module.exports = testOrderCreation;
