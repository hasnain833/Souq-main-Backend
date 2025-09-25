const mongoose = require('mongoose');
require('dotenv').config();

const quickWalletFix = async () => {
  try {
    console.log('🚀 Quick wallet fix starting...');

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/souq';
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const walletsCollection = db.collection('wallets');

    // Get current indexes first
    console.log('📋 Current indexes:');
    const currentIndexes = await walletsCollection.indexes();
    currentIndexes.forEach(index => {
      const keyStr = JSON.stringify(index.key);
      const flags = [];
      if (index.sparse) flags.push('SPARSE');
      if (index.unique) flags.push('UNIQUE');
      const flagStr = flags.length > 0 ? ` [${flags.join(', ')}]` : '';
      console.log(`   - ${keyStr} (${index.name})${flagStr}`);
    });

    // Drop all problematic transaction-related indexes
    const problematicIndexNames = [
      'transactions.transactionId_1',
      'transactions.transactionId_1_sparse'
    ];

    for (const indexName of problematicIndexNames) {
      try {
        console.log(`🗑️ Attempting to drop index: ${indexName}`);
        await walletsCollection.dropIndex(indexName);
        console.log(`✅ Dropped ${indexName} index`);
      } catch (error) {
        if (error.message.includes('index not found')) {
          console.log(`ℹ️ Index ${indexName} not found (already dropped or doesn't exist)`);
        } else {
          console.log(`⚠️ Error dropping ${indexName}:`, error.message);
        }
      }
    }

    // Create the correct sparse index
    try {
      console.log('🔨 Creating new sparse index...');
      await walletsCollection.createIndex(
        { 'transactions.transactionId': 1 },
        {
          sparse: true,
          name: 'transactions_transactionId_sparse'
        }
      );
      console.log('✅ Created sparse index successfully');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('ℹ️ Sparse index already exists');
      } else {
        console.log('⚠️ Error creating sparse index:', error.message);
      }
    }
    
    // Verify updated indexes
    console.log('\n📋 Updated indexes:');
    const indexes = await walletsCollection.indexes();
    indexes.forEach(index => {
      const keyStr = JSON.stringify(index.key);
      const flags = [];
      if (index.sparse) flags.push('SPARSE');
      if (index.unique) flags.push('UNIQUE');
      const flagStr = flags.length > 0 ? ` [${flags.join(', ')}]` : '';
      console.log(`   - ${keyStr} (${index.name})${flagStr}`);
    });

    // Test wallet creation
    console.log('\n🧪 Testing wallet creation...');
    const Wallet = require('../db/models/walletModel');

    // Create multiple test user IDs to test for duplicate key issues
    const testUserIds = [
      new mongoose.Types.ObjectId(),
      new mongoose.Types.ObjectId(),
      new mongoose.Types.ObjectId()
    ];

    const createdWallets = [];

    for (let i = 0; i < testUserIds.length; i++) {
      try {
        console.log(`🧪 Creating test wallet ${i + 1}...`);
        const testWallet = await Wallet.findOrCreateWallet(testUserIds[i]);
        console.log(`✅ Test wallet ${i + 1} created successfully:`, testWallet._id);
        createdWallets.push(testWallet._id);
      } catch (error) {
        console.error(`❌ Failed to create test wallet ${i + 1}:`, error.message);
        throw error;
      }
    }

    // Clean up test wallets
    console.log('🧹 Cleaning up test wallets...');
    for (const walletId of createdWallets) {
      await Wallet.deleteOne({ _id: walletId });
    }
    console.log('🧹 Test wallets cleaned up');

    console.log('\n🎉 Quick wallet fix completed successfully!');
    console.log('💡 You can now test the wallet API: GET /api/user/wallet');
    console.log('💡 Multiple wallet creation test passed - no duplicate key errors!');
    
  } catch (error) {
    console.error('❌ Error during quick fix:', error);
    console.error('Error details:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('📝 Database connection closed');
    process.exit(0);
  }
};

// Run the quick fix
quickWalletFix();
