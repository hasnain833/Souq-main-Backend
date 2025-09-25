const mongoose = require('mongoose');
require('dotenv').config();

async function cleanupOldFields() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/souq');
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const ratingsCollection = db.collection('ratings');

    // 1. Remove the old 'transaction' field from all documents
    console.log('🧹 Removing old transaction field from all ratings...');
    
    const updateResult = await ratingsCollection.updateMany(
      { transaction: { $exists: true } },
      { $unset: { transaction: 1 } }
    );
    
    console.log(`✅ Updated ${updateResult.modifiedCount} documents`);

    // 2. Drop the old transaction index if it still exists
    try {
      await ratingsCollection.dropIndex('transaction_1');
      console.log('✅ Dropped transaction_1 index');
    } catch (error) {
      console.log('⚠️ Index transaction_1 not found or already dropped');
    }

    // 3. Verify no documents have the old field
    const documentsWithOldField = await ratingsCollection.countDocuments({
      transaction: { $exists: true }
    });
    
    console.log(`📊 Documents with old transaction field: ${documentsWithOldField}`);

    // 4. List current indexes
    console.log('📋 Current indexes:');
    const indexes = await ratingsCollection.listIndexes().toArray();
    indexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });

    console.log('🎉 Cleanup completed successfully!');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

// Run the script
cleanupOldFields();
