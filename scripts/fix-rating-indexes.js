const mongoose = require('mongoose');
require('dotenv').config();

async function fixRatingIndexes() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/souq');
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const ratingsCollection = db.collection('ratings');

    // 1. Drop old indexes that reference the 'transaction' field
    console.log('🔧 Dropping old indexes...');
    
    try {
      await ratingsCollection.dropIndex('transaction_1_ratedBy_1_ratingType_1');
      console.log('✅ Dropped transaction_1_ratedBy_1_ratingType_1 index');
    } catch (error) {
      console.log('⚠️ Index transaction_1_ratedBy_1_ratingType_1 not found or already dropped');
    }

    try {
      await ratingsCollection.dropIndex('transaction_1_ratingType_1');
      console.log('✅ Dropped transaction_1_ratingType_1 index');
    } catch (error) {
      console.log('⚠️ Index transaction_1_ratingType_1 not found or already dropped');
    }

    // 2. Remove any existing ratings that have null transaction fields
    console.log('🧹 Cleaning up invalid ratings...');
    
    const deleteResult = await ratingsCollection.deleteMany({
      $and: [
        { transaction: null },
        { escrowTransaction: null },
        { standardPayment: null }
      ]
    });
    
    console.log(`🗑️ Deleted ${deleteResult.deletedCount} invalid ratings`);

    // 3. Update any ratings that have the old 'transaction' field to use proper fields
    console.log('🔄 Updating existing ratings...');
    
    const ratingsWithOldField = await ratingsCollection.find({ 
      transaction: { $exists: true, $ne: null } 
    }).toArray();
    
    console.log(`📊 Found ${ratingsWithOldField.length} ratings with old transaction field`);

    for (const rating of ratingsWithOldField) {
      // Try to determine if this was an escrow or standard transaction
      // For now, we'll assume they're escrow transactions since that's what we're working with
      await ratingsCollection.updateOne(
        { _id: rating._id },
        {
          $set: { escrowTransaction: rating.transaction },
          $unset: { transaction: 1 }
        }
      );
    }

    console.log(`✅ Updated ${ratingsWithOldField.length} ratings`);

    // 4. Create new indexes
    console.log('🔧 Creating new indexes...');
    
    // Escrow transaction indexes
    await ratingsCollection.createIndex(
      { escrowTransaction: 1, ratedBy: 1, ratingType: 1 },
      { 
        unique: true,
        partialFilterExpression: { escrowTransaction: { $exists: true } },
        name: 'escrowTransaction_1_ratedBy_1_ratingType_1'
      }
    );
    console.log('✅ Created escrowTransaction_1_ratedBy_1_ratingType_1 index');

    // Standard payment indexes
    await ratingsCollection.createIndex(
      { standardPayment: 1, ratedBy: 1, ratingType: 1 },
      { 
        unique: true,
        partialFilterExpression: { standardPayment: { $exists: true } },
        name: 'standardPayment_1_ratedBy_1_ratingType_1'
      }
    );
    console.log('✅ Created standardPayment_1_ratedBy_1_ratingType_1 index');

    // Other performance indexes
    await ratingsCollection.createIndex(
      { escrowTransaction: 1, ratingType: 1 },
      { name: 'escrowTransaction_1_ratingType_1' }
    );
    console.log('✅ Created escrowTransaction_1_ratingType_1 index');

    await ratingsCollection.createIndex(
      { standardPayment: 1, ratingType: 1 },
      { name: 'standardPayment_1_ratingType_1' }
    );
    console.log('✅ Created standardPayment_1_ratingType_1 index');

    // 5. List all current indexes
    console.log('📋 Current indexes:');
    const indexes = await ratingsCollection.listIndexes().toArray();
    indexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });

    console.log('🎉 Rating indexes fixed successfully!');

  } catch (error) {
    console.error('❌ Error fixing rating indexes:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

// Run the script
fixRatingIndexes();
