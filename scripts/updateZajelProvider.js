const mongoose = require('mongoose');
const ShippingProvider = require('../db/models/shippingProviderModel');
require('dotenv').config();

async function updateZajelProvider() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Update Zajel provider with basic configuration
    const result = await ShippingProvider.findOneAndUpdate(
      { name: 'zajel' },
      {
        $set: {
          configuration: {
            zajel: {
              apiKey: process.env.ZAJEL_API_KEY || 'demo_key',
              secretKey: process.env.ZAJEL_SECRET_KEY || 'demo_secret',
              accountId: process.env.ZAJEL_ACCOUNT_ID || 'demo_account',
              environment: process.env.ZAJEL_ENVIRONMENT || 'sandbox'
            }
          }
        }
      },
      { new: true }
    );

    if (result) {
      console.log('✅ Zajel provider updated successfully');
      console.log('Configuration:', result.configuration.zajel);
    } else {
      console.log('❌ Zajel provider not found');
    }

  } catch (error) {
    console.error('❌ Error updating Zajel provider:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  updateZajelProvider();
}

module.exports = updateZajelProvider;
