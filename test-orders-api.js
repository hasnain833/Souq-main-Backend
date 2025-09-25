const mongoose = require('mongoose');
require('dotenv').config();

async function testOrdersAPI() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const Transaction = require('./db/models/transactionModel');
    const StandardPayment = require('./db/models/standardPaymentModel');
    
    // Simulate the Orders API query for a specific user
    // You'll need to replace this with a real user ID from your database
    const User = require('./db/models/userModel');
    const users = await User.find({}).limit(1);
    
    if (users.length === 0) {
      console.log('❌ No users found in database');
      return;
    }
    
    const userId = users[0]._id;
    console.log(`🔍 Testing orders API for user: ${userId} (${users[0].firstName} ${users[0].lastName})`);
    
    // Test buyer role query
    const buyerQuery = { buyer: userId };
    const sellerQuery = { seller: userId };
    
    console.log('\n📋 Testing buyer orders...');
    const [buyerTransactions, buyerStandardPayments] = await Promise.all([
      Transaction.find(buyerQuery)
        .populate('product', 'title price')
        .populate('buyer', 'username firstName lastName')
        .populate('seller', 'username firstName lastName')
        .sort({ createdAt: -1 })
        .limit(10),
      StandardPayment.find(buyerQuery)
        .populate('product', 'title price')
        .populate('buyer', 'username firstName lastName')
        .populate('seller', 'username firstName lastName')
        .sort({ createdAt: -1 })
        .limit(10)
    ]);
    
    console.log(`Found ${buyerTransactions.length} buyer transactions`);
    console.log(`Found ${buyerStandardPayments.length} buyer standard payments`);
    
    // Show the actual orders that would be returned
    const combinedOrders = [];
    
    buyerTransactions.forEach(transaction => {
      combinedOrders.push({
        _id: transaction._id,
        orderNumber: transaction.transactionId,
        type: 'escrow',
        status: transaction.status,
        buyer: transaction.buyer?.firstName,
        seller: transaction.seller?.firstName,
        product: transaction.product?.title,
        createdAt: transaction.createdAt
      });
    });
    
    buyerStandardPayments.forEach(payment => {
      combinedOrders.push({
        _id: payment._id,
        orderNumber: payment.transactionId,
        type: 'standard',
        status: payment.status,
        buyer: payment.buyer?.firstName,
        seller: payment.seller?.firstName,
        product: payment.product?.title,
        createdAt: payment.createdAt
      });
    });
    
    combinedOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    console.log('\n📦 Combined orders that would be returned:');
    combinedOrders.forEach((order, index) => {
      console.log(`  ${index + 1}. Order:`, {
        _id: order._id.toString(),
        orderNumber: order.orderNumber,
        type: order.type,
        status: order.status,
        buyer: order.buyer,
        seller: order.seller,
        product: order.product
      });
    });
    
    // Test if any of these orders would work with transaction APIs
    if (combinedOrders.length > 0) {
      const testOrder = combinedOrders[0];
      console.log(`\n🧪 Testing transaction API with order ID: ${testOrder._id}`);
      
      // Try to find this transaction using our enhanced lookup
      const { findStandardPayment, findEscrowTransaction } = require('./utils/transactionUtils');
      
      let foundTransaction = null;
      if (testOrder.type === 'escrow') {
        foundTransaction = await findEscrowTransaction(testOrder._id.toString(), true);
      } else {
        foundTransaction = await findStandardPayment(testOrder._id.toString(), true);
      }
      
      if (foundTransaction) {
        console.log('✅ Transaction API would work with this order:', {
          _id: foundTransaction._id,
          transactionId: foundTransaction.transactionId,
          status: foundTransaction.status
        });
      } else {
        console.log('❌ Transaction API would fail with this order');
      }
    }

  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

testOrdersAPI();
