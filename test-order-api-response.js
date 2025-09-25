const mongoose = require('mongoose');
require('dotenv').config();

async function testOrderAPIResponse() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const Transaction = require('./db/models/transactionModel');
    const StandardPayment = require('./db/models/standardPaymentModel');
    const Product = require('./db/models/productModel');
    const User = require('./db/models/userModel');
    const EscrowTransaction = require('./db/models/escrowTransactionModel');
    
    // First, let's find any orders in the database
    console.log('\n🔍 Looking for any orders in the database...');

    const transactions = await Transaction.find().limit(5);
    const standardPayments = await StandardPayment.find().limit(5);

    console.log(`Found ${transactions.length} transactions and ${standardPayments.length} standard payments`);

    // Look for escrow transactions with different statuses
    const escrowTransactions = await EscrowTransaction.find().limit(10);
    console.log(`Found ${escrowTransactions.length} escrow transactions`);

    console.log('\nEscrow transaction statuses:');
    escrowTransactions.forEach((et, index) => {
      console.log(`${index + 1}. ${et._id} - ${et.transactionId} - Status: ${et.status}`);
    });

    // Look for a shipped escrow transaction
    let shippedEscrow = await EscrowTransaction.findOne({ status: 'shipped' });
    if (!shippedEscrow) {
      console.log('\n🚚 No shipped escrow transaction found. Creating one for testing...');

      // Update the first funds_held escrow transaction to shipped status
      const fundsHeldEscrow = await EscrowTransaction.findOne({ status: 'funds_held' });
      if (fundsHeldEscrow) {
        await EscrowTransaction.findByIdAndUpdate(fundsHeldEscrow._id, {
          status: 'shipped',
          shippingInfo: {
            trackingNumber: 'TEST123456789',
            carrier: 'Test Carrier',
            shippedAt: new Date(),
            estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
          }
        });

        shippedEscrow = await EscrowTransaction.findById(fundsHeldEscrow._id);
        console.log('✅ Updated escrow transaction to shipped status');
      }
    }

    if (shippedEscrow) {
      console.log('\n🚚 Found/Created shipped escrow transaction:', {
        _id: shippedEscrow._id,
        transactionId: shippedEscrow.transactionId,
        status: shippedEscrow.status
      });

      // Find the corresponding Transaction record
      const correspondingTransaction = await Transaction.findOne({ escrowTransaction: shippedEscrow._id });
      if (correspondingTransaction) {
        console.log('📦 Corresponding Transaction record:', {
          _id: correspondingTransaction._id,
          transactionId: correspondingTransaction.transactionId,
          status: correspondingTransaction.status
        });

        // Update the Transaction status to match the escrow status
        await Transaction.findByIdAndUpdate(correspondingTransaction._id, { status: 'shipped' });
        console.log('✅ Updated Transaction status to shipped');

        // Store this for testing
        global.shippedTransactionId = correspondingTransaction._id.toString();
      } else {
        console.log('❌ No corresponding Transaction record found for shipped escrow transaction');
      }
    }

    if (transactions.length > 0) {
      console.log('\nSample transaction:', {
        _id: transactions[0]._id,
        transactionId: transactions[0].transactionId,
        status: transactions[0].status
      });
    }

    if (standardPayments.length > 0) {
      console.log('Sample standard payment:', {
        _id: standardPayments[0]._id,
        transactionId: standardPayments[0].transactionId,
        status: standardPayments[0].status
      });
    }

    // Use the shipped transaction for testing if available
    let orderId;
    if (global.shippedTransactionId) {
      orderId = global.shippedTransactionId;
      console.log(`\n🎯 Using shipped transaction for testing: ${orderId}`);
    }

    // Fallback to first available order
    if (!orderId) {
      if (transactions.length > 0) {
        orderId = transactions[0]._id.toString();
      } else if (standardPayments.length > 0) {
        orderId = standardPayments[0]._id.toString();
      } else {
        console.log('❌ No orders found in database');
        return;
      }
    }

    console.log(`\n🔍 Testing order API response for order ID: ${orderId}`);
    
    // Try to find in transactions first (escrow)
    let order = await Transaction.findById(orderId)
      .populate('product', 'title price product_photos brand size condition material colors user')
      .populate('buyer', 'username profile_picture email phone')
      .populate('seller', 'username profile_picture email phone')
      .populate('escrowTransaction');

    let orderType = 'escrow';

    // If not found in transactions, try standardpayments
    if (!order) {
      order = await StandardPayment.findById(orderId)
        .populate('product', 'title price product_photos brand size condition material colors user')
        .populate('buyer', 'username profile_picture email phone')
        .populate('seller', 'username profile_picture email phone')
        .populate('offer');

      orderType = 'standard';
    }

    if (!order) {
      console.log('❌ Order not found');
      return;
    }

    console.log(`✅ Found order of type: ${orderType}`);
    console.log('📋 Order details:', {
      _id: order._id,
      transactionId: order.transactionId,
      status: order.status,
      escrowTransaction: order.escrowTransaction ? {
        _id: order.escrowTransaction._id,
        transactionId: order.escrowTransaction.transactionId,
        status: order.escrowTransaction.status
      } : null
    });

    // Format order data like the API does
    const formattedOrder = {
      _id: order._id,
      orderNumber: order.transactionId,
      type: orderType,
      buyer: order.buyer,
      seller: order.seller,
      product: order.product,
      status: order.status,
      orderDetails: {
        productPrice: orderType === 'escrow' ? order.amount : order.productPrice,
        offerAmount: orderType === 'standard' && order.offer ? order.productPrice : null,
        quantity: 1,
        currency: order.currency
      },
      payment: {
        method: orderType,
        status: order.status,
        transactionId: order.transactionId,
        escrowTransactionId: orderType === 'escrow' ? order.escrowTransaction?._id : null,
        paymentGateway: order.paymentGateway,
        fees: orderType === 'escrow' ? {
          total: order.amount
        } : {
          platformFee: order.platformFeeAmount,
          shippingFee: order.shippingCost,
          tax: order.salesTax,
          total: order.totalAmount
        }
      },
      shipping: {
        toAddress: orderType === 'escrow' ?
          order.escrowTransaction?.shippingAddress :
          order.shippingAddress
      },
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    };

    console.log('\n🎯 Formatted order response:');
    console.log('Order ID:', formattedOrder._id);
    console.log('Order Number:', formattedOrder.orderNumber);
    console.log('Type:', formattedOrder.type);
    console.log('Status:', formattedOrder.status);
    console.log('Payment:', {
      method: formattedOrder.payment.method,
      status: formattedOrder.payment.status,
      transactionId: formattedOrder.payment.transactionId,
      escrowTransactionId: formattedOrder.payment.escrowTransactionId
    });

    // Test what the frontend should use for API calls
    console.log('\n🔧 Frontend should use:');
    if (orderType === 'escrow') {
      console.log('For EscrowTransactionStatus:', formattedOrder.payment.escrowTransactionId || formattedOrder.payment.transactionId || formattedOrder._id);
      console.log('For TransactionProgress:', formattedOrder.payment.transactionId || formattedOrder._id);
    } else {
      console.log('For TransactionProgress:', formattedOrder.payment.transactionId || formattedOrder._id);
    }

  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

// Run the test
testOrderAPIResponse();
