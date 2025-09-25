const mongoose = require('mongoose');
require('dotenv').config();

async function debugOrderStructure() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const Order = require('./db/models/orderModel');
    const StandardPayment = require('./db/models/standardPaymentModel');
    
    // Find the specific order
    const orderId = '6870bf4fbb4e9dc55c303a80';
    const orderNumber = 'TXN_1752219471023_U4Z6ZU';
    
    console.log(`\n🔍 Looking for order with _id: ${orderId}`);
    const orderById = await Order.findById(orderId)
      .populate('buyer', 'firstName lastName email')
      .populate('seller', 'firstName lastName email')
      .populate('product', 'title price');
    
    if (orderById) {
      console.log('✅ Found order by _id:', {
        _id: orderById._id,
        orderNumber: orderById.orderNumber,
        type: orderById.type,
        status: orderById.status,
        payment: orderById.payment,
        buyer: orderById.buyer?.firstName,
        seller: orderById.seller?.firstName,
        product: orderById.product?.title
      });
      
      // If this order has payment info, try to find the standard payment
      if (orderById.payment?.paymentId) {
        console.log(`\n💳 Looking for standard payment with _id: ${orderById.payment.paymentId}`);
        const payment = await StandardPayment.findById(orderById.payment.paymentId)
          .populate('buyer', 'firstName lastName')
          .populate('seller', 'firstName lastName');
        
        if (payment) {
          console.log('✅ Found standard payment:', {
            _id: payment._id,
            transactionId: payment.transactionId,
            status: payment.status,
            amount: payment.amount,
            buyer: payment.buyer?.firstName,
            seller: payment.seller?.firstName
          });
        } else {
          console.log('❌ Standard payment not found by paymentId');
        }
      }
      
      if (orderById.payment?.transactionId) {
        console.log(`\n💳 Looking for standard payment with transactionId: ${orderById.payment.transactionId}`);
        const payment = await StandardPayment.findOne({ transactionId: orderById.payment.transactionId })
          .populate('buyer', 'firstName lastName')
          .populate('seller', 'firstName lastName');
        
        if (payment) {
          console.log('✅ Found standard payment by transactionId:', {
            _id: payment._id,
            transactionId: payment.transactionId,
            status: payment.status,
            amount: payment.amount,
            buyer: payment.buyer?.firstName,
            seller: payment.seller?.firstName
          });
        } else {
          console.log('❌ Standard payment not found by transactionId');
        }
      }
    } else {
      console.log('❌ Order not found by _id');
    }
    
    console.log(`\n🔍 Looking for order with orderNumber: ${orderNumber}`);
    const orderByNumber = await Order.findOne({ orderNumber })
      .populate('buyer', 'firstName lastName email')
      .populate('seller', 'firstName lastName email')
      .populate('product', 'title price');
    
    if (orderByNumber) {
      console.log('✅ Found order by orderNumber:', {
        _id: orderByNumber._id,
        orderNumber: orderByNumber.orderNumber,
        type: orderByNumber.type,
        status: orderByNumber.status,
        payment: orderByNumber.payment,
        buyer: orderByNumber.buyer?.firstName,
        seller: orderByNumber.seller?.firstName
      });
    } else {
      console.log('❌ Order not found by orderNumber');
    }
    
    // Also search for any standard payments that might match
    console.log(`\n💳 Searching all standard payments for any matches...`);
    const allPayments = await StandardPayment.find({
      $or: [
        { transactionId: orderNumber },
        { transactionId: orderId },
        { gatewayTransactionId: orderNumber },
        { gatewayTransactionId: orderId }
      ]
    }).populate('buyer', 'firstName lastName').populate('seller', 'firstName lastName');
    
    if (allPayments.length > 0) {
      console.log(`✅ Found ${allPayments.length} matching standard payments:`);
      allPayments.forEach((payment, index) => {
        console.log(`  ${index + 1}. Payment:`, {
          _id: payment._id,
          transactionId: payment.transactionId,
          gatewayTransactionId: payment.gatewayTransactionId,
          status: payment.status,
          amount: payment.amount,
          buyer: payment.buyer?.firstName,
          seller: payment.seller?.firstName
        });
      });
    } else {
      console.log('❌ No matching standard payments found');
    }

    // Let's see what orders actually exist
    console.log(`\n📋 Checking what orders exist in the database...`);
    const allOrders = await Order.find({}).limit(10).sort({ createdAt: -1 });
    console.log(`Found ${allOrders.length} orders:`);
    allOrders.forEach((order, index) => {
      console.log(`  ${index + 1}. Order:`, {
        _id: order._id,
        orderNumber: order.orderNumber,
        type: order.type,
        status: order.status,
        payment: order.payment,
        createdAt: order.createdAt
      });
    });

    // Also check standard payments
    console.log(`\n💳 Checking what standard payments exist...`);
    const allStandardPayments = await StandardPayment.find({}).limit(10).sort({ createdAt: -1 });
    console.log(`Found ${allStandardPayments.length} standard payments:`);
    allStandardPayments.forEach((payment, index) => {
      console.log(`  ${index + 1}. Payment:`, {
        _id: payment._id,
        transactionId: payment.transactionId,
        gatewayTransactionId: payment.gatewayTransactionId,
        status: payment.status,
        amount: payment.amount,
        createdAt: payment.createdAt
      });
    });

    // Check if the specific order ID exists as a standard payment
    console.log(`\n🎯 Checking if ${orderId} exists as a standard payment...`);
    const specificPayment = await StandardPayment.findById(orderId)
      .populate('buyer', 'firstName lastName')
      .populate('seller', 'firstName lastName');

    if (specificPayment) {
      console.log('✅ Found standard payment with this ID:', {
        _id: specificPayment._id,
        transactionId: specificPayment.transactionId,
        status: specificPayment.status,
        amount: specificPayment.amount,
        buyer: specificPayment.buyer?.firstName,
        seller: specificPayment.seller?.firstName
      });
    } else {
      console.log('❌ No standard payment found with this ID');
    }

  } catch (error) {
    console.error('❌ Debug error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

debugOrderStructure();
