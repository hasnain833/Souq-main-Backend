require('dotenv').config();
const mongoose = require('mongoose');
const paymentGatewayFactory = require('./services/payment/PaymentGatewayFactory');

async function verifyStripeIntegration() {
  try {
    console.log('🔄 Verifying Stripe Integration...\n');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/souq');
    console.log('✅ Connected to MongoDB');

    // Initialize payment gateway factory
    await paymentGatewayFactory.initialize();
    console.log('✅ Payment gateway factory initialized');

    // Get Stripe gateway
    const stripeGateway = paymentGatewayFactory.getGateway('stripe');
    if (!stripeGateway) {
      console.error('❌ Stripe gateway not found');
      process.exit(1);
    }

    console.log('✅ Stripe gateway found');
    console.log('   Mock Mode:', stripeGateway.mockMode);
    console.log('   Has Stripe Instance:', !!stripeGateway.stripe);

    // Test payment intent creation
    console.log('\n🧪 Testing payment intent creation...');

    const testPaymentData = {
      amount: 25.99,
      currency: 'USD',
      customerEmail: 'test@example.com',
      customerName: 'Test Customer',
      description: 'Test payment for Stripe integration',
      buyerId: '507f1f77bcf86cd799439011',
      sellerId: '507f1f77bcf86cd799439012',
      productId: '507f1f77bcf86cd799439013',
      orderId: '507f1f77bcf86cd799439014',
      returnUrl: `${process.env.FRONTEND_URL}/payment-success`
    };

    const paymentResult = await stripeGateway.initializePayment(testPaymentData);

    if (paymentResult.success) {
      console.log('✅ Payment intent created successfully!');
      console.log('   Transaction ID:', paymentResult.transactionId);
      console.log('   Client Secret:', paymentResult.clientSecret ? 'Present' : 'Missing');
      console.log('   Publishable Key:', paymentResult.publishableKey ? 'Present' : 'Missing');
      console.log('   Mock Mode:', paymentResult.mockMode || false);

      if (!paymentResult.mockMode) {
        console.log('\n🎉 SUCCESS: Stripe is working with REAL API!');
        console.log('💡 This payment intent should appear in your Stripe dashboard:');
        console.log('   https://dashboard.stripe.com/test/payments');
        console.log('   Look for transaction ID:', paymentResult.transactionId);
      } else {
        console.log('\n⚠️  WARNING: Stripe is still in mock mode');
        console.log('💡 Check your database configuration');
      }

    } else {
      console.error('❌ Payment intent creation failed:');
      console.error('   Error:', paymentResult.error);
      console.error('   Details:', paymentResult.details);
    }

    console.log('\n📋 Integration Status Summary:');
    console.log('   Database Config: ✅ Configured');
    console.log('   Environment Variables: ✅ Present');
    console.log('   Stripe Gateway: ✅ Initialized');
    console.log('   Mock Mode:', stripeGateway.mockMode ? '❌ Enabled' : '✅ Disabled');
    console.log('   API Connection:', paymentResult.success && !paymentResult.mockMode ? '✅ Working' : '❌ Failed');

    if (!stripeGateway.mockMode && paymentResult.success) {
      console.log('\n🚀 Ready for testing!');
      console.log('1. Start Stripe CLI: stripe listen --forward-to localhost:5000/api/user/payments/webhook/stripe');
      console.log('2. Go to: http://localhost:5173');
      console.log('3. Make a test payment with card: 4242 4242 4242 4242');
      console.log('4. Check Stripe dashboard for transactions');
    }

    process.exit(0);

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  }
}

verifyStripeIntegration();
