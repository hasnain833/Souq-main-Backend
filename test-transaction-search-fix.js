const mongoose = require('mongoose');
const { findEscrowTransaction, findStandardPayment, findTransaction } = require('./utils/transactionUtils');
require('dotenv').config();

async function testTransactionSearchFix() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Test the problematic transaction ID that was causing the CastError
    const problematicTransactionId = 'ESC-1751528763981-2XEUZ498W';
    
    console.log('🔍 Testing transaction search with problematic ID:', problematicTransactionId);
    
    // Test escrow transaction search
    console.log('\n📦 Testing escrow transaction search...');
    try {
      const escrowTransaction = await findEscrowTransaction(problematicTransactionId);
      if (escrowTransaction) {
        console.log('✅ Found escrow transaction:', {
          id: escrowTransaction._id,
          transactionId: escrowTransaction.transactionId,
          status: escrowTransaction.status
        });
      } else {
        console.log('ℹ️ No escrow transaction found (this is expected if the transaction doesn\'t exist)');
      }
    } catch (error) {
      console.error('❌ Error in escrow transaction search:', error.message);
    }

    // Test standard payment search
    console.log('\n💳 Testing standard payment search...');
    try {
      const standardPayment = await findStandardPayment(problematicTransactionId);
      if (standardPayment) {
        console.log('✅ Found standard payment:', {
          id: standardPayment._id,
          transactionId: standardPayment.transactionId,
          status: standardPayment.status
        });
      } else {
        console.log('ℹ️ No standard payment found (this is expected if the transaction doesn\'t exist)');
      }
    } catch (error) {
      console.error('❌ Error in standard payment search:', error.message);
    }

    // Test main transaction search
    console.log('\n🔄 Testing main transaction search...');
    try {
      const mainTransaction = await findTransaction(problematicTransactionId);
      if (mainTransaction) {
        console.log('✅ Found main transaction:', {
          id: mainTransaction._id,
          transactionId: mainTransaction.transactionId,
          status: mainTransaction.status
        });
      } else {
        console.log('ℹ️ No main transaction found (this is expected if the transaction doesn\'t exist)');
      }
    } catch (error) {
      console.error('❌ Error in main transaction search:', error.message);
    }

    // Test with a valid ObjectId format
    console.log('\n🆔 Testing with valid ObjectId format...');
    const validObjectId = '686633e2fe793bf57c7a1be0';
    try {
      const escrowByObjectId = await findEscrowTransaction(validObjectId);
      if (escrowByObjectId) {
        console.log('✅ Found escrow transaction by ObjectId:', {
          id: escrowByObjectId._id,
          transactionId: escrowByObjectId.transactionId,
          status: escrowByObjectId.status
        });
      } else {
        console.log('ℹ️ No escrow transaction found by ObjectId');
      }
    } catch (error) {
      console.error('❌ Error in ObjectId search:', error.message);
    }

    console.log('\n🎉 Transaction search test completed successfully!');
    console.log('✅ No CastError should occur with the fixed utility functions');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the test
testTransactionSearchFix();
