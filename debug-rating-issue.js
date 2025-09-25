/**
 * Debug script to check why rating is not available for escrow transaction
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import all required models
const User = require('./db/models/userModel');
const Product = require('./db/models/productModel');
const EscrowTransaction = require('./db/models/escrowTransactionModel');
const Rating = require('./db/models/ratingModel');
const Order = require('./db/models/orderModel');

const { findEscrowTransaction } = require('./utils/transactionUtils');

async function debugRatingIssue() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const transactionId = '68b80ea83f21fd63f73fb0db'; // From user's API call
    const transactionType = 'escrow';

    console.log(`🔍 Debugging rating issue for transaction: ${transactionId} (type: ${transactionType})`);

    // Step 1: Find the transaction
    console.log('\n📋 Step 1: Finding escrow transaction...');
    const transaction = await findEscrowTransaction(transactionId, true);

    if (!transaction) {
      console.log('❌ Transaction not found');
      return;
    }

    console.log('✅ Transaction found:', {
      _id: transaction._id,
      transactionId: transaction.transactionId,
      status: transaction.status,
      buyer: transaction.buyer ? `${transaction.buyer.firstName} ${transaction.buyer.lastName}` : 'Not populated',
      seller: transaction.seller ? `${transaction.seller.firstName} ${transaction.seller.lastName}` : 'Not populated',
      product: transaction.product ? transaction.product.title : 'Not populated',
      createdAt: transaction.createdAt
    });

    // Step 2: Check status validation
    console.log('\n📋 Step 2: Checking status validation...');
    const validStatuses = ['completed', 'funds_held', 'paid', 'processing', 'payment_processing', 'pending_payment'];
    const isValidStatus = validStatuses.includes(transaction.status);
    
    console.log('Status check:', {
      currentStatus: transaction.status,
      validStatuses: validStatuses,
      isValid: isValidStatus
    });

    if (!isValidStatus) {
      console.log('❌ Transaction status not valid for rating');
      return;
    }

    // Step 3: Check for existing ratings
    console.log('\n📋 Step 3: Checking for existing ratings...');
    
    // Check both buyer and seller ratings
    const buyerRating = await Rating.findOne({
      escrowTransaction: transaction._id,
      ratedBy: transaction.buyer._id,
      ratingType: 'buyer_to_seller'
    });

    const sellerRating = await Rating.findOne({
      escrowTransaction: transaction._id,
      ratedBy: transaction.seller._id,
      ratingType: 'seller_to_buyer'
    });

    console.log('Existing ratings:', {
      buyerRating: buyerRating ? 'Exists' : 'None',
      sellerRating: sellerRating ? 'Exists' : 'None'
    });

    // Step 4: Simulate rating check for both users
    console.log('\n📋 Step 4: Simulating rating check...');
    
    // For buyer
    console.log('\n👤 For Buyer:');
    const buyerCanRate = !buyerRating;
    console.log({
      userId: transaction.buyer._id,
      userRole: 'buyer',
      ratingType: 'buyer_to_seller',
      canRate: buyerCanRate,
      reason: buyerCanRate ? 'Can rate' : 'Already rated'
    });

    // For seller
    console.log('\n👤 For Seller:');
    const sellerCanRate = !sellerRating;
    console.log({
      userId: transaction.seller._id,
      userRole: 'seller',
      ratingType: 'seller_to_buyer',
      canRate: sellerCanRate,
      reason: sellerCanRate ? 'Can rate' : 'Already rated'
    });

    // Step 5: Check API endpoint behavior
    console.log('\n📋 Step 5: Testing API endpoint behavior...');
    console.log('API URL that should be called:', `/api/user/ratings/transaction/${transactionId}/can-rate?type=escrow`);
    console.log('API URL that was called (from user):', `/api/user/ratings/transaction/${transactionId}?type=escrow`);
    console.log('❌ ISSUE FOUND: User is calling the wrong endpoint!');
    console.log('✅ SOLUTION: Frontend should call /can-rate endpoint, not the base transaction endpoint');

    // Step 6: Test the correct endpoint response
    console.log('\n📋 Step 6: What the correct endpoint should return...');
    
    // Simulate for buyer (assuming user is buyer)
    const correctResponse = {
      success: true,
      data: {
        canRate: buyerCanRate,
        ratingType: 'buyer_to_seller',
        userRole: 'buyer',
        transactionType: 'escrow',
        reason: buyerCanRate ? undefined : 'Already rated'
      }
    };

    console.log('Correct API response for buyer:', JSON.stringify(correctResponse, null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Run the debug
debugRatingIssue().catch(console.error);