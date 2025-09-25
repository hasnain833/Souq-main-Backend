/**
 * Quick script to check if a specific transaction exists in the database
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/souq');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function checkTransactionExists(transactionId) {
  console.log(`\n🔍 Checking if transaction exists: ${transactionId}`);
  
  try {
    // Import models
    const StandardPayment = require('./db/models/standardPaymentModel');
    const EscrowTransaction = require('./db/models/escrowTransactionModel');
    
    // Check if it's a valid ObjectId
    const isValidObjectId = mongoose.Types.ObjectId.isValid(transactionId) && /^[0-9a-fA-F]{24}$/.test(transactionId);
    console.log(`📋 ObjectId validation: ${isValidObjectId}`);
    
    if (!isValidObjectId) {
      console.log('❌ Invalid ObjectId format');
      return false;
    }

    // Check StandardPayment collection
    console.log('\n1. Checking StandardPayment collection...');
    const standardPayment = await StandardPayment.findById(transactionId)
      .populate('buyer', '_id firstName lastName email')
      .populate('seller', '_id firstName lastName email')
      .populate('product', '_id title');
    
    if (standardPayment) {
      console.log('✅ Found in StandardPayment:', {
        _id: standardPayment._id.toString(),
        transactionId: standardPayment.transactionId,
        status: standardPayment.status,
        orderStatus: standardPayment.orderStatus,
        buyer: {
          _id: standardPayment.buyer?._id?.toString(),
          name: `${standardPayment.buyer?.firstName} ${standardPayment.buyer?.lastName}`,
          email: standardPayment.buyer?.email
        },
        seller: {
          _id: standardPayment.seller?._id?.toString(),
          name: `${standardPayment.seller?.firstName} ${standardPayment.seller?.lastName}`,
          email: standardPayment.seller?.email
        },
        product: {
          _id: standardPayment.product?._id?.toString(),
          title: standardPayment.product?.title
        },
        createdAt: standardPayment.createdAt,
        updatedAt: standardPayment.updatedAt
      });
      return { found: true, type: 'standard', transaction: standardPayment };
    } else {
      console.log('❌ Not found in StandardPayment collection');
    }

    // Check EscrowTransaction collection
    console.log('\n2. Checking EscrowTransaction collection...');
    const escrowTransaction = await EscrowTransaction.findById(transactionId)
      .populate('buyer', '_id firstName lastName email')
      .populate('seller', '_id firstName lastName email')
      .populate('product', '_id title');
    
    if (escrowTransaction) {
      console.log('✅ Found in EscrowTransaction:', {
        _id: escrowTransaction._id.toString(),
        transactionId: escrowTransaction.transactionId,
        status: escrowTransaction.status,
        buyer: {
          _id: escrowTransaction.buyer?._id?.toString(),
          name: `${escrowTransaction.buyer?.firstName} ${escrowTransaction.buyer?.lastName}`,
          email: escrowTransaction.buyer?.email
        },
        seller: {
          _id: escrowTransaction.seller?._id?.toString(),
          name: `${escrowTransaction.seller?.firstName} ${escrowTransaction.seller?.lastName}`,
          email: escrowTransaction.seller?.email
        },
        product: {
          _id: escrowTransaction.product?._id?.toString(),
          title: escrowTransaction.product?.title
        },
        createdAt: escrowTransaction.createdAt,
        updatedAt: escrowTransaction.updatedAt
      });
      return { found: true, type: 'escrow', transaction: escrowTransaction };
    } else {
      console.log('❌ Not found in EscrowTransaction collection');
    }

    // Check if there are any transactions with this as transactionId field
    console.log('\n3. Checking by transactionId field...');
    
    const standardByTxnId = await StandardPayment.findOne({ transactionId })
      .populate('buyer', '_id firstName lastName email')
      .populate('seller', '_id firstName lastName email')
      .populate('product', '_id title');
    
    if (standardByTxnId) {
      console.log('✅ Found StandardPayment by transactionId field:', {
        _id: standardByTxnId._id.toString(),
        transactionId: standardByTxnId.transactionId
      });
      return { found: true, type: 'standard', transaction: standardByTxnId };
    }

    const escrowByTxnId = await EscrowTransaction.findOne({ transactionId })
      .populate('buyer', '_id firstName lastName email')
      .populate('seller', '_id firstName lastName email')
      .populate('product', '_id title');
    
    if (escrowByTxnId) {
      console.log('✅ Found EscrowTransaction by transactionId field:', {
        _id: escrowByTxnId._id.toString(),
        transactionId: escrowByTxnId.transactionId
      });
      return { found: true, type: 'escrow', transaction: escrowByTxnId };
    }

    console.log('\n❌ Transaction not found in any collection');
    return { found: false };

  } catch (error) {
    console.error('❌ Error checking transaction:', error);
    return { found: false, error: error.message };
  }
}

async function listRecentTransactions() {
  console.log('\n📋 Listing recent transactions for reference...');
  
  try {
    const StandardPayment = require('./db/models/standardPaymentModel');
    const EscrowTransaction = require('./db/models/escrowTransactionModel');
    
    console.log('\n📦 Recent StandardPayments:');
    const recentStandard = await StandardPayment.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('buyer', 'firstName lastName email')
      .populate('seller', 'firstName lastName email')
      .populate('product', 'title');
    
    recentStandard.forEach((payment, index) => {
      console.log(`${index + 1}. ${payment._id} | ${payment.transactionId} | ${payment.status} | ${payment.buyer?.firstName} → ${payment.seller?.firstName}`);
    });

    console.log('\n🔒 Recent EscrowTransactions:');
    const recentEscrow = await EscrowTransaction.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('buyer', 'firstName lastName email')
      .populate('seller', 'firstName lastName email')
      .populate('product', 'title');
    
    recentEscrow.forEach((transaction, index) => {
      console.log(`${index + 1}. ${transaction._id} | ${transaction.transactionId} | ${transaction.status} | ${transaction.buyer?.firstName} → ${transaction.seller?.firstName}`);
    });

  } catch (error) {
    console.error('❌ Error listing transactions:', error);
  }
}

async function runCheck() {
  console.log('🚀 Starting Transaction Existence Check\n');
  
  try {
    await connectDB();
    
    // Get transaction ID from command line or use default
    const transactionId = process.argv[2] || '6882139f75e84f940b9e3a39';
    
    const result = await checkTransactionExists(transactionId);
    
    if (!result.found) {
      await listRecentTransactions();
    }
    
    console.log('\n✅ Check completed');
    
  } catch (error) {
    console.error('\n❌ Check failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run the check
if (require.main === module) {
  runCheck();
}

module.exports = { checkTransactionExists };
