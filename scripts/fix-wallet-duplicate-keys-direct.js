const mongoose = require('mongoose');
require('dotenv').config();

// Import the Wallet model
const Wallet = require('../db/models/walletModel');

async function fixWalletDuplicateKeys() {
  try {
    console.log('🔧 Starting wallet duplicate key fix...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // First, let's drop the problematic index if it exists
    try {
      await Wallet.collection.dropIndex('transactions.transactionId_1');
      console.log('✅ Dropped problematic index: transactions.transactionId_1');
    } catch (indexError) {
      console.log('ℹ️ Index transactions.transactionId_1 does not exist or already dropped');
    }

    // Find all wallets
    const wallets = await Wallet.find({});
    console.log(`📊 Found ${wallets.length} wallets to check`);

    let fixedWallets = 0;
    let fixedTransactions = 0;

    for (const wallet of wallets) {
      let walletModified = false;
      const seenTransactionIds = new Set();

      console.log(`🔍 Checking wallet for user: ${wallet.user}`);

      // Check each transaction in the wallet
      for (let i = 0; i < wallet.transactions.length; i++) {
        const transaction = wallet.transactions[i];

        // Fix null or duplicate transaction IDs
        if (!transaction.transactionId || seenTransactionIds.has(transaction.transactionId)) {
          const oldId = transaction.transactionId;
          const timestamp = transaction.createdAt ? transaction.createdAt.getTime() : Date.now();
          const userPart = wallet.user.toString().slice(-6);
          const random = Math.random().toString(36).substring(2, 8).toUpperCase();
          const newId = `WTX_${timestamp}_${userPart}_${random}`;

          wallet.transactions[i].transactionId = newId;
          seenTransactionIds.add(newId);
          walletModified = true;
          fixedTransactions++;

          console.log(`  🔧 Fixed transaction ID: ${oldId || 'null'} → ${newId}`);
        } else {
          seenTransactionIds.add(transaction.transactionId);
        }
      }

      // Save wallet if modified
      if (walletModified) {
        try {
          await wallet.save();
          fixedWallets++;
          console.log(`  ✅ Saved wallet for user: ${wallet.user}`);
        } catch (saveError) {
          console.error(`  ❌ Error saving wallet for user ${wallet.user}:`, saveError.message);
        }
      }
    }

    console.log(`🎉 Wallet duplicate key fix completed!`);
    console.log(`📊 Results:`);
    console.log(`   - Wallets checked: ${wallets.length}`);
    console.log(`   - Wallets fixed: ${fixedWallets}`);
    console.log(`   - Transactions fixed: ${fixedTransactions}`);
    console.log(`   - Index dropped: true`);

    // Test wallet creation for a new user
    console.log('\n🧪 Testing wallet creation...');
    const testUserId = new mongoose.Types.ObjectId();
    
    try {
      const testWallet = await Wallet.findOrCreateWallet(testUserId);
      console.log('✅ Test wallet created successfully:', testWallet._id);
      
      // Clean up test wallet
      await Wallet.deleteOne({ _id: testWallet._id });
      console.log('🧹 Test wallet cleaned up');
    } catch (testError) {
      console.error('❌ Test wallet creation failed:', testError.message);
    }

  } catch (error) {
    console.error('❌ Error fixing wallet duplicate keys:', error);
    console.error('Stack:', error.stack);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
  }
}

// Run the fix
fixWalletDuplicateKeys()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
