/**
 * Script to check and fix payment statuses in the database
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

async function checkPaymentStatuses() {
  console.log('\n🔍 Checking payment statuses in database...\n');
  
  try {
    // Import models
    const StandardPayment = require('./db/models/standardPaymentModel');
    const EscrowTransaction = require('./db/models/escrowTransactionModel');
    const Transaction = require('./db/models/transactionModel');
    
    // Check StandardPayments
    console.log('📦 StandardPayments:');
    const standardPayments = await StandardPayment.find()
      .populate('buyer', 'firstName lastName email')
      .populate('seller', 'firstName lastName email')
      .populate('product', 'title')
      .sort({ createdAt: -1 })
      .limit(10);
    
    console.log(`Found ${standardPayments.length} standard payments:`);
    standardPayments.forEach((payment, index) => {
      console.log(`${index + 1}. ID: ${payment._id}`);
      console.log(`   Transaction ID: ${payment.transactionId}`);
      console.log(`   Status: ${payment.status}`);
      console.log(`   Order Status: ${payment.orderStatus || 'N/A'}`);
      console.log(`   Amount: ${payment.totalAmount} ${payment.currency}`);
      console.log(`   Gateway: ${payment.paymentGateway}`);
      console.log(`   Gateway Transaction ID: ${payment.gatewayTransactionId || 'N/A'}`);
      console.log(`   Buyer: ${payment.buyer?.firstName} ${payment.buyer?.lastName}`);
      console.log(`   Seller: ${payment.seller?.firstName} ${payment.seller?.lastName}`);
      console.log(`   Product: ${payment.product?.title}`);
      console.log(`   Created: ${payment.createdAt}`);
      console.log(`   Updated: ${payment.updatedAt}`);
      console.log('   ---');
    });

    // Check EscrowTransactions
    console.log('\n🔒 EscrowTransactions:');
    const escrowTransactions = await EscrowTransaction.find()
      .populate('buyer', 'firstName lastName email')
      .populate('seller', 'firstName lastName email')
      .populate('product', 'title')
      .sort({ createdAt: -1 })
      .limit(10);
    
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
      console.log(`   Updated: ${transaction.updatedAt}`);
      console.log('   ---');
    });

    // Check Transactions (payment records)
    console.log('\n💳 Transactions (Payment Records):');
    const transactions = await Transaction.find()
      .populate('buyer', 'firstName lastName email')
      .populate('seller', 'firstName lastName email')
      .populate('product', 'title')
      .populate('escrowTransaction')
      .sort({ createdAt: -1 })
      .limit(10);
    
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
      console.log(`   Updated: ${transaction.updatedAt}`);
      console.log('   ---');
    });

    // Summary
    console.log('\n📊 Status Summary:');
    
    const standardStatusCounts = await StandardPayment.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    console.log('StandardPayment statuses:', standardStatusCounts);
    
    const escrowStatusCounts = await EscrowTransaction.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    console.log('EscrowTransaction statuses:', escrowStatusCounts);
    
    const transactionStatusCounts = await Transaction.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    console.log('Transaction statuses:', transactionStatusCounts);

  } catch (error) {
    console.error('❌ Error checking payment statuses:', error);
  }
}

async function fixPaymentStatuses() {
  console.log('\n🔧 Fixing payment statuses...\n');

  try {
    const StandardPayment = require('./db/models/standardPaymentModel');
    const EscrowTransaction = require('./db/models/escrowTransactionModel');
    const Transaction = require('./db/models/transactionModel');

    let fixedCount = 0;

    // Fix StandardPayments that should be completed
    console.log('🔧 Fixing StandardPayments...');

    // Find payments that are pending but have been created (indicating payment was attempted)
    const pendingStandardPayments = await StandardPayment.find({
      status: { $in: ['pending', 'pending_payment', 'processing'] }
    }).populate('buyer', 'firstName lastName email').populate('seller', 'firstName lastName email');

    console.log(`Found ${pendingStandardPayments.length} standard payments to check`);

    for (const payment of pendingStandardPayments) {
      // If payment has a gateway transaction ID, it means payment was processed
      const shouldComplete = payment.gatewayTransactionId ||
                           payment.createdAt < new Date(Date.now() - 5 * 60 * 1000); // Created more than 5 minutes ago

      if (shouldComplete) {
        console.log(`✅ Updating StandardPayment ${payment._id}:`);
        console.log(`   Transaction ID: ${payment.transactionId}`);
        console.log(`   From: ${payment.status} → completed`);
        console.log(`   Buyer: ${payment.buyer?.firstName} ${payment.buyer?.lastName}`);
        console.log(`   Seller: ${payment.seller?.firstName} ${payment.seller?.lastName}`);

        await StandardPayment.findByIdAndUpdate(payment._id, {
          status: 'completed',
          orderStatus: 'paid',
          completedAt: new Date(),
          updatedAt: new Date()
        });
        fixedCount++;
      }
    }

    // Fix EscrowTransactions that should be funds_held
    console.log('\n🔧 Fixing EscrowTransactions...');
    const pendingEscrowTransactions = await EscrowTransaction.find({
      status: { $in: ['pending', 'pending_payment', 'payment_processing'] }
    }).populate('buyer', 'firstName lastName email').populate('seller', 'firstName lastName email');

    console.log(`Found ${pendingEscrowTransactions.length} escrow transactions to check`);

    for (const transaction of pendingEscrowTransactions) {
      const shouldComplete = transaction.gatewayTransactionId ||
                           transaction.createdAt < new Date(Date.now() - 5 * 60 * 1000);

      if (shouldComplete) {
        console.log(`✅ Updating EscrowTransaction ${transaction._id}:`);
        console.log(`   Transaction ID: ${transaction.transactionId}`);
        console.log(`   From: ${transaction.status} → funds_held`);
        console.log(`   Buyer: ${transaction.buyer?.firstName} ${transaction.buyer?.lastName}`);
        console.log(`   Seller: ${transaction.seller?.firstName} ${transaction.seller?.lastName}`);

        await EscrowTransaction.findByIdAndUpdate(transaction._id, {
          status: 'funds_held',
          updatedAt: new Date()
        });
        fixedCount++;
      }
    }

    // Fix Transaction payment records
    console.log('\n🔧 Fixing Transaction payment records...');
    const pendingTransactions = await Transaction.find({
      status: { $in: ['pending', 'pending_payment', 'processing'] }
    }).populate('buyer', 'firstName lastName email').populate('seller', 'firstName lastName email');

    console.log(`Found ${pendingTransactions.length} transaction payment records to check`);

    for (const transaction of pendingTransactions) {
      const shouldComplete = transaction.gatewayTransactionId ||
                           transaction.createdAt < new Date(Date.now() - 5 * 60 * 1000);

      if (shouldComplete) {
        console.log(`✅ Updating Transaction ${transaction._id}:`);
        console.log(`   Transaction ID: ${transaction.transactionId}`);
        console.log(`   From: ${transaction.status} → completed`);
        console.log(`   Buyer: ${transaction.buyer?.firstName} ${transaction.buyer?.lastName}`);
        console.log(`   Seller: ${transaction.seller?.firstName} ${transaction.seller?.lastName}`);

        await Transaction.findByIdAndUpdate(transaction._id, {
          status: 'completed',
          updatedAt: new Date()
        });
        fixedCount++;
      }
    }

    console.log(`\n✅ Payment status fixes completed! Fixed ${fixedCount} payments.`);

  } catch (error) {
    console.error('❌ Error fixing payment statuses:', error);
  }
}

async function runScript() {
  console.log('🚀 Starting Payment Status Check and Fix\n');
  
  try {
    await connectDB();
    
    // Check current statuses
    await checkPaymentStatuses();
    
    // Ask if user wants to fix the statuses
    const args = process.argv.slice(2);
    if (args.includes('--fix')) {
      await fixPaymentStatuses();
      
      // Check statuses again after fix
      console.log('\n🔍 Checking statuses after fix...');
      await checkPaymentStatuses();
    } else {
      console.log('\n💡 To fix the payment statuses, run: node check-payment-statuses.js --fix');
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

module.exports = { checkPaymentStatuses, fixPaymentStatuses };
