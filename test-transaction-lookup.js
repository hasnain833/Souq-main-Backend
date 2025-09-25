const mongoose = require('mongoose');
require('dotenv').config();

// Import the transaction utils
const { findStandardPayment, findEscrowTransaction } = require('./utils/transactionUtils');

async function testTransactionLookup() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Test transaction ID from your error
    const testTransactionId = 'TXN_1752219471023_U4Z6ZU';
    
    console.log(`\n🔍 Testing transaction lookup for: ${testTransactionId}`);
    
    // Try escrow first
    console.log('\n📋 Trying escrow transaction lookup...');
    const escrowTransaction = await findEscrowTransaction(testTransactionId, true);
    if (escrowTransaction) {
      console.log('✅ Found escrow transaction:', {
        id: escrowTransaction._id,
        transactionId: escrowTransaction.transactionId,
        status: escrowTransaction.status,
        buyer: escrowTransaction.buyer?.firstName,
        seller: escrowTransaction.seller?.firstName
      });
    } else {
      console.log('❌ No escrow transaction found');
    }

    // Try standard payment
    console.log('\n💳 Trying standard payment lookup...');
    const standardPayment = await findStandardPayment(testTransactionId, true);
    if (standardPayment) {
      console.log('✅ Found standard payment:', {
        id: standardPayment._id,
        transactionId: standardPayment.transactionId,
        status: standardPayment.status,
        buyer: standardPayment.buyer?.firstName,
        seller: standardPayment.seller?.firstName
      });
    } else {
      console.log('❌ No standard payment found');
    }

    // Also try to find the order directly
    console.log('\n📦 Trying order lookup...');
    const Order = require('./db/models/orderModel');
    const order = await Order.findOne({ orderNumber: testTransactionId })
      .populate('buyer', 'firstName lastName')
      .populate('seller', 'firstName lastName');
    
    if (order) {
      console.log('✅ Found order:', {
        id: order._id,
        orderNumber: order.orderNumber,
        type: order.type,
        status: order.status,
        payment: order.payment,
        buyer: order.buyer?.firstName,
        seller: order.seller?.firstName
      });
    } else {
      console.log('❌ No order found with orderNumber');
    }

    // Try to find order by _id (the one used in the URL)
    const orderId = '6870bf4fbb4e9dc55c303a80'; // From your URL
    console.log(`\n📦 Trying order lookup by _id: ${orderId}`);
    const orderById = await Order.findById(orderId)
      .populate('buyer', 'firstName lastName')
      .populate('seller', 'firstName lastName');
    
    if (orderById) {
      console.log('✅ Found order by _id:', {
        id: orderById._id,
        orderNumber: orderById.orderNumber,
        type: orderById.type,
        status: orderById.status,
        payment: orderById.payment,
        buyer: orderById.buyer?.firstName,
        seller: orderById.seller?.firstName
      });

      // If this order has a payment ID, try to find the standard payment
      if (orderById.payment?.paymentId) {
        console.log(`\n💳 Trying to find standard payment by paymentId: ${orderById.payment.paymentId}`);
        const paymentByPaymentId = await findStandardPayment(orderById.payment.paymentId, true);
        if (paymentByPaymentId) {
          console.log('✅ Found standard payment by paymentId:', {
            id: paymentByPaymentId._id,
            transactionId: paymentByPaymentId.transactionId,
            status: paymentByPaymentId.status
          });
        } else {
          console.log('❌ No standard payment found by paymentId');
        }
      }
    } else {
      console.log('❌ No order found by _id');
    }

  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

testTransactionLookup();
