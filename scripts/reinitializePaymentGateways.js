const mongoose = require('mongoose');
const paymentGatewayFactory = require('../services/payment/PaymentGatewayFactory');
require('dotenv').config();

/**
 * Reinitialize payment gateways without restarting the server
 */
async function reinitializePaymentGateways() {
  try {
    console.log('🔄 Reinitializing payment gateways...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Clear existing gateways
    paymentGatewayFactory.gateways.clear();
    paymentGatewayFactory.initialized = false;
    console.log('🧹 Cleared existing gateway cache');

    // Reinitialize with updated configuration
    await paymentGatewayFactory.initialize();
    console.log('✅ Payment gateways reinitialized successfully');

    // Test Stripe gateway specifically
    const stripeGateway = paymentGatewayFactory.getGateway('stripe');
    if (stripeGateway) {
      console.log('✅ Stripe gateway loaded successfully');
      const config = stripeGateway.getGatewayConfig();
      console.log('Stripe gateway config:', {
        isConfigured: config.isConfigured,
        hasSecretKey: !!stripeGateway.secretKey,
        hasPublishableKey: !!stripeGateway.publishableKey,
        secretKeyPrefix: stripeGateway.secretKey ? 
          stripeGateway.secretKey.substring(0, 7) + '...' : 'Missing'
      });
    } else {
      console.error('❌ Stripe gateway not found after reinitialization');
    }

  } catch (error) {
    console.error('❌ Error reinitializing payment gateways:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Run reinitialization if this script is executed directly
if (require.main === module) {
  reinitializePaymentGateways()
    .then(() => {
      console.log('🎉 Payment gateway reinitialization completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Payment gateway reinitialization failed:', error);
      process.exit(1);
    });
}

module.exports = { reinitializePaymentGateways };
