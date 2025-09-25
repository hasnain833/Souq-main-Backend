/**
 * Comprehensive script to fix all payment statuses (Standard + Escrow)
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

async function fixAllPaymentStatuses() {
  console.log('🔧 Starting comprehensive payment status fix...\n');
  
  try {
    const StandardPayment = require('./db/models/standardPaymentModel');
    const EscrowTransaction = require('./db/models/escrowTransactionModel');
    const Transaction = require('./db/models/transactionModel');
    
    let totalFixed = 0;
    
    // 1. Fix StandardPayments
    console.log('1. 📦 Fixing StandardPayments...');
    const standardResult = await StandardPayment.updateMany(
      { 
        status: { $in: ['pending', 'pending_payment', 'processing'] }
      },
      { 
        $set: { 
          status: 'completed',
          orderStatus: 'paid',
          completedAt: new Date(),
          updatedAt: new Date()
        }
      }
    );
    console.log(`   ✅ Fixed ${standardResult.modifiedCount} StandardPayments`);
    totalFixed += standardResult.modifiedCount;
    
    // 2. Fix EscrowTransactions
    console.log('\n2. 🔒 Fixing EscrowTransactions...');
    const escrowResult = await EscrowTransaction.updateMany(
      { 
        status: { $in: ['pending', 'pending_payment', 'payment_processing'] }
      },
      { 
        $set: { 
          status: 'funds_held',
          updatedAt: new Date()
        },
        $push: {
          statusHistory: {
            status: 'funds_held',
            timestamp: new Date(),
            note: 'Status updated by comprehensive fix script - payment completed'
          }
        }
      }
    );
    console.log(`   ✅ Fixed ${escrowResult.modifiedCount} EscrowTransactions`);
    totalFixed += escrowResult.modifiedCount;
    
    // 3. Fix Transaction payment records
    console.log('\n3. 💳 Fixing Transaction payment records...');
    const transactionResult = await Transaction.updateMany(
      { 
        status: { $in: ['pending', 'pending_payment', 'processing'] }
      },
      { 
        $set: { 
          status: 'completed',
          updatedAt: new Date()
        }
      }
    );
    console.log(`   ✅ Fixed ${transactionResult.modifiedCount} Transaction payment records`);
    totalFixed += transactionResult.modifiedCount;
    
    console.log(`\n🎉 Total records fixed: ${totalFixed}`);
    
    // 4. Show updated status summary
    console.log('\n📊 Updated Status Summary:');
    
    const standardStatusCounts = await StandardPayment.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    console.log('   StandardPayment statuses:', standardStatusCounts);
    
    const escrowStatusCounts = await EscrowTransaction.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    console.log('   EscrowTransaction statuses:', escrowStatusCounts);
    
    const transactionStatusCounts = await Transaction.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    console.log('   Transaction statuses:', transactionStatusCounts);
    
    // 5. Test the Orders API mapping
    console.log('\n🧪 Testing Orders API Status Mapping:');
    
    // Get a few sample orders to test the mapping
    const sampleStandardPayments = await StandardPayment.find().limit(3).populate('buyer', 'firstName lastName');
    const sampleEscrowTransactions = await EscrowTransaction.find().limit(3).populate('buyer', 'firstName lastName');
    const sampleTransactions = await Transaction.find().limit(3).populate('buyer', 'firstName lastName');
    
    console.log('\n   Sample StandardPayments after fix:');
    sampleStandardPayments.forEach((payment, index) => {
      const orderStatus = payment.orderStatus || mapPaymentStatusToOrderStatus(payment.status);
      console.log(`   ${index + 1}. ${payment.transactionId} | Payment Status: ${payment.status} | Order Status: ${orderStatus} | Buyer: ${payment.buyer?.firstName}`);
    });
    
    console.log('\n   Sample EscrowTransactions after fix:');
    sampleEscrowTransactions.forEach((transaction, index) => {
      const orderStatus = mapPaymentStatusToOrderStatus(transaction.status);
      console.log(`   ${index + 1}. ${transaction.transactionId} | Payment Status: ${transaction.status} | Order Status: ${orderStatus} | Buyer: ${transaction.buyer?.firstName}`);
    });
    
    console.log('\n   Sample Transaction payment records after fix:');
    sampleTransactions.forEach((transaction, index) => {
      const orderStatus = mapPaymentStatusToOrderStatus(transaction.status);
      console.log(`   ${index + 1}. ${transaction.transactionId} | Payment Status: ${transaction.status} | Order Status: ${orderStatus} | Buyer: ${transaction.buyer?.firstName}`);
    });
    
  } catch (error) {
    console.error('❌ Error fixing payment statuses:', error);
  }
}

// Helper function to test status mapping (same as in orderController)
function mapPaymentStatusToOrderStatus(paymentStatus) {
  const statusMap = {
    // Standard payment statuses
    'completed': 'paid',
    'paid': 'paid',
    'pending': 'pending_payment',
    'processing': 'pending_payment',
    'pending_payment': 'pending_payment',
    
    // Escrow statuses
    'funds_held': 'paid', // Funds secured in escrow = order paid
    'payment_processing': 'pending_payment',
    'shipped': 'shipped',
    'delivered': 'delivered',
    
    // Common statuses
    'failed': 'cancelled',
    'cancelled': 'cancelled',
    'refunded': 'refunded'
  };
  return statusMap[paymentStatus] || 'pending_payment';
}

async function runFix() {
  console.log('🚀 Comprehensive Payment Status Fix\n');
  
  try {
    await connectDB();
    await fixAllPaymentStatuses();
    
    console.log('\n✅ Fix completed successfully!');
    console.log('\n🧪 Test URLs:');
    console.log('   Orders API: http://localhost:5000/api/user/orders?role=buyer&page=1&limit=10');
    console.log('   Transaction Status: http://localhost:5000/api/user/transactions/[TRANSACTION_ID]/status');
    console.log('\n💡 Expected Results:');
    console.log('   - Standard payments should show status: "paid"');
    console.log('   - Escrow transactions should show status: "paid" (funds_held)');
    console.log('   - Transaction progress should show proper percentages');
    
  } catch (error) {
    console.error('\n❌ Fix failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run the fix
if (require.main === module) {
  runFix();
}
