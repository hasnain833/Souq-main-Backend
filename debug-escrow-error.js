const mongoose = require('mongoose');
const EscrowTransaction = require('./db/models/escrowTransactionModel');
const PlatformFee = require('./db/models/platformFeeModel');
const Product = require('./db/models/productModel');
const User = require('./db/models/userModel'); // Add User model
const paymentGatewayFactory = require('./services/payment/PaymentGatewayFactory');
const currencyService = require('./services/currency/CurrencyService');
require('dotenv').config();

/**
 * Debug script to test escrow creation logic
 */
async function debugEscrowCreation() {
  try {
    console.log('🔍 Starting escrow creation debug...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Test payload from your request
    const testPayload = {
      productId: "68497b9d588aec0773fc41ff",
      offerId: null,
      paymentGateway: "stripe",
      shippingAddress: {
        _id: "6864d6b2479977fc47d1febc",
        user: "68496f654c309a90fd9fbbe8",
        fullName: "jimiw",
        street1: "e3qwd  Address Line 1",
        street2: "qe2wds Address Line 2",
        city: "ewq",
        state: "ewsda",
        zipCode: "122121",
        country: "United Kingdom",
        phoneNumber: "7744888333",
        addressType: "work",
        isDefault: true,
        isActive: true
      },
      gatewayFeePaidBy: "buyer",
      currency: "USD"
    };

    console.log('📋 Test payload:', JSON.stringify(testPayload, null, 2));

    // Step 1: Test currency service
    console.log('\n🔍 Testing currency service...');
    const isCurrencySupported = currencyService.isCurrencySupported(testPayload.currency);
    console.log('Currency supported:', isCurrencySupported);

    // Step 2: Test product lookup
    console.log('\n🔍 Testing product lookup...');
    const product = await Product.findById(testPayload.productId).populate('user', 'firstName lastName email');
    if (!product) {
      console.error('❌ Product not found');
      return;
    }
    console.log('✅ Product found:', {
      id: product._id,
      title: product.title,
      price: product.price,
      seller: product.user?.firstName + ' ' + product.user?.lastName
    });

    // Step 3: Test platform fee configuration
    console.log('\n🔍 Testing platform fee configuration...');
    const platformFeeConfig = await PlatformFee.getActiveFeeStructure();
    if (!platformFeeConfig) {
      console.error('❌ Platform fee configuration not found');
      return;
    }
    console.log('✅ Platform fee config found:', {
      id: platformFeeConfig._id,
      defaultPercentage: platformFeeConfig.defaultPercentage,
      isActive: platformFeeConfig.isActive
    });

    // Step 4: Test currency conversion
    console.log('\n🔍 Testing currency conversion...');
    const conversionResult = currencyService.convertCurrency(
      product.price,
      'USD', // Assuming product price is in USD
      testPayload.currency
    );
    console.log('Currency conversion result:', conversionResult);

    // Step 5: Test platform fee calculation
    console.log('\n🔍 Testing platform fee calculation...');
    const feeCalculation = platformFeeConfig.calculateFee(
      conversionResult.convertedAmount,
      testPayload.currency,
      product.category,
      product.user._id
    );
    console.log('Fee calculation result:', feeCalculation);

    // Step 6: Test payment gateway factory initialization
    console.log('\n🔍 Testing payment gateway factory...');
    await paymentGatewayFactory.initialize();
    console.log('✅ Payment gateway factory initialized');

    // Step 7: Test specific gateway
    console.log('\n🔍 Testing Stripe gateway...');
    const gateway = paymentGatewayFactory.getGateway(testPayload.paymentGateway);
    if (!gateway) {
      console.error('❌ Payment gateway not available:', testPayload.paymentGateway);
      return;
    }
    console.log('✅ Gateway found:', {
      name: gateway.gatewayName,
      isConfigured: gateway.getGatewayConfig().isConfigured
    });

    // Step 8: Test currency support
    console.log('\n🔍 Testing gateway currency support...');
    const currencySupported = gateway.isCurrencySupported(testPayload.currency);
    console.log('Gateway supports currency:', currencySupported);

    // Step 9: Test gateway fee calculation
    console.log('\n🔍 Testing gateway fee calculation...');
    const totalAmount = conversionResult.convertedAmount + (product.shipping_cost || 0);
    const gatewayFeeAmount = gateway.calculateGatewayFee(totalAmount, testPayload.currency);
    console.log('Gateway fee calculation:', {
      totalAmount,
      gatewayFeeAmount,
      currency: testPayload.currency
    });

    console.log('\n🎉 All tests passed! Escrow creation should work.');

  } catch (error) {
    console.error('❌ Debug error:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Run the debug script
if (require.main === module) {
  debugEscrowCreation()
    .then(() => {
      console.log('🔍 Debug completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Debug failed:', error);
      process.exit(1);
    });
}

module.exports = { debugEscrowCreation };
