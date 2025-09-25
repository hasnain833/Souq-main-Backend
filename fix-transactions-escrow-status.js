/**
 * Fix transactions collection for successful escrow payments
 * Updates pending_payment status to proper completed status with orderStatus paid
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

async function fixTransactionsEscrowStatus() {
  console.log('🔧 Fixing transactions collection for successful escrow payments...\n');
  
  try {
    const Transaction = require('./db/models/transactionModel');
    const EscrowTransaction = require('./db/models/escrowTransactionModel');
    
    console.log('1. 🔍 Finding transactions that need status updates...');
    
    // Find Transaction records that are linked to escrow transactions
    const pendingTransactions = await Transaction.find({
      escrowTransaction: { $exists: true, $ne: null },
      $or: [
        { status: 'pending_payment' },
        { status: 'pending' },
        { status: 'processing' },
        { orderStatus: { $exists: false } }, // Missing orderStatus field
        { orderStatus: 'pending_payment' }
      ]
    }).populate({
      path: 'escrowTransaction',
      select: 'status transactionId totalAmount currency'
    });

    console.log(`   Found ${pendingTransactions.length} transactions to check`);

    if (pendingTransactions.length === 0) {
      console.log('✅ No transactions need updating');
      return;
    }

    let updated = 0;
    let alreadyCorrect = 0;

    for (const transaction of pendingTransactions) {
      console.log(`\n📋 Processing Transaction: ${transaction.transactionId}`);
      console.log(`   Current Status: ${transaction.status}`);
      console.log(`   Current Order Status: ${transaction.orderStatus || 'not set'}`);
      
      if (transaction.escrowTransaction) {
        const escrowStatus = transaction.escrowTransaction.status;
        console.log(`   Escrow Status: ${escrowStatus}`);
        
        // Update based on escrow status
        let shouldUpdate = false;
        let newStatus = transaction.status;
        let newOrderStatus = transaction.orderStatus;

        if (escrowStatus === 'funds_held') {
          // Escrow payment is successful - funds are held
          if (transaction.status !== 'completed' || transaction.orderStatus !== 'paid') {
            newStatus = 'completed';
            newOrderStatus = 'paid';
            shouldUpdate = true;
          } else {
            alreadyCorrect++;
            console.log('   ✅ Already correct');
          }
        } else if (escrowStatus === 'completed') {
          // Escrow transaction is fully completed
          if (transaction.status !== 'completed' || transaction.orderStatus !== 'paid') {
            newStatus = 'completed';
            newOrderStatus = 'paid';
            shouldUpdate = true;
          } else {
            alreadyCorrect++;
            console.log('   ✅ Already correct');
          }
        } else if (escrowStatus === 'shipped') {
          // Item has been shipped
          if (transaction.status !== 'completed' || transaction.orderStatus !== 'shipped') {
            newStatus = 'completed';
            newOrderStatus = 'shipped';
            shouldUpdate = true;
          } else {
            alreadyCorrect++;
            console.log('   ✅ Already correct');
          }
        } else if (escrowStatus === 'delivered') {
          // Item has been delivered
          if (transaction.status !== 'completed' || transaction.orderStatus !== 'delivered') {
            newStatus = 'completed';
            newOrderStatus = 'delivered';
            shouldUpdate = true;
          } else {
            alreadyCorrect++;
            console.log('   ✅ Already correct');
          }
        } else if (escrowStatus === 'payment_processing') {
          // Still processing - leave as is
          console.log('   ⏳ Payment still processing - no update needed');
          continue;
        } else {
          console.log(`   ⚠️ Unknown escrow status: ${escrowStatus} - skipping`);
          continue;
        }

        if (shouldUpdate) {
          console.log(`   🔄 Updating: ${transaction.status} → ${newStatus}, orderStatus → ${newOrderStatus}`);
          
          // Update the transaction
          await Transaction.findByIdAndUpdate(transaction._id, {
            status: newStatus,
            orderStatus: newOrderStatus,
            updatedAt: new Date()
          });

          updated++;
          console.log('   ✅ Updated successfully');
        }
      } else {
        console.log('   ⚠️ No linked escrow transaction found');
      }
    }

    console.log('\n📊 Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Transactions updated: ${updated}`);
    console.log(`✅ Already correct: ${alreadyCorrect}`);
    console.log(`📋 Total processed: ${pendingTransactions.length}`);

    if (updated > 0) {
      console.log('\n🎉 SUCCESS: Transactions collection has been updated!');
      console.log('\n💡 What was fixed:');
      console.log('   ✅ Transaction records now have correct status based on escrow payment status');
      console.log('   ✅ Order list API will show "paid" instead of "pending_payment" for successful escrow payments');
      console.log('   ✅ Status mapping is now consistent between EscrowTransaction and Transaction records');
    } else {
      console.log('\n✅ All transactions were already in the correct state');
    }

  } catch (error) {
    console.error('❌ Error fixing transactions:', error);
  }
}

async function showCurrentTransactionStatuses() {
  console.log('\n📊 Current Transaction Status Summary:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const Transaction = require('./db/models/transactionModel');
    
    // Get status counts for escrow-linked transactions
    const statusCounts = await Transaction.aggregate([
      {
        $match: {
          escrowTransaction: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: {
            status: '$status',
            orderStatus: '$orderStatus'
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.status': 1, '_id.orderStatus': 1 }
      }
    ]);

    console.log('Escrow-linked Transaction statuses:');
    statusCounts.forEach(item => {
      console.log(`   ${item._id.status} / ${item._id.orderStatus || 'not set'}: ${item.count}`);
    });

    // Get total counts
    const totalEscrowTransactions = await Transaction.countDocuments({
      escrowTransaction: { $exists: true, $ne: null }
    });

    console.log(`\nTotal escrow-linked transactions: ${totalEscrowTransactions}`);

  } catch (error) {
    console.error('Error getting status summary:', error);
  }
}

async function main() {
  console.log('🚀 Fix Transactions Collection for Escrow Payments');
  console.log('================================================\n');
  console.log('This script fixes Transaction records in the "transactions" collection');
  console.log('to have the correct status when escrow payments are successful.\n');
  console.log('According to memory requirements:');
  console.log('- Escrow "funds_held" → Transaction status "completed" + orderStatus "paid"');
  console.log('- This ensures order list API shows "paid" instead of "pending_payment"');
  console.log('- Maintains consistency between EscrowTransaction and Transaction records\n');
  console.log('==================================================\n');
  
  await connectDB();
  
  // Show current status before fix
  await showCurrentTransactionStatuses();
  
  // Apply the fix
  await fixTransactionsEscrowStatus();
  
  // Show status after fix
  console.log('\n==================================================');
  console.log('📊 AFTER FIX:');
  await showCurrentTransactionStatuses();
  
  console.log('\n💡 Next Steps:');
  console.log('1. Test the order list API: /api/user/orders?role=buyer');
  console.log('2. Verify escrow orders now show "paid" status instead of "pending_payment"');
  console.log('3. Check that payment success pages display correctly');
  console.log('4. The fix ensures future escrow payments will work automatically');
  
  process.exit(0);
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Script error:', error);
    process.exit(1);
  });
}

module.exports = { fixTransactionsEscrowStatus };