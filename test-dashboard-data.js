const mongoose = require('mongoose');
require('dotenv').config();

async function testDashboardData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const User = require('./db/models/userModel');
    const Product = require('./db/models/productModel');
    const Order = require('./db/models/orderModel');
    const Transaction = require('./db/models/transactionModel');
    const StandardPayment = require('./db/models/standardPaymentModel');
    const EscrowTransaction = require('./db/models/escrowTransactionModel');

    console.log('\n📊 Checking database collections...');

    // Check Users
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ deletedAt: null });
    console.log(`👥 Users: ${totalUsers} total, ${activeUsers} active`);

    // Check Products
    const totalProducts = await Product.countDocuments();
    const activeProducts = await Product.countDocuments({ status: 'active' });
    console.log(`📦 Products: ${totalProducts} total, ${activeProducts} active`);

    // Check Orders
    const totalOrders = await Order.countDocuments();
    const completedOrders = await Order.countDocuments({ status: 'completed' });
    console.log(`🛒 Orders: ${totalOrders} total, ${completedOrders} completed`);

    // Check Transactions
    const totalTransactions = await Transaction.countDocuments();
    const completedTransactions = await Transaction.countDocuments({ status: 'completed' });
    console.log(`💳 Transactions: ${totalTransactions} total, ${completedTransactions} completed`);

    // Check Standard Payments
    const totalStandardPayments = await StandardPayment.countDocuments();
    const completedStandardPayments = await StandardPayment.countDocuments({ status: 'completed' });
    console.log(`💰 Standard Payments: ${totalStandardPayments} total, ${completedStandardPayments} completed`);

    // Check Escrow Transactions
    const totalEscrowTransactions = await EscrowTransaction.countDocuments();
    const completedEscrowTransactions = await EscrowTransaction.countDocuments({ status: 'completed' });
    console.log(`🔒 Escrow Transactions: ${totalEscrowTransactions} total, ${completedEscrowTransactions} completed`);

    // Calculate revenue from different sources
    console.log('\n💰 Revenue Analysis:');
    
    // Revenue from Transactions
    const transactionRevenue = await Transaction.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    console.log(`💳 Transaction Revenue: $${transactionRevenue[0]?.total || 0}`);

    // Revenue from Standard Payments
    const standardPaymentRevenue = await StandardPayment.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    console.log(`💰 Standard Payment Revenue: $${standardPaymentRevenue[0]?.total || 0}`);

    // Revenue from Escrow Transactions
    const escrowRevenue = await EscrowTransaction.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    console.log(`🔒 Escrow Revenue: $${escrowRevenue[0]?.total || 0}`);

    // Check if we have any sample data
    console.log('\n🔍 Sample Data Check:');
    const sampleUser = await User.findOne().select('firstName lastName email');
    console.log(`👤 Sample User: ${sampleUser ? `${sampleUser.firstName} ${sampleUser.lastName} (${sampleUser.email})` : 'None found'}`);

    const sampleProduct = await Product.findOne().select('title price status');
    console.log(`📦 Sample Product: ${sampleProduct ? `${sampleProduct.title} - $${sampleProduct.price} (${sampleProduct.status})` : 'None found'}`);

    const sampleOrder = await Order.findOne().select('orderNumber status');
    console.log(`🛒 Sample Order: ${sampleOrder ? `${sampleOrder.orderNumber} (${sampleOrder.status})` : 'None found'}`);

    // Recommendations
    console.log('\n💡 Recommendations:');
    if (totalOrders === 0) {
      console.log('⚠️  No orders found - this explains why Total Orders shows 0');
    }
    if (totalTransactions === 0 && totalStandardPayments === 0 && totalEscrowTransactions === 0) {
      console.log('⚠️  No transactions found - this explains why revenue shows 0');
    }
    if (totalProducts === 0) {
      console.log('⚠️  No products found - consider adding sample products');
    }

  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

// Run the test
testDashboardData();
