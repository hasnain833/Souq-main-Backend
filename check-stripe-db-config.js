require('dotenv').config();
const mongoose = require('mongoose');
const PaymentGateway = require('./db/models/paymentGatewayModel');

async function checkStripeConfig() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/souq');
    console.log('✅ Connected to MongoDB');
    
    const stripeConfig = await PaymentGateway.findOne({ gatewayName: 'stripe' });
    console.log('\n📋 Stripe configuration in database:');
    
    if (stripeConfig) {
      console.log('Gateway Name:', stripeConfig.gatewayName);
      console.log('Is Active:', stripeConfig.isActive);
      console.log('Has Secret Key:', !!stripeConfig.credentials?.secretKey);
      console.log('Has Publishable Key:', !!stripeConfig.credentials?.publishableKey);
      
      if (stripeConfig.credentials?.secretKey) {
        console.log('Secret Key Preview:', stripeConfig.credentials.secretKey.substring(0, 12) + '...');
      } else {
        console.log('Secret Key: Missing');
      }
      
      if (stripeConfig.credentials?.publishableKey) {
        console.log('Publishable Key Preview:', stripeConfig.credentials.publishableKey.substring(0, 12) + '...');
      } else {
        console.log('Publishable Key: Missing');
      }
      
      console.log('\n🔧 Environment variables:');
      console.log('STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? process.env.STRIPE_SECRET_KEY.substring(0, 12) + '...' : 'Missing');
      console.log('STRIPE_PUBLISHABLE_KEY:', process.env.STRIPE_PUBLISHABLE_KEY ? process.env.STRIPE_PUBLISHABLE_KEY.substring(0, 12) + '...' : 'Missing');
      
    } else {
      console.log('❌ No Stripe configuration found in database');
      console.log('💡 This means Stripe needs to be initialized in the database');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

checkStripeConfig();
