/**
 * Script specifically to fix escrow transaction statuses
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

async function checkEscrowStatuses() {
  console.log('\n🔍 Checking escrow transaction statuses...\n');
  
  try {
    const EscrowTransaction = require('./db/models/escrowTransactionModel');
    const Transaction = require('./db/models/transactionModel');
    
    // Check EscrowTransactions
    console.log('📋 EscrowTransaction Collection:');
    const escrowTransactions = await EscrowTransaction.find()
      .populate('buyer', 'firstName lastName email')
      .populate('seller', 'firstName lastName email')
      .populate('product', 'title')
      .sort({ createdAt: -1 });
    
    console.log(`Found ${escrowTransactions.length} escrow transactions:`);
    escrowTransactions.forEach((transaction, index) => {
      console.log(`${index + 1}. ID: ${transaction._id}`);
      console.log(`   Transaction ID: ${transaction.transactionId}`);
      console.log(`   Status: ${transaction.status}`);
      console.log(`   Amount: ${transaction.totalAmount} ${transaction.currency}`);
      console.log(`   Gateway: ${transaction.paymentGateway}`);
      console.log(`   Gateway Transaction ID: ${transaction.gatewayTransactionId || 'N/A'}`);
      console.log(`   Buyer: ${transaction.buyer?.firstName} ${transaction.buyer?.lastName}`);
      console.log(`   Seller: ${transaction.seller?.firstName} ${transaction.seller?.lastName}`);
      console.log(`   Product: ${transaction.product?.title}`);
      console.log(`   Created: ${transaction.createdAt}`);
      console.log('   ---');
    });

    // Check Transaction payment records (these are linked to escrow)
    console.log('\n💳 Transaction Payment Records (Escrow):');
    const transactions = await Transaction.find()
      .populate('buyer', 'firstName lastName email')
      .populate('seller', 'firstName lastName email')
      .populate('product', 'title')
      .populate('escrowTransaction')
      .sort({ createdAt: -1 });
    
    console.log(`Found ${transactions.length} transaction payment records:`);
    transactions.forEach((transaction, index) => {
      console.log(`${index + 1}. ID: ${transaction._id}`);
      console.log(`   Transaction ID: ${transaction.transactionId}`);
      console.log(`   Status: ${transaction.status}`);
      console.log(`   Amount: ${transaction.amount} ${transaction.currency}`);
      console.log(`   Gateway: ${transaction.paymentGateway}`);
      console.log(`   Gateway Transaction ID: ${transaction.gatewayTransactionId || 'N/A'}`);
      console.log(`   Buyer: ${transaction.buyer?.firstName} ${transaction.buyer?.lastName}`);
      console.log(`   Seller: ${transaction.seller?.firstName} ${transaction.seller?.lastName}`);
      console.log(`   Product: ${transaction.product?.title}`);
      console.log(`   Escrow Transaction: ${transaction.escrowTransaction?._id || 'N/A'}`);
      console.log(`   Created: ${transaction.createdAt}`);
      console.log('   ---');
    });

    // Status summary
    console.log('\n📊 Status Summary:');
    
    const escrowStatusCounts = await EscrowTransaction.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    console.log('EscrowTransaction statuses:', escrowStatusCounts);
    
    const transactionStatusCounts = await Transaction.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    console.log('Transaction payment record statuses:', transactionStatusCounts);

  } catch (error) {
    console.error('❌ Error checking escrow statuses:', error);
  }
}

async function fixEscrowStatuses() {
  console.log('\n🔧 Fixing escrow transaction statuses...\n');
  
  try {
    const EscrowTransaction = require('./db/models/escrowTransactionModel');
    const Transaction = require('./db/models/transactionModel');
    
    let totalFixed = 0;
    
    // Fix EscrowTransactions
    console.log('1. Fixing EscrowTransaction records...');
    
    // Find all pending escrow transactions
    const pendingEscrowTransactions = await EscrowTransaction.find({ 
      status: { $in: ['pending', 'pending_payment', 'payment_processing'] }
    }).populate('buyer', 'firstName lastName email').populate('seller', 'firstName lastName email');
    
    console.log(`Found ${pendingEscrowTransactions.length} pending escrow transactions`);
    
    for (const transaction of pendingEscrowTransactions) {
      console.log(`✅ Updating EscrowTransaction ${transaction._id}:`);
      console.log(`   Transaction ID: ${transaction.transactionId}`);
      console.log(`   From: ${transaction.status} → funds_held`);
      console.log(`   Buyer: ${transaction.buyer?.firstName} ${transaction.buyer?.lastName}`);
      console.log(`   Seller: ${transaction.seller?.firstName} ${transaction.seller?.lastName}`);
      
      await EscrowTransaction.findByIdAndUpdate(transaction._id, {
        status: 'funds_held',
        updatedAt: new Date(),
        // Add status history entry
        $push: {
          statusHistory: {
            status: 'funds_held',
            timestamp: new Date(),
            note: 'Status updated by fix script - payment completed'
          }
        }
      });
      totalFixed++;
    }
    
    // Fix Transaction payment records
    console.log('\n2. Fixing Transaction payment records...');
    
    const pendingTransactions = await Transaction.find({ 
      status: { $in: ['pending', 'pending_payment', 'processing'] }
    }).populate('buyer', 'firstName lastName email').populate('seller', 'firstName lastName email');
    
    console.log(`Found ${pendingTransactions.length} pending transaction payment records`);
    
    for (const transaction of pendingTransactions) {
      console.log(`✅ Updating Transaction ${transaction._id}:`);
      console.log(`   Transaction ID: ${transaction.transactionId}`);
      console.log(`   From: ${transaction.status} → completed`);
      console.log(`   Buyer: ${transaction.buyer?.firstName} ${transaction.buyer?.lastName}`);
      console.log(`   Seller: ${transaction.seller?.firstName} ${transaction.seller?.lastName}`);
      
      await Transaction.findByIdAndUpdate(transaction._id, {
        status: 'completed',
        updatedAt: new Date()
      });
      totalFixed++;
    }
    
    console.log(`\n🎉 Total escrow records fixed: ${totalFixed}`);
    
  } catch (error) {
    console.error('❌ Error fixing escrow statuses:', error);
  }
}

async function runScript() {
  console.log('🚀 Escrow Status Fix Script\n');
  
  try {
    await connectDB();
    
    // Check current statuses
    await checkEscrowStatuses();
    
    // Ask if user wants to fix
    const args = process.argv.slice(2);
    if (args.includes('--fix')) {
      await fixEscrowStatuses();
      
      // Check statuses again after fix
      console.log('\n🔍 Checking statuses after fix...');
      await checkEscrowStatuses();
    } else {
      console.log('\n💡 To fix the escrow statuses, run: node fix-escrow-statuses.js --fix');
    }
    
    console.log('\n✅ Script completed');
    
  } catch (error) {
    console.error('\n❌ Script failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  runScript();
}
