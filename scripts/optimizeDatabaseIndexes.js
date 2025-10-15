require('dotenv').config();
const mongoose = require('mongoose');
const { INDEX_RECOMMENDATIONS } = require('../utils/performanceOptimizations');

/**
 * Database index optimization script
 * Run this script to create recommended indexes for better performance
 */
async function optimizeDatabaseIndexes() {
  try {
    console.log('🔄 Connecting to database...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to database');

    const db = mongoose.connection.db;

    // Optimize Product collection indexes
    console.log('📦 Optimizing Product collection indexes...');
    const productCollection = db.collection('products');
    
    for (const index of INDEX_RECOMMENDATIONS.products) {
      try {
        await productCollection.createIndex(index, { background: true });
        console.log(`✅ Created index: ${JSON.stringify(index)}`);
      } catch (error) {
        if (error.code === 85) { // Index already exists
          console.log(`ℹ️ Index already exists: ${JSON.stringify(index)}`);
        } else {
          console.error(`❌ Failed to create index ${JSON.stringify(index)}:`, error.message);
        }
      }
    }

    // Optimize User collection indexes
    console.log('👤 Optimizing User collection indexes...');
    const userCollection = db.collection('users');
    
    for (const index of INDEX_RECOMMENDATIONS.users) {
      try {
        await userCollection.createIndex(index, { background: true });
        console.log(`✅ Created index: ${JSON.stringify(index)}`);
      } catch (error) {
        if (error.code === 85) { // Index already exists
          console.log(`ℹ️ Index already exists: ${JSON.stringify(index)}`);
        } else {
          console.error(`❌ Failed to create index ${JSON.stringify(index)}:`, error.message);
        }
      }
    }

    // Optimize Category collection indexes
    console.log('📂 Optimizing Category collection indexes...');
    const categoryCollection = db.collection('categories');
    
    for (const index of INDEX_RECOMMENDATIONS.categories) {
      try {
        await categoryCollection.createIndex(index, { background: true });
        console.log(`✅ Created index: ${JSON.stringify(index)}`);
      } catch (error) {
        if (error.code === 85) { // Index already exists
          console.log(`ℹ️ Index already exists: ${JSON.stringify(index)}`);
        } else {
          console.error(`❌ Failed to create index ${JSON.stringify(index)}:`, error.message);
        }
      }
    }

    // Additional performance indexes
    console.log('🚀 Creating additional performance indexes...');
    
    // Wallet collection indexes
    try {
      const walletCollection = db.collection('wallets');
      await walletCollection.createIndex({ user: 1, 'transactions.createdAt': -1 }, { background: true });
      await walletCollection.createIndex({ 'transactions.type': 1 }, { background: true });
      console.log('✅ Created wallet indexes');
    } catch (error) {
      console.log(`ℹ️ Wallet indexes: ${error.message}`);
    }

    // Rating collection indexes
    try {
      const ratingCollection = db.collection('ratings');
      await ratingCollection.createIndex({ ratedUser: 1, createdAt: -1 }, { background: true });
      await ratingCollection.createIndex({ rater: 1, createdAt: -1 }, { background: true });
      console.log('✅ Created rating indexes');
    } catch (error) {
      console.log(`ℹ️ Rating indexes: ${error.message}`);
    }

    // Order collection indexes
    try {
      const orderCollection = db.collection('orders');
      await orderCollection.createIndex({ buyer: 1, createdAt: -1 }, { background: true });
      await orderCollection.createIndex({ seller: 1, createdAt: -1 }, { background: true });
      await orderCollection.createIndex({ status: 1, createdAt: -1 }, { background: true });
      console.log('✅ Created order indexes');
    } catch (error) {
      console.log(`ℹ️ Order indexes: ${error.message}`);
    }

    // StandardPayment collection indexes
    try {
      const paymentCollection = db.collection('standardpayments');
      await paymentCollection.createIndex({ buyer: 1, createdAt: -1 }, { background: true });
      await paymentCollection.createIndex({ seller: 1, createdAt: -1 }, { background: true });
      await paymentCollection.createIndex({ status: 1, createdAt: -1 }, { background: true });
      await paymentCollection.createIndex({ transactionId: 1 }, { unique: true, background: true });
      console.log('✅ Created payment indexes');
    } catch (error) {
      console.log(`ℹ️ Payment indexes: ${error.message}`);
    }

    console.log('🎉 Database index optimization completed!');
    console.log('💡 Monitor query performance and adjust indexes as needed.');

  } catch (error) {
    console.error('❌ Database optimization failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📤 Disconnected from database');
    process.exit(0);
  }
}

// Run the optimization
if (require.main === module) {
  optimizeDatabaseIndexes();
}

module.exports = optimizeDatabaseIndexes;
