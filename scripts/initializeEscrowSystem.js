const mongoose = require('mongoose');
const PaymentGateway = require('../db/models/paymentGatewayModel');
const PlatformFee = require('../db/models/platformFeeModel');
require('dotenv').config();

/**
 * Initialize payment gateways in database
 */
async function initializePaymentGateways() {
  try {
    console.log('🔄 Initializing payment gateways...');

    // Check environment variables
    console.log('Environment variables check:');
    console.log('STRIPE_PUBLISHABLE_KEY:', process.env.STRIPE_PUBLISHABLE_KEY ?
      process.env.STRIPE_PUBLISHABLE_KEY.substring(0, 7) + '...' : 'Missing');
    console.log('STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ?
      process.env.STRIPE_SECRET_KEY.substring(0, 7) + '...' : 'Missing');
    console.log('STRIPE_WEBHOOK_SECRET:', process.env.STRIPE_WEBHOOK_SECRET ?
      process.env.STRIPE_WEBHOOK_SECRET.substring(0, 7) + '...' : 'Missing');

    const gateways = [
      {
        gatewayName: 'paytabs',
        displayName: 'PayTabs',
        isActive: true,
        isTestMode: true,
        supportedCurrencies: ['USD', 'AED', 'SAR', 'EUR'],
        supportedPaymentMethods: ['credit_card', 'debit_card', 'apple_pay'],
        feeStructure: {
          fixedFee: 0,
          percentageFee: 2.9,
          minimumFee: 1,
          maximumFee: null
        },
        configuration: {
          paytabs: {
            profileId: process.env.PAYTABS_PROFILE_ID || '',
            serverKey: process.env.PAYTABS_SERVER_KEY || '',
            region: 'ARE'
          }
        },
        endpoints: {
          baseUrl: 'https://secure.paytabs.com',
          paymentUrl: '/payment/request',
          refundUrl: '/payment/request',
          webhookUrl: '/webhook/paytabs',
          statusUrl: '/payment/query'
        },
        limits: {
          minAmount: 1,
          maxAmount: 100000,
          dailyLimit: null,
          monthlyLimit: null
        },
        settlementDetails: {
          settlementCurrency: 'AED',
          settlementPeriod: 'daily',
          holdingPeriod: 1
        }
      },
      {
        gatewayName: 'stripe',
        displayName: 'Stripe',
        isActive: true,
        isTestMode: true,
        supportedCurrencies: ['USD', 'AED', 'EUR', 'GBP'],
        supportedPaymentMethods: ['credit_card', 'debit_card', 'apple_pay', 'google_pay'],
        feeStructure: {
          fixedFee: 0.5, // USD
          percentageFee: 2.9,
          minimumFee: 0.5,
          maximumFee: null
        },
        configuration: {
          stripe: {
            publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
            secretKey: process.env.STRIPE_SECRET_KEY || '',
            webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || ''
          }
        },
        endpoints: {
          baseUrl: 'https://api.stripe.com',
          paymentUrl: '/v1/payment_intents',
          refundUrl: '/v1/refunds',
          webhookUrl: '/webhook/stripe',
          statusUrl: '/v1/payment_intents'
        },
        limits: {
          minAmount: 0.5, // USD
          maxAmount: 999999, // USD
          dailyLimit: null,
          monthlyLimit: null
        },
        settlementDetails: {
          settlementCurrency: 'USD',
          settlementPeriod: 'daily',
          holdingPeriod: 2
        }
      },
      {
        gatewayName: 'paypal',
        displayName: 'PayPal',
        isActive: true,
        isTestMode: true,
        supportedCurrencies: ['USD', 'AED', 'EUR', 'GBP'],
        supportedPaymentMethods: ['wallet', 'credit_card'],
        feeStructure: {
          fixedFee: 0,
          percentageFee: 3.4,
          minimumFee: 0,
          maximumFee: null
        },
        configuration: {
          paypal: {
            clientId: process.env.PAYPAL_CLIENT_ID || '',
            clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
            environment: 'sandbox'
          }
        },
        endpoints: {
          baseUrl: 'https://api.sandbox.paypal.com',
          paymentUrl: '/v2/checkout/orders',
          refundUrl: '/v2/payments/captures',
          webhookUrl: '/webhook/paypal',
          statusUrl: '/v2/checkout/orders'
        },
        limits: {
          minAmount: 3.67, // Converted from 1 USD to AED
          maxAmount: 36738, // Converted from 10000 USD to AED
          dailyLimit: null,
          monthlyLimit: null
        },
        settlementDetails: {
          settlementCurrency: 'AED',
          settlementPeriod: 'daily',
          holdingPeriod: 1
        }
      },
      {
        gatewayName: 'payfort',
        displayName: 'PayFort (Amazon Payment Services)',
        isActive: false, // Disabled until implementation
        isTestMode: true,
        supportedCurrencies: ['AED', 'SAR', 'USD', 'EUR'],
        supportedPaymentMethods: ['credit_card', 'debit_card'],
        feeStructure: {
          fixedFee: 0,
          percentageFee: 2.85,
          minimumFee: 1,
          maximumFee: null
        },
        configuration: {
          payfort: {
            accessCode: process.env.PAYFORT_ACCESS_CODE || '',
            merchantIdentifier: process.env.PAYFORT_MERCHANT_ID || '',
            shaRequestPhrase: process.env.PAYFORT_SHA_REQUEST || '',
            shaResponsePhrase: process.env.PAYFORT_SHA_RESPONSE || '',
            environment: 'sandbox'
          }
        },
        endpoints: {
          baseUrl: 'https://sbpaymentservices.payfort.com',
          paymentUrl: '/FortAPI/paymentApi',
          refundUrl: '/FortAPI/paymentApi',
          webhookUrl: '/webhook/payfort',
          statusUrl: '/FortAPI/paymentApi'
        },
        limits: {
          minAmount: 1,
          maxAmount: 50000,
          dailyLimit: null,
          monthlyLimit: null
        },
        settlementDetails: {
          settlementCurrency: 'AED',
          settlementPeriod: 'daily',
          holdingPeriod: 2
        }
      },
      {
        gatewayName: 'checkout',
        displayName: 'Checkout.com',
        isActive: false, // Disabled until implementation
        isTestMode: true,
        supportedCurrencies: ['AED', 'USD', 'EUR', 'GBP'],
        supportedPaymentMethods: ['credit_card', 'debit_card', 'apple_pay', 'google_pay'],
        feeStructure: {
          fixedFee: 0,
          percentageFee: 2.9,
          minimumFee: 0,
          maximumFee: null
        },
        configuration: {
          checkout: {
            publicKey: process.env.CHECKOUT_PUBLIC_KEY || '',
            secretKey: process.env.CHECKOUT_SECRET_KEY || '',
            environment: 'sandbox'
          }
        },
        endpoints: {
          baseUrl: 'https://api.sandbox.checkout.com',
          paymentUrl: '/payments',
          refundUrl: '/payments',
          webhookUrl: '/webhook/checkout',
          statusUrl: '/payments'
        },
        limits: {
          minAmount: 1,
          maxAmount: 100000,
          dailyLimit: null,
          monthlyLimit: null
        },
        settlementDetails: {
          settlementCurrency: 'AED',
          settlementPeriod: 'daily',
          holdingPeriod: 1
        }
      }
    ];

    for (const gatewayData of gateways) {
      const existingGateway = await PaymentGateway.findOne({ gatewayName: gatewayData.gatewayName });

      if (existingGateway) {
        console.log(`🔄 Gateway ${gatewayData.displayName} already exists, updating configuration...`);

        // Update the existing gateway with new configuration
        Object.assign(existingGateway, gatewayData);
        await existingGateway.save();

        console.log(`✅ Updated gateway: ${gatewayData.displayName}`);
        if (gatewayData.gatewayName === 'stripe') {
          console.log('Updated Stripe configuration:', {
            hasSecretKey: !!gatewayData.configuration?.stripe?.secretKey,
            hasPublishableKey: !!gatewayData.configuration?.stripe?.publishableKey,
            secretKeyPrefix: gatewayData.configuration?.stripe?.secretKey ?
              gatewayData.configuration.stripe.secretKey.substring(0, 7) + '...' : 'Missing'
          });
        }
        continue;
      }

      const gateway = new PaymentGateway(gatewayData);
      await gateway.save();
      console.log(`✅ Created gateway: ${gatewayData.displayName}`);
    }

    console.log('✅ Payment gateways initialization completed');

  } catch (error) {
    console.error('❌ Error initializing payment gateways:', error);
    throw error;
  }
}

