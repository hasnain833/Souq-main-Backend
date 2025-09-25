const mongoose = require('mongoose');
require('dotenv').config();

async function testSpecificTransaction() {
  try {
    console.log('🧪 Testing specific transaction: 68664fecb5dd3cd530fd943c');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/souq');
    console.log('✅ Connected to MongoDB');
    
    // Import models
    const EscrowTransaction = require('./db/models/escrowTransactionModel');
    const StandardPayment = require('./db/models/standardPaymentModel');
    const Order = require('./db/models/orderModel');
    
    const transactionId = '68664fecb5dd3cd530fd943c';
    console.log(`🔍 Searching for transaction: ${transactionId}`);
    
    // Check if it's a valid ObjectId
    const isValidObjectId = mongoose.Types.ObjectId.isValid(transactionId) && /^[0-9a-fA-F]{24}$/.test(transactionId);
    console.log(`🔍 Is valid ObjectId: ${isValidObjectId}`);
    
    // Search in all collections
    console.log('\n🔍 Searching in EscrowTransaction...');
    const escrowById = await EscrowTransaction.findById(transactionId)
      .populate('buyer', 'firstName lastName email')
      .populate('seller', 'firstName lastName email')
      .populate('product', 'title price product_photos');
    
    if (escrowById) {
      console.log('✅ Found in EscrowTransaction:');
      console.log(`   - ID: ${escrowById._id}`);
      console.log(`   - Transaction ID: ${escrowById.transactionId}`);
      console.log(`   - Gateway Transaction ID: ${escrowById.gatewayTransactionId}`);
      console.log(`   - Status: ${escrowById.status}`);
      console.log(`   - Product Price: ${escrowById.productPrice}`);
      console.log(`   - Platform Fee: ${escrowById.platformFeeAmount}`);
      console.log(`   - Currency: ${escrowById.currency}`);
      console.log(`   - Seller: ${escrowById.seller?._id || escrowById.seller}`);
      console.log(`   - Buyer: ${escrowById.buyer?._id || escrowById.buyer}`);
      console.log(`   - Product: ${escrowById.product?.title || escrowById.product}`);
      console.log(`   - Created: ${escrowById.createdAt}`);
      
      // Calculate seller amount
      const sellerAmount = escrowById.productPrice - (escrowById.platformFeeAmount || 0);
      console.log(`💰 Calculated seller amount: ${sellerAmount}`);
      
      if (sellerAmount <= 0) {
        console.log('⚠️ Seller amount is not positive - this is why walletCredited is false');
      } else {
        console.log('✅ Seller amount is positive - wallet should be credited');
      }
      
      return;
    }
    
    console.log('\n🔍 Searching in StandardPayment...');
    const standardById = await StandardPayment.findById(transactionId)
      .populate('buyer', 'firstName lastName email')
      .populate('seller', 'firstName lastName email')
      .populate('product', 'title price product_photos');
    
    if (standardById) {
      console.log('✅ Found in StandardPayment:');
      console.log(`   - ID: ${standardById._id}`);
      console.log(`   - Transaction ID: ${standardById.transactionId}`);
      console.log(`   - Status: ${standardById.status}`);
      console.log(`   - Product Price: ${standardById.productPrice}`);
      console.log(`   - Platform Fee: ${standardById.platformFeeAmount}`);
      console.log(`   - Currency: ${standardById.currency}`);
      console.log(`   - Seller: ${standardById.seller?._id || standardById.seller}`);
      
      // Calculate seller amount
      const sellerAmount = standardById.productPrice - (standardById.platformFeeAmount || 0);
      console.log(`💰 Calculated seller amount: ${sellerAmount}`);
      
      return;
    }
    
    console.log('\n🔍 Searching in Order...');
    const orderById = await Order.findById(transactionId)
      .populate('buyer', 'firstName lastName email')
      .populate('seller', 'firstName lastName email')
      .populate('product', 'title price product_photos');
    
    if (orderById) {
      console.log('✅ Found in Order:');
      console.log(`   - ID: ${orderById._id}`);
      console.log(`   - Order Number: ${orderById.orderNumber}`);
      console.log(`   - Status: ${orderById.status}`);
      console.log(`   - Total Amount: ${orderById.totalAmount}`);
      console.log(`   - Payment Transaction ID: ${orderById.payment?.transactionId}`);
      console.log(`   - Seller: ${orderById.seller?._id || orderById.seller}`);
      
      return;
    }
    
    console.log('❌ Transaction not found in any collection');
    
    // Show recent transactions for comparison
    console.log('\n📋 Recent EscrowTransactions:');
    const recentEscrows = await EscrowTransaction.find().limit(5).select('_id transactionId status productPrice platformFeeAmount');
    recentEscrows.forEach(t => {
      console.log(`   - ${t._id}: ${t.transactionId}, Status: ${t.status}, Price: ${t.productPrice}, Fee: ${t.platformFeeAmount}`);
    });
    
    console.log('\n📋 Recent StandardPayments:');
    const recentStandards = await StandardPayment.find().limit(5).select('_id transactionId status productPrice platformFeeAmount');
    recentStandards.forEach(t => {
      console.log(`   - ${t._id}: ${t.transactionId}, Status: ${t.status}, Price: ${t.productPrice}, Fee: ${t.platformFeeAmount}`);
    });
    
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
console.log('🚀 Starting specific transaction test...');
testSpecificTransaction()
  .then(() => {
    console.log('✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
