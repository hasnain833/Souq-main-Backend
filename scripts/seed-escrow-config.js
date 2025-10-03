require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../db');
const PlatformFee = require('../db/models/platformFeeModel');
const PaymentGateway = require('../db/models/paymentGatewayModel');

(async () => {
  try {
    if (!process.env.MONGODB_URI && !process.env.DB_URI) {
      console.warn('⚠️ No Mongo URI in env (MONGODB_URI or DB_URI). Using default connection from ../db');
    }

    await connectDB();
    console.log('✅ Connected to database');

    // Seed PlatformFee if none exists
    let fee = await PlatformFee.findOne({ isActive: true }).sort({ createdAt: -1 });
    if (!fee) {
      fee = new PlatformFee({
        feeType: 'percentage',
        defaultPercentage: 10,
        defaultFixedAmount: 0,
        currencyFees: [
          { currency: 'USD', percentage: 10, fixedAmount: 0 },
          { currency: 'AED', percentage: 10, fixedAmount: 0 },
          { currency: 'EUR', percentage: 10, fixedAmount: 0 },
          { currency: 'GBP', percentage: 10, fixedAmount: 0 },
          { currency: 'SAR', percentage: 10, fixedAmount: 0 },
        ],
        isActive: true,
      });
      await fee.save();
      console.log('🆕 PlatformFee created with 10% default');
    } else {
      console.log('ℹ️ PlatformFee already present');
    }

    // Upsert Stripe gateway
    const stripeUpdate = {
      displayName: 'Stripe',
      isActive: true,
      isTestMode: true,
      supportedCurrencies: ['USD', 'AED', 'EUR', 'GBP', 'SAR'],
      supportedPaymentMethods: ['credit_card', 'apple_pay', 'google_pay'],
      feeStructure: { fixedFee: 0.3, percentageFee: 2.9, minimumFee: 0 },
      configuration: {
        stripe: {
          publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
          secretKey: process.env.STRIPE_SECRET_KEY || null,
          webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || null,
        },
      },
    };
    await PaymentGateway.updateOne(
      { gatewayName: 'stripe' },
      { $set: { gatewayName: 'stripe', ...stripeUpdate } },
      { upsert: true }
    );
    console.log('✅ Stripe gateway upserted');

    // Upsert PayPal gateway
    const paypalUpdate = {
      displayName: 'PayPal',
      isActive: true,
      isTestMode: true,
      supportedCurrencies: ['USD', 'AED', 'EUR', 'GBP', 'SAR'],
      supportedPaymentMethods: ['credit_card', 'wallet'],
      feeStructure: { fixedFee: 0.49, percentageFee: 3.49, minimumFee: 0 },
      configuration: {
        paypal: {
          clientId: process.env.PAYPAL_CLIENT_ID || null,
          clientSecret: process.env.PAYPAL_CLIENT_SECRET || null,
          environment: process.env.PAYPAL_ENV || 'sandbox',
        },
      },
    };
    await PaymentGateway.updateOne(
      { gatewayName: 'paypal' },
      { $set: { gatewayName: 'paypal', ...paypalUpdate } },
      { upsert: true }
    );
    console.log('✅ PayPal gateway upserted');

    console.log('🎉 Seeding complete');
  } catch (err) {
    console.error('❌ Seed failed:', err?.message || err);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
})();
