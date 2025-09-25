/**
 * Debug script to test wallet transaction check functionality
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import required modules
const { findStandardPayment, findEscrowTransaction } = require('./utils/transactionUtils');

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/souq');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function debugTransactionCheck(transactionId, userId) {
  console.log(`\n🔍 Debugging transaction check for:`);
  console.log(`   Transaction ID: ${transactionId}`);
  console.log(`   User ID: ${userId}`);
  
  try {
    // Try to find in standard payments
    console.log('\n1. Checking Standard Payments...');
    let standardPayment = await findStandardPayment(transactionId, true);
    if (standardPayment) {
      console.log('✅ Found in Standard Payments:', {
        _id: standardPayment._id.toString(),
        transactionId: standardPayment.transactionId,
        status: standardPayment.status,
        buyer: standardPayment.buyer,
        seller: standardPayment.seller,
        buyerType: typeof standardPayment.buyer,
        sellerType: typeof standardPayment.seller,
        buyerId: standardPayment.buyer?._id?.toString(),
        sellerId: standardPayment.seller?._id?.toString()
      });
      
      // Check permissions
      const buyerId = standardPayment.buyer?._id?.toString() || standardPayment.buyer?.toString();
      const sellerId = standardPayment.seller?._id?.toString() || standardPayment.seller?.toString();
      const isOwner = buyerId === userId || sellerId === userId;
      
      console.log('\n👤 Permission Check:');
      console.log(`   User ID: ${userId}`);
      console.log(`   Buyer ID: ${buyerId}`);
      console.log(`   Seller ID: ${sellerId}`);
      console.log(`   Is Buyer: ${buyerId === userId}`);
      console.log(`   Is Seller: ${sellerId === userId}`);
      console.log(`   Is Owner: ${isOwner}`);
      
      if (isOwner) {
        console.log('✅ Permission granted - user is owner');
      } else {
        console.log('❌ Permission denied - user is not owner');
      }
      
      return standardPayment;
    } else {
      console.log('❌ Not found in Standard Payments');
    }

    // Try to find in escrow transactions
    console.log('\n2. Checking Escrow Transactions...');
    let escrowTransaction = await findEscrowTransaction(transactionId, true);
    if (escrowTransaction) {
      console.log('✅ Found in Escrow Transactions:', {
        _id: escrowTransaction._id.toString(),
        transactionId: escrowTransaction.transactionId,
        status: escrowTransaction.status,
        buyer: escrowTransaction.buyer,
        seller: escrowTransaction.seller,
        buyerType: typeof escrowTransaction.buyer,
        sellerType: typeof escrowTransaction.seller,
        buyerId: escrowTransaction.buyer?._id?.toString(),
        sellerId: escrowTransaction.seller?._id?.toString()
      });
      
      // Check permissions
      const buyerId = escrowTransaction.buyer?._id?.toString() || escrowTransaction.buyer?.toString();
      const sellerId = escrowTransaction.seller?._id?.toString() || escrowTransaction.seller?.toString();
      const isOwner = buyerId === userId || sellerId === userId;
      
      console.log('\n👤 Permission Check:');
      console.log(`   User ID: ${userId}`);
      console.log(`   Buyer ID: ${buyerId}`);
      console.log(`   Seller ID: ${sellerId}`);
      console.log(`   Is Buyer: ${buyerId === userId}`);
      console.log(`   Is Seller: ${sellerId === userId}`);
      console.log(`   Is Owner: ${isOwner}`);
      
      if (isOwner) {
        console.log('✅ Permission granted - user is owner');
      } else {
        console.log('❌ Permission denied - user is not owner');
      }
      
      return escrowTransaction;
    } else {
      console.log('❌ Not found in Escrow Transactions');
    }

    console.log('\n❌ Transaction not found in either collection');
    return null;

  } catch (error) {
    console.error('❌ Error during transaction check:', error);
    return null;
  }
}

async function runDebug() {
  console.log('🚀 Starting Wallet Transaction Check Debug\n');
  
  try {
    await connectDB();
    
    // Get transaction ID from command line arguments
    const transactionId = process.argv[2];
    const userId = process.argv[3];
    
    if (!transactionId) {
      console.log('❌ Please provide a transaction ID as the first argument');
      console.log('Usage: node debug-wallet-transaction-check.js <transactionId> [userId]');
      process.exit(1);
    }
    
    if (!userId) {
      console.log('⚠️  No user ID provided, will only check transaction existence');
    }
    
    await debugTransactionCheck(transactionId, userId);
    
    console.log('\n✅ Debug completed');
    
  } catch (error) {
    console.error('\n❌ Debug failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run the debug
if (require.main === module) {
  runDebug();
}

module.exports = { debugTransactionCheck };
