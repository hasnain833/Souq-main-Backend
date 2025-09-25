const mongoose = require('mongoose');
const DeliveryOption = require('./db/models/deliveryOptionModel');
const ShippingProvider = require('./db/models/shippingProviderModel');
require('dotenv').config();

async function testPickupLocations() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Check if shipping providers exist
    const providers = await ShippingProvider.find();
    console.log('Available shipping providers:', providers.map(p => ({ 
      id: p._id, 
      name: p.name, 
      displayName: p.displayName,
      isActive: p.isActive 
    })));

    // Check existing delivery options
    const deliveryOptions = await DeliveryOption.find().populate('shippingProvider user');
    console.log('\nExisting delivery options:', deliveryOptions.length);
    
    deliveryOptions.forEach(opt => {
      console.log(`- ${opt._id}: ${opt.shippingProvider?.name} (${opt.shippingProvider?.displayName})`);
      if (opt.settings?.pickup?.enabled) {
        console.log(`  Pickup: ${opt.settings.pickup.name || 'No name'} - ${opt.settings.pickup.address?.street1 || 'No address'}`);
      }
      if (opt.settings?.dropoff?.enabled) {
        console.log(`  Dropoff: ${opt.settings.dropoff.locations?.length || 0} locations`);
      }
    });

    // Test creating a pickup location
    const localPickupProvider = await ShippingProvider.findOne({ name: 'local_pickup' });
    if (!localPickupProvider) {
      console.log('\n❌ local_pickup provider not found. Run: npm run init-shipping');
      process.exit(1);
    }

    console.log('\n✅ local_pickup provider found:', localPickupProvider.displayName);
    
    process.exit(0);
  } catch (error) {
    console.error('Test error:', error);
    process.exit(1);
  }
}

testPickupLocations();
