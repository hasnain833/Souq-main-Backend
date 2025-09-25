require('dotenv').config();
const mongoose = require('mongoose');
const ShippingProvider = require('../db/models/shippingProviderModel');
const shippingFactory = require('../services/shipping/ShippingServiceFactory');

const testInactiveProviders = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Get all providers
    const allProviders = await ShippingProvider.find({});
    console.log('\n📦 All Shipping Providers:');
    allProviders.forEach(provider => {
      console.log(`- ${provider.displayName}: ${provider.isActive ? '✅ Active' : '❌ Inactive'}`);
    });

    // Initialize shipping factory
    console.log('\n🔄 Initializing shipping factory...');
    await shippingFactory.initialize();

    // Get factory statistics
    const stats = shippingFactory.getStatistics();
    console.log('\n📊 Shipping Factory Statistics:');
    console.log(`- Total services loaded: ${stats.totalServices}`);
    console.log(`- Healthy services: ${stats.healthyServices}`);
    console.log(`- Unhealthy services: ${stats.unhealthyServices}`);

    console.log('\n🚀 Services in factory:');
    stats.services.forEach(service => {
      console.log(`- ${service.displayName}: ${service.isHealthy ? '✅ Healthy' : '❌ Unhealthy'}`);
    });

    // Test getting rates (should only include active providers)
    console.log('\n🧪 Testing shipping rates...');
    const origin = {
      fullName: 'Test Seller',
      addressLine1: 'Dubai Mall',
      city: 'Dubai',
      country: 'United Arab Emirates',
      zipCode: '00000'
    };

    const destination = {
      fullName: 'Test Buyer',
      addressLine1: 'Abu Dhabi Mall',
      city: 'Abu Dhabi',
      country: 'United Arab Emirates',
      zipCode: '00000'
    };

    const packageDetails = {
      weight: 1,
      dimensions: { length: 20, width: 15, height: 10 },
      value: 100,
      currency: 'USD'
    };

    try {
      const rates = await shippingFactory.getAllRates(origin, destination, packageDetails);
      console.log(`\n📋 Available shipping rates: ${rates.length}`);
      rates.forEach(rate => {
        console.log(`- ${rate.provider.displayName}: ${rate.serviceName} - $${rate.cost.total}`);
      });
    } catch (rateError) {
      console.log('⚠️ Error getting rates (expected if no active providers):', rateError.message);
    }

    await mongoose.disconnect();
    console.log('\n✅ Test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
};

testInactiveProviders();
