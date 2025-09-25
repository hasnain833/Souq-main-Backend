const mongoose = require('mongoose');
const ShippingProvider = require('../db/models/shippingProviderModel');
const shippingFactory = require('../services/shipping/ShippingServiceFactory');
require('dotenv').config();

async function testZajelRates() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Find Zajel provider
    const zajelProvider = await ShippingProvider.findOne({ name: 'zajel' });
    
    if (!zajelProvider) {
      console.log('❌ Zajel provider not found');
      return;
    }

    console.log('✅ Zajel provider found:', zajelProvider.displayName);

    // Initialize shipping factory
    console.log('🔄 Initializing shipping factory...');
    await shippingFactory.initialize();
    console.log('✅ Shipping factory initialized');

    // Test shipping rates
    const origin = {
      city: 'Dubai',
      country: 'AE',
      postalCode: '12345'
    };

    const destination = {
      city: 'Abu Dhabi',
      country: 'AE',
      postalCode: '54321'
    };

    const packageDetails = {
      weight: 2, // kg
      dimensions: {
        length: 20,
        width: 15,
        height: 10
      },
      value: 100 // USD
    };

    console.log('\n🔄 Testing Zajel shipping rates...');
    console.log('Origin:', origin);
    console.log('Destination:', destination);
    console.log('Package:', packageDetails);

    // Get Zajel service
    const zajelService = shippingFactory.getService('zajel');
    
    if (!zajelService) {
      console.log('❌ Failed to get Zajel service from factory');
      return;
    }

    console.log('✅ Zajel service created');

    // Get shipping rates
    const rates = await zajelService.getShippingRates(origin, destination, packageDetails);
    
    console.log('\n📦 Zajel Shipping Rates:');
    console.log('='.repeat(50));
    
    rates.forEach((rate, index) => {
      console.log(`\n${index + 1}. ${rate.serviceName} (${rate.serviceCode})`);
      console.log(`   💰 Cost: $${rate.cost.total} ${rate.cost.currency}`);
      console.log(`   📅 Delivery: ${rate.estimatedDays.min}-${rate.estimatedDays.max} days`);
      console.log(`   ✨ Features:`);
      console.log(`      - Tracking: ${rate.features.tracking ? '✅' : '❌'}`);
      console.log(`      - Insurance: ${rate.features.insurance ? '✅' : '❌'}`);
      console.log(`      - COD: ${rate.features.cashOnDelivery ? '✅' : '❌'}`);
      console.log(`      - Signature: ${rate.features.signatureRequired ? '✅' : '❌'}`);
    });

    console.log('\n✅ Zajel rates test completed successfully!');

    // Test international shipping
    console.log('\n🌍 Testing international shipping (UAE to USA)...');
    
    const internationalDestination = {
      city: 'New York',
      country: 'US',
      postalCode: '10001'
    };

    const internationalRates = await zajelService.getShippingRates(
      origin, 
      internationalDestination, 
      packageDetails
    );

    console.log('\n📦 International Zajel Rates:');
    console.log('='.repeat(50));
    
    internationalRates.forEach((rate, index) => {
      console.log(`\n${index + 1}. ${rate.serviceName} (${rate.serviceCode})`);
      console.log(`   💰 Cost: $${rate.cost.total} ${rate.cost.currency}`);
      console.log(`   📅 Delivery: ${rate.estimatedDays.min}-${rate.estimatedDays.max} days`);
    });

  } catch (error) {
    console.error('❌ Error testing Zajel rates:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the test
if (require.main === module) {
  testZajelRates();
}

module.exports = testZajelRates;
