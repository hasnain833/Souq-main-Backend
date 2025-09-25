const mongoose = require('mongoose');
const PlatformFee = require('../db/models/platformFeeModel');
require('dotenv').config();

/**
 * Initialize platform fee configuration only
 */
async function initializePlatformFee() {
  try {
    console.log('🔄 Initializing platform fee configuration...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    const existingConfig = await PlatformFee.findOne({ isActive: true });
    if (existingConfig) {
      console.log('⚠️ Platform fee configuration already exists');
      console.log('Current config:', {
        id: existingConfig._id,
        defaultPercentage: existingConfig.defaultPercentage,
        isActive: existingConfig.isActive,
        version: existingConfig.version
      });
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
      notes: 'Initial platform fee configuration - 10% fee on all transactions with USD as base currency'
    });

    await platformFeeConfig.save();
    console.log('✅ Platform fee configuration created successfully');
    console.log('Config details:', {
      id: platformFeeConfig._id,
      defaultPercentage: platformFeeConfig.defaultPercentage,
      currencyFees: platformFeeConfig.currencyFees.length,
      isActive: platformFeeConfig.isActive
    });

  } catch (error) {
    console.error('❌ Error initializing platform fee configuration:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Run initialization if this script is executed directly
if (require.main === module) {
  initializePlatformFee()
    .then(() => {
      console.log('🎉 Platform fee initialization completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Platform fee initialization failed:', error);
      process.exit(1);
    });
}

module.exports = { initializePlatformFee };
