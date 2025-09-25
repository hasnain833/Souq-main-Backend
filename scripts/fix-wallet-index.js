const mongoose = require('mongoose');
require('dotenv').config();

const fixWalletIndex = async () => {
  try {
    console.log('🔧 Starting wallet index fix...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/souq', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const walletsCollection = db.collection('wallets');
    
    // Get current indexes
    console.log('📋 Current indexes:');
    const indexes = await walletsCollection.indexes();
    indexes.forEach(index => {
      console.log(`   - ${JSON.stringify(index.key)} (${index.name})`);
    });
    
    // Check if the problematic index exists
    const problematicIndex = indexes.find(index => 
      index.key && index.key['transactions.transactionId'] === 1 && !index.sparse
    );
    
    if (problematicIndex) {
      console.log(`🗑️ Dropping problematic index: ${problematicIndex.name}`);
      await walletsCollection.dropIndex(problematicIndex.name);
      console.log('✅ Problematic index dropped');
    } else {
      console.log('ℹ️ No problematic index found');
    }
    
    // Create the sparse index
    console.log('🔨 Creating sparse index for transactions.transactionId...');
    await walletsCollection.createIndex(
      { 'transactions.transactionId': 1 }, 
      { 
        sparse: true,
        name: 'transactions.transactionId_1_sparse'
      }
    );
    console.log('✅ Sparse index created successfully');
    
    // Verify the new indexes
    console.log('📋 Updated indexes:');
    const updatedIndexes = await walletsCollection.indexes();
    updatedIndexes.forEach(index => {
      console.log(`   - ${JSON.stringify(index.key)} (${index.name}) ${index.sparse ? '[SPARSE]' : ''}`);
    });
    
    // Test wallet creation
    console.log('🧪 Testing wallet creation...');
    const Wallet = require('../db/models/walletModel');
    
    // Create a test user ID
    const testUserId = new mongoose.Types.ObjectId();
    
    // Try to create a wallet
    const testWallet = await Wallet.findOrCreateWallet(testUserId);
    console.log('✅ Test wallet created successfully:', testWallet._id);
    
    // Clean up test wallet
    await Wallet.deleteOne({ _id: testWallet._id });
    console.log('🧹 Test wallet cleaned up');
    
    console.log('🎉 Wallet index fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing wallet index:', error);
    console.error('Error details:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
  } finally {
    await mongoose.connection.close();
    console.log('📝 Database connection closed');
    process.exit(0);
  }
};

// Run the fix
fixWalletIndex();
