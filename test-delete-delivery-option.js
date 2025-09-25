const mongoose = require('mongoose');
const DeliveryOption = require('./db/models/deliveryOptionModel');
const ShippingProvider = require('./db/models/shippingProviderModel');
const User = require('./db/models/userModel');
require('dotenv').config();

async function testDeleteDeliveryOption() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Check if shipping providers exist
    const providers = await ShippingProvider.find();
    console.log('Available shipping providers:', providers.map(p => ({ name: p.name, displayName: p.displayName })));

    // Check if there are any delivery options
    const deliveryOptions = await DeliveryOption.find().populate('shippingProvider user');
    console.log('Existing delivery options:', deliveryOptions.length);
    
    if (deliveryOptions.length > 0) {
      console.log('Sample delivery option:', {
        id: deliveryOptions[0]._id,
        user: deliveryOptions[0].user?.email || 'No user',
        provider: deliveryOptions[0].shippingProvider?.displayName || 'No provider'
      });
    }

    // Check the specific delivery option ID from the error
    const specificId = '6864b9687830861a252d28ed';
    const specificOption = await DeliveryOption.findById(specificId).populate('shippingProvider user');

    if (specificOption) {
      console.log('Found specific delivery option:', {
        id: specificOption._id,
        user: specificOption.user?.email || 'No user',
        provider: specificOption.shippingProvider?.displayName || 'No provider',
        providerName: specificOption.shippingProvider?.name || 'No provider name',
        providerId: specificOption.shippingProvider?._id || 'No provider ID'
      });
    } else {
      console.log('Specific delivery option not found:', specificId);
    }

    // Check if the problematic provider ID exists
    const problematicProviderId = '685ea01d3affaf07e1fb8b25';
    const problematicProvider = await ShippingProvider.findById(problematicProviderId);

    if (problematicProvider) {
      console.log('Found problematic provider:', {
        id: problematicProvider._id,
        name: problematicProvider.name,
        displayName: problematicProvider.displayName,
        isActive: problematicProvider.isActive
      });
    } else {
      console.log('Problematic provider not found:', problematicProviderId);
    }

    process.exit(0);
  } catch (error) {
    console.error('Test error:', error);
    process.exit(1);
  }
}

testDeleteDeliveryOption();
