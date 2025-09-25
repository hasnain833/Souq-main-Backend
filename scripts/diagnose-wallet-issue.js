const mongoose = require('mongoose');
require('dotenv').config();

const diagnoseWalletIssue = async () => {
  try {
    console.log('🔍 Diagnosing wallet issue...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/souq', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const walletsCollection = db.collection('wallets');
    
    // Check current indexes
    console.log('\n📋 Current wallet indexes:');
    const indexes = await walletsCollection.indexes();
    indexes.forEach(index => {
      console.log(`   - ${JSON.stringify(index.key)} (${index.name}) ${index.sparse ? '[SPARSE]' : ''} ${index.unique ? '[UNIQUE]' : ''}`);
    });
    
    // Count total wallets
    const totalWallets = await walletsCollection.countDocuments();
    console.log(`\n📊 Total wallets in database: ${totalWallets}`);
    
    // Check for wallets with empty transactions
    const walletsWithEmptyTransactions = await walletsCollection.countDocuments({
      $or: [
        { transactions: { $exists: false } },
        { transactions: { $size: 0 } }
      ]
    });
    console.log(`📊 Wallets with empty transactions: ${walletsWithEmptyTransactions}`);
    
    // Check for wallets with transactions
    const walletsWithTransactions = await walletsCollection.countDocuments({
      transactions: { $exists: true, $not: { $size: 0 } }
    });
    console.log(`📊 Wallets with transactions: ${walletsWithTransactions}`);
    
    // Sample a few wallets to see their structure
    console.log('\n🔍 Sample wallet structures:');
    const sampleWallets = await walletsCollection.find({}).limit(3).toArray();
    sampleWallets.forEach((wallet, index) => {
      console.log(`\nWallet ${index + 1}:`);
      console.log(`   ID: ${wallet._id}`);
      console.log(`   User: ${wallet.user}`);
      console.log(`   Transactions count: ${wallet.transactions ? wallet.transactions.length : 0}`);
      if (wallet.transactions && wallet.transactions.length > 0) {
        console.log(`   First transaction ID: ${wallet.transactions[0].transactionId || 'NULL'}`);
      }
    });
    
    console.log('\n🎯 Diagnosis complete!');
    
  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
    console.error('Error details:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('📝 Database connection closed');
    process.exit(0);
  }
};

// Run the diagnosis
diagnoseWalletIssue();
