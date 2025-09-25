const mongoose = require('mongoose');
const { findEscrowTransaction, findStandardPayment } = require('./utils/transactionUtils');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/souq', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function debugTransactionPermission() {
  try {
    const transactionId = 'TXN_1751547322302_41DYYQ';
    console.log('🔍 Debugging transaction permission for:', transactionId);

    // Try to find in escrow transactions
    console.log('\n1. Checking Escrow Transactions...');
    let escrowTransaction = await findEscrowTransaction(transactionId, true);
    if (escrowTransaction) {
      console.log('✅ Found in Escrow Transactions:', {
        _id: escrowTransaction._id,
        transactionId: escrowTransaction.transactionId,
        status: escrowTransaction.status,
        buyer: escrowTransaction.buyer,
        seller: escrowTransaction.seller,
        buyerType: typeof escrowTransaction.buyer,
        sellerType: typeof escrowTransaction.seller,
        buyerId: escrowTransaction.buyer?._id?.toString(),
        sellerId: escrowTransaction.seller?._id?.toString()
      });
    } else {
      console.log('❌ Not found in Escrow Transactions');
    }

    // Try to find in standard payments
    console.log('\n2. Checking Standard Payments...');
    let standardPayment = await findStandardPayment(transactionId, true);
    if (standardPayment) {
      console.log('✅ Found in Standard Payments:', {
        _id: standardPayment._id,
        transactionId: standardPayment.transactionId,
        status: standardPayment.status,
        buyer: standardPayment.buyer,
        seller: standardPayment.seller,
        buyerType: typeof standardPayment.buyer,
        sellerType: typeof standardPayment.seller,
        buyerId: standardPayment.buyer?._id?.toString(),
        sellerId: standardPayment.seller?._id?.toString()
      });
    } else {
      console.log('❌ Not found in Standard Payments');
    }

    // Test with a sample user ID (you'll need to replace this with actual user ID)
    const sampleUserId = '507f1f77bcf86cd799439011'; // Replace with actual user ID
    console.log('\n3. Testing Permission Check...');
    console.log('Sample User ID:', sampleUserId);

    const transaction = escrowTransaction || standardPayment;
    if (transaction) {
      console.log('\nTransaction Details:');
      console.log('- Buyer ID:', transaction.buyer?._id?.toString());
      console.log('- Seller ID:', transaction.seller?._id?.toString());
      console.log('- Sample User ID:', sampleUserId);
      
      const isBuyer = transaction.buyer && transaction.buyer._id.toString() === sampleUserId;
      const isSeller = transaction.seller && transaction.seller._id.toString() === sampleUserId;
      
      console.log('- Is Buyer:', isBuyer);
      console.log('- Is Seller:', isSeller);
      console.log('- Has Permission:', isBuyer || isSeller);

      // Check if buyer/seller are populated
      if (transaction.buyer && typeof transaction.buyer === 'object' && transaction.buyer._id) {
        console.log('✅ Buyer is properly populated');
      } else {
        console.log('❌ Buyer is not properly populated:', transaction.buyer);
      }

      if (transaction.seller && typeof transaction.seller === 'object' && transaction.seller._id) {
        console.log('✅ Seller is properly populated');
      } else {
        console.log('❌ Seller is not properly populated:', transaction.seller);
      }
    }

    // Direct database queries to check population
    console.log('\n4. Direct Database Queries...');
    
    const EscrowTransaction = require('./db/models/escrowTransactionModel');
    const StandardPayment = require('./db/models/standardPaymentModel');

    // Check escrow transaction with population
    const escrowWithPopulation = await EscrowTransaction.findOne({ transactionId })
      .populate('buyer', '_id username email')
      .populate('seller', '_id username email');
    
    if (escrowWithPopulation) {
      console.log('✅ Escrow with population:', {
        buyer: escrowWithPopulation.buyer,
        seller: escrowWithPopulation.seller
      });
    }

    // Check standard payment with population
    const standardWithPopulation = await StandardPayment.findOne({ transactionId })
      .populate('buyer', '_id username email')
      .populate('seller', '_id username email');
    
    if (standardWithPopulation) {
      console.log('✅ Standard payment with population:', {
        buyer: standardWithPopulation.buyer,
        seller: standardWithPopulation.seller
      });
    }

  } catch (error) {
    console.error('❌ Debug error:', error);
  } finally {
    mongoose.connection.close();
  }
}

debugTransactionPermission();
