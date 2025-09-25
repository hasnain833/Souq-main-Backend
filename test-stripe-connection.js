require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function testStripeConnection() {
  try {
    console.log('🔄 Testing Stripe connection...');
    console.log('🔑 Using secret key:', process.env.STRIPE_SECRET_KEY ? 
      process.env.STRIPE_SECRET_KEY.substring(0, 12) + '...' : 'Missing');
    
    // Test 1: Create a payment intent
    console.log('\n📝 Test 1: Creating payment intent...');
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 2000, // $20.00
      currency: 'usd',
      description: 'SOUQ Marketplace Test Payment',
      metadata: {
        test: 'true',
        source: 'backend_test'
      }
    });
    
    console.log('✅ Payment intent created successfully!');
    console.log('   ID:', paymentIntent.id);
    console.log('   Status:', paymentIntent.status);
    console.log('   Amount:', paymentIntent.amount / 100, paymentIntent.currency.toUpperCase());
    
    // Test 2: Retrieve the payment intent
    console.log('\n🔍 Test 2: Retrieving payment intent...');
    const retrieved = await stripe.paymentIntents.retrieve(paymentIntent.id);
    console.log('✅ Payment intent retrieved successfully!');
    console.log('   Status:', retrieved.status);
    console.log('   Created:', new Date(retrieved.created * 1000).toISOString());
    
    // Test 3: List recent payment intents
    console.log('\n📋 Test 3: Listing recent payment intents...');
    const paymentIntents = await stripe.paymentIntents.list({ limit: 3 });
    console.log('✅ Found', paymentIntents.data.length, 'recent payment intents:');
    paymentIntents.data.forEach((pi, index) => {
      console.log(`   ${index + 1}. ${pi.id} - ${pi.status} - $${pi.amount / 100}`);
    });
    
    console.log('\n🎉 All Stripe tests passed! Your integration is working correctly.');
    console.log('💡 You should now see these transactions in your Stripe dashboard:');
    console.log('   https://dashboard.stripe.com/test/payments');
    
  } catch (error) {
    console.error('❌ Stripe test failed:', error.message);
    console.error('🔧 Check your Stripe configuration:');
    console.error('   1. Verify STRIPE_SECRET_KEY in .env file');
    console.error('   2. Ensure you have internet connection');
    console.error('   3. Check if the key is a valid test key (starts with sk_test_)');
  }
}

// Run the test
testStripeConnection();
