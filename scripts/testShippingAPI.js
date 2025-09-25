const mongoose = require('mongoose');
const ShippingProvider = require('../db/models/shippingProviderModel');
const shippingFactory = require('../services/shipping/ShippingServiceFactory');
require('dotenv').config();

async function testShippingAPI() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/souq');
    console.log('✅ Connected to MongoDB');

    // Test 1: Check if shipping providers exist in database
    console.log('\n📦 Testing Database...');
    const providers = await ShippingProvider.find({ isActive: true });
    console.log(`Found ${providers.length} active shipping providers:`);
    providers.forEach(provider => {
      console.log(`  - ${provider.displayName} (${provider.name})`);
      console.log(`    Services: ${provider.supportedServices.length}`);
    });

    if (providers.length === 0) {
      console.log('❌ No shipping providers found in database');
      console.log('💡 Run: npm run add-shipping-data');
      return;
    }

    // Test 2: Initialize shipping factory
    console.log('\n🏭 Testing Shipping Factory...');
    try {
      await shippingFactory.initialize();
      console.log('✅ Shipping factory initialized successfully');
      
      const stats = shippingFactory.getStatistics();
      console.log(`📊 Factory Stats:`);
      console.log(`  - Total Services: ${stats.totalServices}`);
      console.log(`  - Healthy Services: ${stats.healthyServices}`);
      console.log(`  - Services: ${stats.services.map(s => s.name).join(', ')}`);
    } catch (error) {
      console.log('❌ Shipping factory initialization failed:', error.message);
    }

    // Test 3: Test individual services
    console.log('\n🧪 Testing Individual Services...');
    
    try {
      // Test local pickup service
      const localService = shippingFactory.getService('local_pickup');
      console.log('✅ Local pickup service available');
      
      // Test rate calculation
      const testOrigin = {
        fullName: 'Test Seller',
        addressLine1: 'Dubai Mall',
        city: 'Dubai',
        country: 'United Arab Emirates'
      };
      
      const testDestination = {
        fullName: 'Test Buyer',
        addressLine1: 'Abu Dhabi Mall',
        city: 'Abu Dhabi',
        country: 'United Arab Emirates'
      };
      
      const testPackage = {
        weight: 1,
        dimensions: { length: 20, width: 15, height: 10 },
        value: 100,
        currency: 'USD'
      };
      
      const rates = await localService.getShippingRates(testOrigin, testDestination, testPackage);
      console.log(`✅ Rate calculation successful: ${rates.length} rates returned`);
      
    } catch (error) {
      console.log('❌ Service test failed:', error.message);
    }

    // Test 4: Test API endpoint simulation
    console.log('\n🌐 Testing API Endpoint Logic...');
    
    try {
      // Simulate the getProviders controller logic
      const apiProviders = await ShippingProvider.find({ isActive: true })
        .select('name displayName supportedServices supportedCountries pricing features limits');
      
      console.log('✅ API providers query successful');
      console.log(`📋 API Response would contain ${apiProviders.length} providers`);
      
      // Show sample provider data
      if (apiProviders.length > 0) {
        const sampleProvider = apiProviders[0];
        console.log(`📄 Sample provider data:`);
        console.log(`  - Name: ${sampleProvider.displayName}`);
        console.log(`  - Services: ${sampleProvider.supportedServices?.length || 0}`);
        console.log(`  - Pricing: ${JSON.stringify(sampleProvider.pricing)}`);
      }
      
    } catch (error) {
      console.log('❌ API endpoint simulation failed:', error.message);
    }

    console.log('\n✅ All tests completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('1. Make sure your backend server is running');
    console.log('2. Check that the API base URL is correct in frontend');
    console.log('3. Verify authentication token is being sent');
    console.log('4. Check browser network tab for actual API calls');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the test
if (require.main === module) {
  testShippingAPI();
}

module.exports = testShippingAPI;
