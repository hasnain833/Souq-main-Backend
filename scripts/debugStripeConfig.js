const mongoose = require('mongoose');
const PaymentGateway = require('../db/models/paymentGatewayModel');
require('dotenv').config();

/**
 * Debug Stripe configuration from both environment and database
 */
async function debugStripeConfig() {
  try {
    console.log('🔍 Debugging Stripe Configuration...');
    console.log('');

    // Check environment variables
    console.log('1. Environment Variables:');
    console.log('STRIPE_PUBLISHABLE_KEY:', process.env.STRIPE_PUBLISHABLE_KEY ? 
      process.env.STRIPE_PUBLISHABLE_KEY.substring(0, 10) + '...' : 'Missing');
    console.log('STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? 
      process.env.STRIPE_SECRET_KEY.substring(0, 10) + '...' : 'Missing');
    console.log('STRIPE_WEBHOOK_SECRET:', process.env.STRIPE_WEBHOOK_SECRET ? 
      process.env.STRIPE_WEBHOOK_SECRET.substring(0, 10) + '...' : 'Missing');
    console.log('');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Check database configuration
    console.log('2. Database Configuration:');
    const stripeGateway = await PaymentGateway.findOne({ gatewayName: 'stripe' });
    
    if (!stripeGateway) {
      console.error('❌ Stripe gateway not found in database');
      return;
    }

    console.log('Stripe gateway found:', {
      id: stripeGateway._id,
      gatewayName: stripeGateway.gatewayName,
      displayName: stripeGateway.displayName,
      isActive: stripeGateway.isActive,
      isTestMode: stripeGateway.isTestMode
    });

    console.log('');
    console.log('3. Stripe Configuration Details:');
    const config = stripeGateway.configuration;
    console.log('Has configuration:', !!config);
    console.log('Has stripe config:', !!config?.stripe);
    
    if (config?.stripe) {
      const stripeConfig = config.stripe;
      console.log('Stripe config details:', {
        hasPublishableKey: !!stripeConfig.publishableKey,
        hasSecretKey: !!stripeConfig.secretKey,
        hasWebhookSecret: !!stripeConfig.webhookSecret,
        publishableKeyLength: stripeConfig.publishableKey ? stripeConfig.publishableKey.length : 0,
        secretKeyLength: stripeConfig.secretKey ? stripeConfig.secretKey.length : 0,
        publishableKeyPrefix: stripeConfig.publishableKey ? stripeConfig.publishableKey.substring(0, 10) + '...' : 'None',
        secretKeyPrefix: stripeConfig.secretKey ? stripeConfig.secretKey.substring(0, 10) + '...' : 'None',
        publishableKeyValid: stripeConfig.publishableKey ? stripeConfig.publishableKey.startsWith('pk_') : false,
        secretKeyValid: stripeConfig.secretKey ? stripeConfig.secretKey.startsWith('sk_') : false
      });

      // Check if keys are still placeholders
      const isPlaceholderPublishable = stripeConfig.publishableKey && 
        stripeConfig.publishableKey.includes('1234567890abcdef');
      const isPlaceholderSecret = stripeConfig.secretKey && 
        stripeConfig.secretKey.includes('1234567890abcdef');

      console.log('');
      console.log('4. Key Validation:');
      console.log('Publishable key is placeholder:', isPlaceholderPublishable);
      console.log('Secret key is placeholder:', isPlaceholderSecret);

      if (isPlaceholderPublishable || isPlaceholderSecret) {
        console.log('');
        console.log('⚠️ WARNING: Placeholder keys detected!');
        console.log('You need to replace these with real Stripe test keys.');
      }
    }

    // Test Stripe initialization
    console.log('');
    console.log('5. Testing Stripe Initialization:');
    if (config?.stripe?.secretKey) {
      try {
        const stripe = require('stripe');
        const stripeInstance = stripe(config.stripe.secretKey);
        console.log('✅ Stripe instance created successfully');
        
        // Test a simple API call
        const balance = await stripeInstance.balance.retrieve();
        console.log('✅ Stripe API connection successful');
        console.log('Available balance:', balance.available);
      } catch (error) {
        console.error('❌ Stripe initialization/API test failed:', error.message);
        if (error.type === 'StripeAuthenticationError') {
          console.error('This usually means your secret key is invalid or placeholder');
        }
      }
    }

  } catch (error) {
    console.error('❌ Error debugging Stripe configuration:', error);
  } finally {
    await mongoose.disconnect();
    console.log('');
    console.log('✅ Disconnected from MongoDB');
  }
}

// Run if executed directly
if (require.main === module) {
  debugStripeConfig()
    .then(() => {
      console.log('🎉 Stripe configuration debug completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Debug failed:', error);
      process.exit(1);
    });
}

module.exports = { debugStripeConfig };
