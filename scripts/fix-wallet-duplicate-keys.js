const mongoose = require('mongoose');
require('dotenv').config();

async function fixWalletDuplicateKeys() {
  try {
    console.log('🔧 Starting wallet duplicate key fix...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    // Get the Wallet model
    const Wallet = require('../db/models/walletModel');
    
    console.log('🔍 Finding wallets with duplicate or null transaction IDs...');
    
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
    
    console.log('\n📊 Fix Summary:');
    console.log(`  - Wallets checked: ${wallets.length}`);
    console.log(`  - Wallets fixed: ${fixedWallets}`);
    console.log(`  - Transactions fixed: ${fixedTransactions}`);
    
    // Drop the problematic index if it exists
    console.log('\n🗑️ Dropping problematic index...');
    try {
      await mongoose.connection.db.collection('wallets').dropIndex('transactions.transactionId_1');
      console.log('✅ Dropped transactions.transactionId_1 index');
    } catch (indexError) {
      if (indexError.message.includes('index not found')) {
        console.log('ℹ️ Index transactions.transactionId_1 not found (already dropped)');
      } else {
        console.error('❌ Error dropping index:', indexError.message);
      }
    }
    
    console.log('\n🎉 Wallet duplicate key fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing wallet duplicate keys:', error);
    console.error('Stack:', error.stack);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('🔌 Disconnected from MongoDB');
    }
  }
}

// Run the fix
console.log('🚀 Starting wallet duplicate key fix script...');
fixWalletDuplicateKeys()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
