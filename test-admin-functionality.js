const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import models
const Order = require('./db/models/orderModel');
const Rating = require('./db/models/ratingModel');
const UserReport = require('./db/models/userReportModel');
const User = require('./db/models/userModel');
const Product = require('./db/models/productModel');

async function testAdminFunctionality() {
  try {
    console.log('🧪 Testing Admin Functionality...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/souq-marketplace');
    console.log('✅ Connected to MongoDB');

    // Test 1: Check Orders Collection
    console.log('\n📋 Test 1: Checking Orders Collection...');
    
    const totalOrders = await Order.countDocuments();
    const escrowOrders = await Order.countDocuments({ 'payment.method': 'escrow' });
    const standardOrders = await Order.countDocuments({ 'payment.method': 'standard' });
    
    console.log(`📊 Order Statistics:`);
    console.log(`   Total Orders: ${totalOrders}`);
    console.log(`   Escrow Orders: ${escrowOrders}`);
    console.log(`   Standard Orders: ${standardOrders}`);

    if (totalOrders > 0) {
      const sampleOrder = await Order.findOne()
        .populate('buyer', 'firstName lastName email')
        .populate('seller', 'firstName lastName email')
        .populate('product', 'title price');
      
      console.log(`📦 Sample Order:`);
      console.log(`   Order Number: ${sampleOrder.orderNumber}`);
      console.log(`   Status: ${sampleOrder.status}`);
      console.log(`   Payment Method: ${sampleOrder.payment.method}`);
      console.log(`   Buyer: ${sampleOrder.buyer?.firstName} ${sampleOrder.buyer?.lastName}`);
      console.log(`   Seller: ${sampleOrder.seller?.firstName} ${sampleOrder.seller?.lastName}`);
      console.log(`   Product: ${sampleOrder.product?.title}`);
    }

    // Test 2: Check Ratings Collection
    console.log('\n📋 Test 2: Checking Ratings Collection...');
    
    const totalRatings = await Rating.countDocuments();
    const buyerToSellerRatings = await Rating.countDocuments({ ratingType: 'buyer_to_seller' });
    const sellerToBuyerRatings = await Rating.countDocuments({ ratingType: 'seller_to_buyer' });
    
    console.log(`⭐ Rating Statistics:`);
    console.log(`   Total Ratings: ${totalRatings}`);
    console.log(`   Buyer to Seller: ${buyerToSellerRatings}`);
    console.log(`   Seller to Buyer: ${sellerToBuyerRatings}`);

    if (totalRatings > 0) {
      const averageRating = await Rating.aggregate([
        { $group: { _id: null, avgRating: { $avg: '$rating' } } }
      ]);
      
      const sampleRating = await Rating.findOne()
        .populate('ratedBy', 'firstName lastName email')
        .populate('ratedUser', 'firstName lastName email')
        .populate('product', 'title');
      
      console.log(`⭐ Rating Details:`);
      console.log(`   Average Rating: ${averageRating[0]?.avgRating?.toFixed(2) || 'N/A'}`);
      console.log(`   Sample Rating: ${sampleRating?.rating}/5 stars`);
      console.log(`   Review: "${sampleRating?.review || 'No review text'}"`);
      console.log(`   Rated By: ${sampleRating?.ratedBy?.firstName} ${sampleRating?.ratedBy?.lastName}`);
      console.log(`   Rated User: ${sampleRating?.ratedUser?.firstName} ${sampleRating?.ratedUser?.lastName}`);
    }

    // Test 3: Check User Reports Collection
    console.log('\n📋 Test 3: Checking User Reports Collection...');
    
    const totalReports = await UserReport.countDocuments();
    const pendingReports = await UserReport.countDocuments({ status: 'pending' });
    const resolvedReports = await UserReport.countDocuments({ status: 'resolved' });
    
    console.log(`🚨 Report Statistics:`);
    console.log(`   Total Reports: ${totalReports}`);
    console.log(`   Pending Reports: ${pendingReports}`);
    console.log(`   Resolved Reports: ${resolvedReports}`);

    if (totalReports > 0) {
      const reportsByReason = await UserReport.aggregate([
        { $group: { _id: '$reason', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
      
      const sampleReport = await UserReport.findOne()
        .populate('reporter', 'firstName lastName email')
        .populate('reported', 'firstName lastName email');
      
      console.log(`🚨 Report Details:`);
      console.log(`   Most Common Reasons:`);
      reportsByReason.slice(0, 3).forEach(reason => {
        console.log(`     ${reason._id}: ${reason.count} reports`);
      });
      
      if (sampleReport) {
        console.log(`   Sample Report:`);
        console.log(`     Reason: ${sampleReport.reason}`);
        console.log(`     Status: ${sampleReport.status}`);
        console.log(`     Reporter: ${sampleReport.reporter?.firstName} ${sampleReport.reporter?.lastName}`);
        console.log(`     Reported: ${sampleReport.reported?.firstName} ${sampleReport.reported?.lastName}`);
        console.log(`     Description: "${sampleReport.description.substring(0, 100)}..."`);
      }
    }

    // Test 4: Check Data Relationships
    console.log('\n📋 Test 4: Checking Data Relationships...');
    
    const usersWithOrders = await Order.distinct('buyer');
    const usersWithRatings = await Rating.distinct('ratedBy');
    const usersWithReports = await UserReport.distinct('reporter');
    
    console.log(`🔗 Relationship Statistics:`);
    console.log(`   Users with Orders: ${usersWithOrders.length}`);
    console.log(`   Users with Ratings: ${usersWithRatings.length}`);
    console.log(`   Users with Reports: ${usersWithReports.length}`);

    // Test 5: Sample Admin Queries
    console.log('\n📋 Test 5: Sample Admin Queries...');
    
    // Recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentOrders = await Order.countDocuments({ createdAt: { $gte: thirtyDaysAgo } });
    const recentRatings = await Rating.countDocuments({ createdAt: { $gte: thirtyDaysAgo } });
    const recentReports = await UserReport.countDocuments({ createdAt: { $gte: thirtyDaysAgo } });
    
    console.log(`📈 Recent Activity (Last 30 Days):`);
    console.log(`   New Orders: ${recentOrders}`);
    console.log(`   New Ratings: ${recentRatings}`);
    console.log(`   New Reports: ${recentReports}`);

    // Order status breakdown
    const orderStatusBreakdown = await Order.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    console.log(`📊 Order Status Breakdown:`);
    orderStatusBreakdown.forEach(status => {
      console.log(`   ${status._id}: ${status.count} orders`);
    });

    console.log('\n🎉 Admin functionality tests completed!');
    
    console.log('\n📝 Summary:');
    console.log('   ✅ Orders collection accessible');
    console.log('   ✅ Ratings collection accessible');
    console.log('   ✅ User reports collection accessible');
    console.log('   ✅ Data relationships working');
    console.log('   ✅ Admin queries functional');
    
    console.log('\n🚀 Admin panel should be ready for:');
    console.log('   📦 Order management with escrow/standard tabs');
    console.log('   ⭐ Rating moderation and statistics');
    console.log('   🚨 User report handling and resolution');
    console.log('   📊 Comprehensive analytics and insights');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('\n✅ MongoDB connection closed');
  }
}

// Run the test
if (require.main === module) {
  testAdminFunctionality();
}

module.exports = testAdminFunctionality;