/**
 * Initialize platform fee configuration
 */
async function initializePlatformFee() {
  try {
    console.log('🔄 Initializing platform fee configuration...');

    const existingConfig = await PlatformFee.findOne({ isActive: true });
    if (existingConfig) {
      console.log('⚠️ Platform fee configuration already exists, skipping...');
      return;
    }

    const platformFeeConfig = new PlatformFee({
      feeType: 'percentage',
      defaultPercentage: 10, // 10% platform fee
      defaultFixedAmount: 0,
      
      // Currency-specific fees
      currencyFees: [
        {
          currency: 'USD',
          percentage: 10,
          fixedAmount: 0,
          minimumFee: 0.5,
          maximumFee: null
        },
        {
          currency: 'AED',
          percentage: 10,
          fixedAmount: 0,
          minimumFee: 1.84, // Converted from 0.5 USD to AED
          maximumFee: null
        },
        {
          currency: 'EUR',
          percentage: 10,
          fixedAmount: 0,
          minimumFee: 0.46, // Converted from 0.5 USD to EUR
          maximumFee: null
        }
      ],

      // Collection settings
      collectionSettings: {
        collectFrom: 'seller',
        sellerPercentage: 100
      },

      // Global limits
      globalLimits: {
        minimumFee: 0.5, // USD
        maximumFee: null,
        minimumTransactionAmount: 1 // USD
      },

      isActive: true,
      version: '1.0',
      notes: 'Initial platform fee configuration - 10% fee on all transactions'
    });

    await platformFeeConfig.save();
    console.log('✅ Platform fee configuration created successfully');

  } catch (error) {
    console.error('❌ Error initializing platform fee configuration:', error);
    throw error;
  }
}

/**
 * Main initialization function
 */
async function initializeEscrowSystem() {
  try {
    console.log('🚀 Starting escrow system initialization...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Initialize payment gateways
    await initializePaymentGateways();

    // Initialize platform fee configuration
    await initializePlatformFee();

    console.log('🎉 Escrow system initialization completed successfully!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('1. Configure your payment gateway credentials in environment variables');
    console.log('2. Test payment gateway connections');
    console.log('3. Start the escrow scheduler');
    console.log('4. Test the complete escrow flow');

  } catch (error) {
    console.error('❌ Escrow system initialization failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Run initialization if this script is executed directly
if (require.main === module) {
  initializeEscrowSystem();
}

module.exports = {
  initializeEscrowSystem,
  initializePaymentGateways,
  initializePlatformFee
};
