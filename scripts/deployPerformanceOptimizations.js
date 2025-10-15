#!/usr/bin/env node

/**
 * Performance Optimization Deployment Script
 * This script applies all performance optimizations to the API
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { optimizeDatabaseIndexes } = require('./optimizeDatabaseIndexes');

async function deployPerformanceOptimizations() {
  console.log('🚀 Starting Performance Optimization Deployment...\n');

  try {
    // Step 1: Connect to database
    console.log('📡 Connecting to database...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Database connected successfully\n');

    // Step 2: Optimize database indexes
    console.log('📊 Optimizing database indexes...');
    await optimizeDatabaseIndexes();
    console.log('✅ Database indexes optimized\n');

    // Step 3: Verify optimizations
    console.log('🔍 Verifying optimizations...');
    await verifyOptimizations();
    console.log('✅ Optimizations verified\n');

    // Step 4: Performance test
    console.log('🧪 Running performance test...');
    await runPerformanceTest();
    console.log('✅ Performance test completed\n');

    console.log('🎉 Performance optimization deployment completed successfully!');
    console.log('\n📋 Next Steps:');
    console.log('1. Restart your server to apply middleware changes');
    console.log('2. Update frontend to use optimized endpoints');
    console.log('3. Monitor performance metrics');
    console.log('4. Set up performance alerts');

  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n📤 Disconnected from database');
  }
}

async function verifyOptimizations() {
  const db = mongoose.connection.db;
  
  // Check if indexes exist
  const productIndexes = await db.collection('products').indexes();
  const userIndexes = await db.collection('users').indexes();
  const categoryIndexes = await db.collection('categories').indexes();

  console.log(`   📦 Product collection: ${productIndexes.length} indexes`);
  console.log(`   👤 User collection: ${userIndexes.length} indexes`);
  console.log(`   📂 Category collection: ${categoryIndexes.length} indexes`);

  // Verify critical indexes exist
  const criticalIndexes = [
    { collection: 'products', index: { status: 1, createdAt: -1 } },
    { collection: 'products', index: { category: 1, status: 1 } },
    { collection: 'users', index: { email: 1 } },
    { collection: 'categories', index: { name: 1 } }
  ];

  for (const { collection, index } of criticalIndexes) {
    const indexes = await db.collection(collection).indexes();
    const hasIndex = indexes.some(idx => 
      JSON.stringify(idx.key) === JSON.stringify(index)
    );
    
    if (hasIndex) {
      console.log(`   ✅ ${collection}: Critical index exists`);
    } else {
      console.log(`   ⚠️ ${collection}: Critical index missing`);
    }
  }
}

async function runPerformanceTest() {
  const Product = require('../db/models/productModel');
  
  // Test optimized query performance
  const startTime = Date.now();
  
  try {
    // Test basic product query
    const products = await Product.find({ status: 'active' })
      .select('title price createdAt')
      .limit(20)
      .lean()
      .maxTimeMS(5000);
    
    const queryTime = Date.now() - startTime;
    
    if (queryTime < 1000) {
      console.log(`   ✅ Product query: ${queryTime}ms (Good)`);
    } else if (queryTime < 3000) {
      console.log(`   ⚠️ Product query: ${queryTime}ms (Moderate)`);
    } else {
      console.log(`   ❌ Product query: ${queryTime}ms (Slow)`);
    }
    
    console.log(`   📊 Retrieved ${products.length} products`);
    
  } catch (error) {
    console.log(`   ❌ Performance test failed: ${error.message}`);
  }
}

// Run the deployment
if (require.main === module) {
  deployPerformanceOptimizations()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Deployment failed:', error);
      process.exit(1);
    });
}

module.exports = deployPerformanceOptimizations;
