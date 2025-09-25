/**
 * Quick fix for escrow transaction statuses
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

async function fixEscrowStatusesNow() {
  console.log('🔧 Fixing escrow transaction statuses...\n');
  
  try {
    const EscrowTransaction = require('./db/models/escrowTransactionModel');
    const Transaction = require('./db/models/transactionModel');
    
    // 1. Fix EscrowTransaction records
    console.log('1. 🔒 Fixing EscrowTransaction records...');
    
    const escrowBefore = await EscrowTransaction.find();
    console.log('   Current EscrowTransaction statuses:');
    escrowBefore.forEach((tx, i) => {
      console.log(`   ${i+1}. ${tx.transactionId} | Status: ${tx.status} | Created: ${tx.createdAt}`);
    });
    
    const escrowResult = await EscrowTransaction.updateMany(
      { 
        status: { $in: ['pending', 'pending_payment', 'payment_processing'] }
      },
      { 
        $set: { 
          status: 'funds_held',
          updatedAt: new Date()
        }
      }
    );
    console.log(`   ✅ Updated ${escrowResult.modifiedCount} EscrowTransaction records`);
    
    // 2. Fix Transaction payment records
    console.log('\n2. 💳 Fixing Transaction payment records...');
    
    const transactionsBefore = await Transaction.find();
    console.log('   Current Transaction payment record statuses:');
    transactionsBefore.forEach((tx, i) => {
      console.log(`   ${i+1}. ${tx.transactionId} | Status: ${tx.status} | Created: ${tx.createdAt}`);
    });
    
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
    console.log(`   ✅ Updated ${transactionResult.modifiedCount} Transaction payment records`);
    
    // 3. Show final status
    console.log('\n📊 Final Status Summary:');
    
    const escrowAfter = await EscrowTransaction.find();
    console.log('   EscrowTransaction records after fix:');
    escrowAfter.forEach((tx, i) => {
      console.log(`   ${i+1}. ${tx.transactionId} | Status: ${tx.status} | Updated: ${tx.updatedAt}`);
    });
    
    const transactionsAfter = await Transaction.find();
    console.log('   Transaction payment records after fix:');
    transactionsAfter.forEach((tx, i) => {
      console.log(`   ${i+1}. ${tx.transactionId} | Status: ${tx.status} | Updated: ${tx.updatedAt}`);
    });
    
    console.log(`\n🎉 Total fixed: ${escrowResult.modifiedCount + transactionResult.modifiedCount} records`);
    
  } catch (error) {
    console.error('❌ Error fixing escrow statuses:', error);
  }
}

async function runFix() {
  console.log('🚀 Escrow Status Fix\n');
  
  try {
    await connectDB();
    await fixEscrowStatusesNow();
    
    console.log('\n✅ Fix completed!');
    console.log('\n🧪 Test the escrow orders now:');
    console.log('   1. Refresh the OrderDetails page');
    console.log('   2. Check Orders API: http://localhost:5000/api/user/orders?role=buyer&page=1&limit=10');
    console.log('   3. Escrow orders should now show "paid" status instead of "pending_payment"');
    
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
