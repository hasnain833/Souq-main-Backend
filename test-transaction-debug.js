const mongoose = require('mongoose');
require('dotenv').config();

async function testTransactionDebug() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Import required models and utilities
    const Transaction = require('./db/models/transactionModel');
    const EscrowTransaction = require('./db/models/escrowTransactionModel');
    const StandardPayment = require('./db/models/standardPaymentModel');
    const User = require('./db/models/userModel');
    const Product = require('./db/models/productModel');
    const { findEscrowTransaction, findStandardPayment } = require('./utils/transactionUtils');
    
    // Test with the problematic transaction ID
    const transactionId = 'TXN_1753269981362_4NEG0L';
    
    console.log(`\n🔍 Testing transaction lookup for: ${transactionId}`);
    
    // Step 1: Try escrow transaction lookup
    console.log('\n1. Trying escrow transaction lookup...');
    const escrowTransaction = await findEscrowTransaction(transactionId, true);
    if (escrowTransaction) {
      console.log('✅ Found escrow transaction:', {
        _id: escrowTransaction._id,
        transactionId: escrowTransaction.transactionId,
        status: escrowTransaction.status,
        buyer: escrowTransaction.buyer?._id,
        seller: escrowTransaction.seller?._id
      });
    } else {
      console.log('❌ No escrow transaction found');
    }
    
    // Step 2: Try standard payment lookup
    console.log('\n2. Trying standard payment lookup...');
    const standardPayment = await findStandardPayment(transactionId, true);
    if (standardPayment) {
      console.log('✅ Found standard payment:', {
        _id: standardPayment._id,
        transactionId: standardPayment.transactionId,
        status: standardPayment.status,
        buyer: standardPayment.buyer?._id,
        seller: standardPayment.seller?._id
      });
    } else {
      console.log('❌ No standard payment found');
    }
    
    // Step 3: Try order-based lookup (like the backend does)
    console.log('\n3. Trying order-based lookup...');
    
    // Find Transaction record by transactionId
    const transactionRecord = await Transaction.findOne({ transactionId: transactionId })
      .populate('buyer', '_id firstName lastName email username')
      .populate('seller', '_id firstName lastName email username')
      .populate('escrowTransaction');
    
    if (transactionRecord) {
      console.log('✅ Found Transaction record:', {
        _id: transactionRecord._id,
        transactionId: transactionRecord.transactionId,
        status: transactionRecord.status,
        buyer: transactionRecord.buyer?._id,
        seller: transactionRecord.seller?._id,
        escrowTransaction: transactionRecord.escrowTransaction ? {
          _id: transactionRecord.escrowTransaction._id,
          transactionId: transactionRecord.escrowTransaction.transactionId,
          status: transactionRecord.escrowTransaction.status
        } : null
      });
      
      // If this is an escrow transaction, try to find the actual EscrowTransaction
      if (transactionRecord.escrowTransaction) {
        console.log('\n4. Found linked EscrowTransaction, testing API call with escrow ID...');
        const escrowId = transactionRecord.escrowTransaction._id.toString();
        console.log(`🎯 EscrowTransaction ID to use: ${escrowId}`);
        
        // Test if we can find it by the escrow transaction ID
        const escrowByIdTest = await findEscrowTransaction(escrowId, true);
        if (escrowByIdTest) {
          console.log('✅ Can find escrow transaction by its ID:', {
            _id: escrowByIdTest._id,
            transactionId: escrowByIdTest.transactionId,
            status: escrowByIdTest.status
          });
        } else {
          console.log('❌ Cannot find escrow transaction by its ID');
        }
      }
    } else {
      console.log('❌ No Transaction record found');
    }
    
    // Step 4: Check if there are any orders with this transaction ID
    console.log('\n5. Checking for orders with this transaction ID...');
    
    // Try to find orders by orderNumber (which should be the transactionId)
    const orders = await Transaction.find({ transactionId: transactionId }).limit(5);
    console.log(`Found ${orders.length} orders with transactionId: ${transactionId}`);
    
    orders.forEach((order, index) => {
      console.log(`Order ${index + 1}:`, {
        _id: order._id,
        transactionId: order.transactionId,
        status: order.status,
        escrowTransaction: order.escrowTransaction
      });
    });

  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

// Run the test
testTransactionDebug();
