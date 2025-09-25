const mongoose = require('mongoose');
const Transaction = require('./db/models/transactionModel');
const StandardPayment = require('./db/models/standardPaymentModel');
const Order = require('./db/models/orderModel');
require('dotenv').config();

async function testOrderStatusUpdate() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Test order ID from the error
    const orderId = '68650cd0e14b7e0bfd244bc2';
    
    console.log('🔍 Searching for order:', orderId);
    
    // Check if it's a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      console.log('❌ Invalid ObjectId format');
      return;
    }

    // Try to find in Order collection
    let order = await Order.findById(orderId);
    if (order) {
      console.log('✅ Found in Order collection:', {
        id: order._id,
        status: order.status,
        buyer: order.buyer,
        seller: order.seller
      });
      return;
    }

    // Try to find in Transaction collection
    order = await Transaction.findById(orderId);
    if (order) {
      console.log('✅ Found in Transaction collection:', {
        id: order._id,
        status: order.status,
        orderStatus: order.orderStatus,
        buyer: order.buyer,
        seller: order.seller
      });
      return;
    }

    // Try to find in StandardPayment collection
    order = await StandardPayment.findById(orderId);
    if (order) {
      console.log('✅ Found in StandardPayment collection:', {
        id: order._id,
        status: order.status,
        orderStatus: order.orderStatus,
        buyer: order.buyer,
        seller: order.seller
      });
      return;
    }

    console.log('❌ Order not found in any collection');

    // List some recent orders from each collection for debugging
    console.log('\n📋 Recent orders from each collection:');
    
    const recentOrders = await Order.find().limit(3).select('_id status buyer seller');
    console.log('Order collection:', recentOrders);

    const recentTransactions = await Transaction.find().limit(3).select('_id status orderStatus buyer seller');
    console.log('Transaction collection:', recentTransactions);

    const recentPayments = await StandardPayment.find().limit(3).select('_id status orderStatus buyer seller');
    console.log('StandardPayment collection:', recentPayments);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

testOrderStatusUpdate();
