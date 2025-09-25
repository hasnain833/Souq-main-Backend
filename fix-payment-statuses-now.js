/**
 * Quick script to fix payment statuses immediately
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
  console.log('🔧 Starting payment status fix...\n');
  
  try {
    const StandardPayment = require('./db/models/standardPaymentModel');
    const EscrowTransaction = require('./db/models/escrowTransactionModel');
    const Transaction = require('./db/models/transactionModel');
    
    let totalFixed = 0;
    
    // Fix StandardPayments
    console.log('1. Fixing StandardPayments...');
    const standardResult = await StandardPayment.updateMany(
      { 
        status: { $in: ['pending', 'pending_payment', 'processing'] },
        createdAt: { $lt: new Date(Date.now() - 2 * 60 * 1000) } // Created more than 2 minutes ago
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
    console.log(`✅ Fixed ${standardResult.modifiedCount} StandardPayments`);
    totalFixed += standardResult.modifiedCount;
    
    // Fix EscrowTransactions
    console.log('\n2. Fixing EscrowTransactions...');
    const escrowResult = await EscrowTransaction.updateMany(
      { 
        status: { $in: ['pending', 'pending_payment', 'payment_processing'] },
        createdAt: { $lt: new Date(Date.now() - 2 * 60 * 1000) }
      },
      { 
        $set: { 
          status: 'funds_held',
          updatedAt: new Date()
        }
      }
    );
    console.log(`✅ Fixed ${escrowResult.modifiedCount} EscrowTransactions`);
    totalFixed += escrowResult.modifiedCount;
    
    // Fix Transaction payment records
    console.log('\n3. Fixing Transaction payment records...');
    const transactionResult = await Transaction.updateMany(
      { 
        status: { $in: ['pending', 'pending_payment', 'processing'] },
        createdAt: { $lt: new Date(Date.now() - 2 * 60 * 1000) }
      },
      { 
        $set: { 
          status: 'completed',
          updatedAt: new Date()
        }
      }
    );
    console.log(`✅ Fixed ${transactionResult.modifiedCount} Transaction payment records`);
    totalFixed += transactionResult.modifiedCount;
    
    console.log(`\n🎉 Total payments fixed: ${totalFixed}`);
    
    // Show updated status counts
    console.log('\n📊 Updated Status Summary:');
    
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
    console.error('❌ Error fixing payment statuses:', error);
  }
}

async function runFix() {
  console.log('🚀 Payment Status Fix Script\n');
  
  try {
    await connectDB();
    await fixAllPaymentStatuses();
    console.log('\n✅ Fix completed successfully!');
    console.log('\n💡 Now test the orders API: http://localhost:5000/api/user/orders?role=buyer&page=1&limit=10');
    
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
