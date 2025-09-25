const mongoose = require('mongoose');
const ShippingProvider = require('../db/models/shippingProviderModel');
require('dotenv').config();

async function addZajelProvider() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Check if Zajel provider already exists
    const existingProvider = await ShippingProvider.findOne({ name: 'zajel' });
    
    if (existingProvider) {
      console.log('Zajel provider already exists');
      return;
    }

    // Create Zajel shipping provider
    const zajelProvider = new ShippingProvider({
      name: 'zajel',
      displayName: 'Zajel',
      description: 'Fast and reliable shipping across the Middle East and beyond',
      isActive: true,
      
      configuration: {
        zajel: {
          apiKey: process.env.ZAJEL_API_KEY || '',
          secretKey: process.env.ZAJEL_SECRET_KEY || '',
          accountId: process.env.ZAJEL_ACCOUNT_ID || '',
          environment: process.env.ZAJEL_ENVIRONMENT || 'sandbox'
        }
      },
      
      supportedServices: [
        {
          serviceCode: 'ZAJ_STD',
          serviceName: 'Zajel Standard',
          description: 'Standard delivery service with tracking',
          estimatedDays: { min: 2, max: 4 },
          isActive: true
        },
        {
          serviceCode: 'ZAJ_EXP',
          serviceName: 'Zajel Express',
          description: 'Express delivery with priority handling',
          estimatedDays: { min: 1, max: 2 },
          isActive: true
        },
        {
          serviceCode: 'ZAJ_SAME',
          serviceName: 'Zajel Same Day',
          description: 'Same day delivery for urgent shipments',
          estimatedDays: { min: 0, max: 1 },
          isActive: true
        },
        {
          serviceCode: 'ZAJ_COD',
          serviceName: 'Zajel Cash on Delivery',
          description: 'Cash on delivery service',
          estimatedDays: { min: 2, max: 4 },
          isActive: true
        }
      ],
      
      supportedCountries: [
        { countryCode: 'AE', countryName: 'United Arab Emirates', isActive: true },
        { countryCode: 'SA', countryName: 'Saudi Arabia', isActive: true },
        { countryCode: 'KW', countryName: 'Kuwait', isActive: true },
        { countryCode: 'QA', countryName: 'Qatar', isActive: true },
        { countryCode: 'BH', countryName: 'Bahrain', isActive: true },
        { countryCode: 'OM', countryName: 'Oman', isActive: true },
        { countryCode: 'JO', countryName: 'Jordan', isActive: true },
        { countryCode: 'LB', countryName: 'Lebanon', isActive: true },
        { countryCode: 'EG', countryName: 'Egypt', isActive: true },
        { countryCode: 'US', countryName: 'United States', isActive: true },
        { countryCode: 'GB', countryName: 'United Kingdom', isActive: true },
        { countryCode: 'DE', countryName: 'Germany', isActive: true },
        { countryCode: 'FR', countryName: 'France', isActive: true },
        { countryCode: 'IN', countryName: 'India', isActive: true },
        { countryCode: 'PK', countryName: 'Pakistan', isActive: true }
      ],
      
      pricing: {
        baseFee: 1.5,
        perKgRate: 1.5,
        fuelSurcharge: 0.1,
        currency: 'USD'
      },
      
      features: {
        tracking: true,
        insurance: true,
        cashOnDelivery: true,
        signatureRequired: true
      },
      
      limits: {
        maxWeight: 50, // kg
        maxDimensions: {
          length: 120,
          width: 80,
          height: 80,
          unit: 'cm'
        },
        maxValue: 50000 // USD
      },
      
      statistics: {
        totalShipments: 0,
        successfulDeliveries: 0,
        averageDeliveryTime: 48, // hours
        lastUsed: null
      }
    });

    await zajelProvider.save();
    console.log('✅ Zajel shipping provider added successfully');
    console.log('Provider ID:', zajelProvider._id);

  } catch (error) {
    console.error('❌ Error adding Zajel provider:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  addZajelProvider();
}

module.exports = addZajelProvider;
