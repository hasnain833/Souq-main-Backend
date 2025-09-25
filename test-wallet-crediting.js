const mongoose = require('mongoose');
require('dotenv').config();

async function testWalletCrediting() {
  try {
    console.log('🧪 Testing wallet crediting functionality...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/souq');
    console.log('✅ Connected to MongoDB');
    
    // Import required modules
    const Wallet = require('./db/models/walletModel');
    const { creditWalletExternal } = require('./utils/walletUtils');
    
    // Create a test user
    const testUserId = new mongoose.Types.ObjectId();
    console.log('👤 Test user ID:', testUserId.toString());
    
    // Test 1: Check initial wallet state
    console.log('\n🔍 Test 1: Checking initial wallet state...');
    let wallet = await Wallet.findOne({ user: testUserId });
    console.log('Initial wallet:', wallet ? 'exists' : 'does not exist');
    
    // Test 2: Credit wallet using creditWalletExternal
    console.log('\n💰 Test 2: Crediting wallet with creditWalletExternal...');
    const creditAmount = 150.75;
    const currency = 'USD';
    const description = 'Test payment completion';
    
    console.log(`Crediting: ${currency} ${creditAmount}`);
    
    const creditResult = await creditWalletExternal(
      testUserId,
      creditAmount,
      currency,
      description,
      {
        metadata: {
          test: true,
          transactionType: 'escrow',
          originalAmount: creditAmount
        }
      }
    );
    
    console.log('Credit result:', creditResult);
    
    if (creditResult.success) {
      console.log('✅ Wallet credited successfully');
      console.log(`💰 New balance: ${currency} ${creditResult.newBalance}`);
    } else {
      console.error('❌ Failed to credit wallet:', creditResult.error);
      return;
    }
    
    // Test 3: Verify wallet balance
    console.log('\n🔍 Test 3: Verifying wallet balance...');
    wallet = await Wallet.findOne({ user: testUserId });
    
    if (wallet) {
      console.log(`📊 Wallet balance: ${currency} ${wallet.balances[currency]}`);
      console.log(`📊 Transaction count: ${wallet.transactions.length}`);
      
      if (wallet.transactions.length > 0) {
        const lastTransaction = wallet.transactions[0];
        console.log('📋 Last transaction:');
        console.log(`  - Type: ${lastTransaction.type}`);
        console.log(`  - Amount: ${lastTransaction.currency} ${lastTransaction.amount}`);
        console.log(`  - Description: ${lastTransaction.description}`);
        console.log(`  - Transaction ID: ${lastTransaction.transactionId}`);
        console.log(`  - Balance After: ${lastTransaction.currency} ${lastTransaction.balanceAfter}`);
      }
      
      // Verify the balance matches our credit amount
      if (wallet.balances[currency] === creditAmount) {
        console.log('✅ Balance verification successful');
      } else {
        console.error(`❌ Balance mismatch: Expected ${creditAmount}, Got ${wallet.balances[currency]}`);
      }
    } else {
      console.error('❌ Wallet not found after crediting');
    }
    
    // Test 4: Credit again to test accumulation
    console.log('\n💰 Test 4: Testing balance accumulation...');
    const secondCreditAmount = 50.25;
    
    const secondCreditResult = await creditWalletExternal(
      testUserId,
      secondCreditAmount,
      currency,
      'Second test payment',
      {
        metadata: {
          test: true,
          transactionType: 'standard'
        }
      }
    );
    
    if (secondCreditResult.success) {
      console.log('✅ Second credit successful');
      console.log(`💰 New balance: ${currency} ${secondCreditResult.newBalance}`);
      
      const expectedTotal = creditAmount + secondCreditAmount;
      if (Math.abs(secondCreditResult.newBalance - expectedTotal) < 0.01) {
        console.log('✅ Balance accumulation verified');
      } else {
        console.error(`❌ Balance accumulation failed: Expected ${expectedTotal}, Got ${secondCreditResult.newBalance}`);
      }
    } else {
      console.error('❌ Second credit failed:', secondCreditResult.error);
    }
    
    // Test 5: Verify final state
    console.log('\n🔍 Test 5: Final wallet state...');
    wallet = await Wallet.findOne({ user: testUserId });
    
    if (wallet) {
      console.log(`📊 Final balance: ${currency} ${wallet.balances[currency]}`);
      console.log(`📊 Total transactions: ${wallet.transactions.length}`);
      console.log(`📊 Statistics - Total earned: ${wallet.statistics.totalEarned || 0}`);
      console.log(`📊 Statistics - Transaction count: ${wallet.statistics.totalTransactions || 0}`);
    }
    
    console.log('\n🎉 Wallet crediting test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack:', error.stack);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('🔌 Disconnected from MongoDB');
    }
  }
}

// Run the test
console.log('🚀 Starting wallet crediting test...');
testWalletCrediting()
  .then(() => {
    console.log('✅ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
