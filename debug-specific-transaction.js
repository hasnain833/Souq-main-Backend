/**
 * Debug script to test specific transaction lookup
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

async function debugSpecificTransaction(transactionId) {
  console.log(`\n🔍 Debugging specific transaction: ${transactionId}`);
  
  try {
    // Check if it's a valid ObjectId
    const isValidObjectId = mongoose.Types.ObjectId.isValid(transactionId) && /^[0-9a-fA-F]{24}$/.test(transactionId);
    console.log(`📋 Transaction ID validation:`, {
      transactionId,
      isValidObjectId,
      length: transactionId.length
    });

    // Try to find in standard payments
    console.log('\n1. Checking Standard Payments...');
    let standardPayment = await findStandardPayment(transactionId, true);
    if (standardPayment) {
      console.log('✅ Found in Standard Payments:', {
        _id: standardPayment._id.toString(),
        transactionId: standardPayment.transactionId,
        status: standardPayment.status,
        orderStatus: standardPayment.orderStatus,
        buyer: {
          _id: standardPayment.buyer?._id?.toString(),
          name: standardPayment.buyer?.firstName + ' ' + standardPayment.buyer?.lastName,
          email: standardPayment.buyer?.email
        },
        seller: {
          _id: standardPayment.seller?._id?.toString(),
          name: standardPayment.seller?.firstName + ' ' + standardPayment.seller?.lastName,
          email: standardPayment.seller?.email
        },
        product: {
          _id: standardPayment.product?._id?.toString(),
          title: standardPayment.product?.title
        }
      });
      return { transaction: standardPayment, type: 'standard' };
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
        buyer: {
          _id: escrowTransaction.buyer?._id?.toString(),
          name: escrowTransaction.buyer?.firstName + ' ' + escrowTransaction.buyer?.lastName,
          email: escrowTransaction.buyer?.email
        },
        seller: {
          _id: escrowTransaction.seller?._id?.toString(),
          name: escrowTransaction.seller?.firstName + ' ' + escrowTransaction.seller?.lastName,
          email: escrowTransaction.seller?.email
        },
        product: {
          _id: escrowTransaction.product?._id?.toString(),
          title: escrowTransaction.product?.title
        }
      });
      return { transaction: escrowTransaction, type: 'escrow' };
    } else {
      console.log('❌ Not found in Escrow Transactions');
    }

    // Try direct database queries
    console.log('\n3. Direct Database Queries...');
    
    const StandardPayment = require('./db/models/standardPaymentModel');
    const EscrowTransaction = require('./db/models/escrowTransactionModel');
    
    if (isValidObjectId) {
      console.log('🔍 Trying direct StandardPayment findById...');
      const directStandard = await StandardPayment.findById(transactionId)
        .populate('buyer', '_id firstName lastName email')
        .populate('seller', '_id firstName lastName email')
        .populate('product', '_id title');
      
      if (directStandard) {
        console.log('✅ Found via direct StandardPayment query:', {
          _id: directStandard._id.toString(),
          transactionId: directStandard.transactionId,
          status: directStandard.status
        });
        return { transaction: directStandard, type: 'standard' };
      }

      console.log('🔍 Trying direct EscrowTransaction findById...');
      const directEscrow = await EscrowTransaction.findById(transactionId)
        .populate('buyer', '_id firstName lastName email')
        .populate('seller', '_id firstName lastName email')
        .populate('product', '_id title');
      
      if (directEscrow) {
        console.log('✅ Found via direct EscrowTransaction query:', {
          _id: directEscrow._id.toString(),
          transactionId: directEscrow.transactionId,
          status: directEscrow.status
        });
        return { transaction: directEscrow, type: 'escrow' };
      }
    }

    console.log('\n❌ Transaction not found in any collection');
    return null;

  } catch (error) {
    console.error('❌ Error during transaction lookup:', error);
    return null;
  }
}

async function testPermissionCheck(transactionId, userId) {
  console.log(`\n👤 Testing permission check for user: ${userId}`);
  
  const result = await debugSpecificTransaction(transactionId);
  if (!result) {
    console.log('❌ Cannot test permissions - transaction not found');
    return;
  }

  const { transaction, type } = result;
  
  // Test permission logic
  const buyerId = transaction.buyer?._id?.toString() || transaction.buyer?.toString();
  const sellerId = transaction.seller?._id?.toString() || transaction.seller?.toString();
  
  console.log('🔍 Permission check details:', {
    userId: userId,
    buyerId,
    sellerId,
    isBuyer: buyerId === userId,
    isSeller: sellerId === userId,
    hasPermission: buyerId === userId || sellerId === userId
  });
}

async function runDebug() {
  console.log('🚀 Starting Specific Transaction Debug\n');
  
  try {
    await connectDB();
    
    // Get transaction ID from command line arguments
    const transactionId = process.argv[2] || '6882139f75e84f940b9e3a39';
    const userId = process.argv[3];
    
    console.log(`🎯 Target transaction: ${transactionId}`);
    if (userId) {
      console.log(`👤 Test user: ${userId}`);
    }
    
    await debugSpecificTransaction(transactionId);
    
    if (userId) {
      await testPermissionCheck(transactionId, userId);
    }
    
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

module.exports = { debugSpecificTransaction };
