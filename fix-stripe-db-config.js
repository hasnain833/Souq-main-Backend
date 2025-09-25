require('dotenv').config();
const mongoose = require('mongoose');
const PaymentGateway = require('./db/models/paymentGatewayModel');

async function fixStripeConfig() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/souq');
    console.log('✅ Connected to MongoDB');
    
    console.log('\n🔧 Updating Stripe configuration in database...');
    
    const stripeConfig = await PaymentGateway.findOneAndUpdate(
      { gatewayName: 'stripe' },
      {
        $set: {
          gatewayName: 'stripe',
          displayName: 'Stripe',
          isActive: true,
          isTestMode: true,
          supportedCurrencies: ['USD', 'AED', 'EUR', 'GBP'],
          supportedPaymentMethods: ['credit_card', 'debit_card'],
          feeStructure: {
            fixedFee: 0.30,
            percentageFee: 2.9,
            currency: 'USD'
          },
          configuration: {
            apiKey: process.env.STRIPE_PUBLISHABLE_KEY,
            secretKey: process.env.STRIPE_SECRET_KEY,
            stripe: {
              publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
              secretKey: process.env.STRIPE_SECRET_KEY,
              webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
            }
          }
        }
      },
      {
        upsert: true,
        new: true,
        runValidators: true
      }
    );
    
    console.log('✅ Stripe configuration updated successfully!');
    console.log('Gateway Name:', stripeConfig.gatewayName);
    console.log('Display Name:', stripeConfig.displayName);
    console.log('Is Active:', stripeConfig.isActive);
    console.log('Is Test Mode:', stripeConfig.isTestMode);
    console.log('Has Secret Key:', !!stripeConfig.configuration?.stripe?.secretKey);
    console.log('Has Publishable Key:', !!stripeConfig.configuration?.stripe?.publishableKey);
    console.log('Has Webhook Secret:', !!stripeConfig.configuration?.stripe?.webhookSecret);

    if (stripeConfig.configuration?.stripe?.secretKey) {
      console.log('Secret Key Preview:', stripeConfig.configuration.stripe.secretKey.substring(0, 12) + '...');
    }

    if (stripeConfig.configuration?.stripe?.publishableKey) {
      console.log('Publishable Key Preview:', stripeConfig.configuration.stripe.publishableKey.substring(0, 12) + '...');
    }
    
    console.log('\n🎉 Stripe is now properly configured!');
    console.log('💡 Restart your backend server to apply the changes.');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error updating Stripe configuration:', err.message);
    process.exit(1);
  }
}

fixStripeConfig();
