const mongoose = require('mongoose');
require('dotenv').config();

async function testMultiUserWallet() {
  try {
    console.log('🧪 Testing multi-user wallet functionality...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/souq');
    console.log('✅ Connected to MongoDB');
    
    // Import Wallet model
    const Wallet = require('./db/models/walletModel');
    
    // Create test user IDs
    const testUsers = [
      new mongoose.Types.ObjectId(),
      new mongoose.Types.ObjectId(),
      new mongoose.Types.ObjectId()
    ];
    
    console.log('👥 Test users:', testUsers.map(id => id.toString()));
    
    // Test wallet creation for each user
    for (let i = 0; i < testUsers.length; i++) {
      const userId = testUsers[i];
      console.log(`\n🔍 Testing wallet for User ${i + 1}: ${userId}`);
      
      try {
        // Try to create wallet
        const wallet = await Wallet.findOrCreateWallet(userId);
        console.log(`  ✅ Wallet created/found: ${wallet._id}`);
        console.log(`  💰 Initial balance: USD ${wallet.balances.USD}`);
        
        // Add a test transaction
        await wallet.addTransaction({
          type: 'credit',
          amount: 100 + (i * 50), // Different amounts for each user
          currency: 'USD',
          description: `Test credit for User ${i + 1}`,
          metadata: { test: true, userId: userId.toString() }
        });
        
        console.log(`  💳 Added test transaction: USD ${100 + (i * 50)}`);
        console.log(`  📊 New balance: USD ${wallet.balances.USD}`);
        console.log(`  🆔 Transaction count: ${wallet.transactions.length}`);
        
        // Verify transaction ID is unique
        const lastTransaction = wallet.transactions[0];
        console.log(`  🔑 Transaction ID: ${lastTransaction.transactionId}`);
        
      } catch (error) {
        console.error(`  ❌ Error for User ${i + 1}:`, error.message);
      }
    }
    
    // Verify all wallets exist and are separate
    console.log('\n🔍 Verifying wallet separation...');
    const allWallets = await Wallet.find({ user: { $in: testUsers } });
    console.log(`📊 Found ${allWallets.length} wallets for ${testUsers.length} users`);
    
    for (const wallet of allWallets) {
      console.log(`  👤 User: ${wallet.user} | Balance: USD ${wallet.balances.USD} | Transactions: ${wallet.transactions.length}`);
    }
    
    // Test transaction ID uniqueness
    console.log('\n🔍 Checking transaction ID uniqueness...');
    const allTransactionIds = [];
    for (const wallet of allWallets) {
      for (const transaction of wallet.transactions) {
        allTransactionIds.push(transaction.transactionId);
      }
    }
    
    const uniqueTransactionIds = new Set(allTransactionIds);
    console.log(`📊 Total transactions: ${allTransactionIds.length}`);
    console.log(`📊 Unique transaction IDs: ${uniqueTransactionIds.size}`);
    
    if (allTransactionIds.length === uniqueTransactionIds.size) {
      console.log('✅ All transaction IDs are unique');
    } else {
      console.log('❌ Duplicate transaction IDs found');
    }
    
    console.log('\n🎉 Multi-user wallet test completed successfully!');
    
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
console.log('🚀 Starting multi-user wallet test...');
testMultiUserWallet()
  .then(() => {
    console.log('✅ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
