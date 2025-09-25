const mongoose = require('mongoose');
const ShippingProvider = require('../db/models/shippingProviderModel');
require('dotenv').config();

const shippingProviders = [
  {
    name: 'aramex',
    displayName: 'Aramex',
    isActive: true,
    configuration: {
      aramex: {
        username: process.env.ARAMEX_USERNAME || '',
        password: process.env.ARAMEX_PASSWORD || '',
        accountNumber: process.env.ARAMEX_ACCOUNT_NUMBER || '',
        accountPin: process.env.ARAMEX_ACCOUNT_PIN || '',
        accountEntity: process.env.ARAMEX_ACCOUNT_ENTITY || 'DXB',
        accountCountryCode: process.env.ARAMEX_ACCOUNT_COUNTRY_CODE || 'AE',
        version: 'v1.0',
        environment: process.env.ARAMEX_ENVIRONMENT || 'sandbox'
      }
    },
    supportedServices: [
      {
        serviceCode: 'PDX',
        serviceName: 'Priority Document Express',
        description: 'Fast document delivery service',
        estimatedDays: { min: 1, max: 3 },
        isActive: true
      },
      {
        serviceCode: 'PPX',
        serviceName: 'Priority Parcel Express',
        description: 'Fast parcel delivery service',
        estimatedDays: { min: 1, max: 3 },
        isActive: true
      },
      {
        serviceCode: 'GDX',
        serviceName: 'Ground Document Express',
        description: 'Standard document delivery',
        estimatedDays: { min: 2, max: 5 },
        isActive: true
      },
      {
        serviceCode: 'GPX',
        serviceName: 'Ground Parcel Express',
        description: 'Standard parcel delivery',
        estimatedDays: { min: 2, max: 5 },
        isActive: true
      }
    ],
    supportedCountries: [
      { countryCode: 'AE', countryName: 'United Arab Emirates', isActive: true },
      { countryCode: 'SA', countryName: 'Saudi Arabia', isActive: true },
      { countryCode: 'KW', countryName: 'Kuwait', isActive: true },
      { countryCode: 'QA', countryName: 'Qatar', isActive: true },
      { countryCode: 'BH', countryName: 'Bahrain', isActive: true },
      { countryCode: 'OM', countryName: 'Oman', isActive: true }
    ],
    pricing: {
      baseFee: 1.5, // ~$7 USD equivalent
      perKgRate: 1.5, // ~$1.5 USD per kg
      fuelSurcharge: 0.15,
      currency: 'USD'
    },
    features: {
      tracking: true,
      insurance: true,
      cashOnDelivery: true,
      signatureRequired: true
    },
    limits: {
      maxWeight: 30,
      maxDimensions: {
        length: 120,
        width: 80,
        height: 80,
        unit: 'cm'
      },
      maxValue: 50000
    }
  },
  {
    name: 'fetchr',
    displayName: 'Fetchr',
    isActive: true,
    configuration: {
      fetchr: {
        apiKey: process.env.FETCHR_API_KEY || '',
        secretKey: process.env.FETCHR_SECRET_KEY || '',
        environment: process.env.FETCHR_ENVIRONMENT || 'sandbox'
      }
    },
    supportedServices: [
      {
        serviceCode: 'STD',
        serviceName: 'Standard Delivery',
        description: 'Standard delivery service',
        estimatedDays: { min: 2, max: 5 },
        isActive: true
      },
      {
        serviceCode: 'EXP',
        serviceName: 'Express Delivery',
        description: 'Express delivery service',
        estimatedDays: { min: 1, max: 2 },
        isActive: true
      },
      {
        serviceCode: 'SMD',
        serviceName: 'Same Day Delivery',
        description: 'Same day delivery service',
        estimatedDays: { min: 0, max: 1 },
        isActive: true
      },
      {
        serviceCode: 'COD',
        serviceName: 'Cash on Delivery',
        description: 'Cash on delivery service',
        estimatedDays: { min: 2, max: 5 },
        isActive: true
      }
    ],
    supportedCountries: [
      { countryCode: 'AE', countryName: 'United Arab Emirates', isActive: true },
      { countryCode: 'SA', countryName: 'Saudi Arabia', isActive: true },
      { countryCode: 'EG', countryName: 'Egypt', isActive: true },
      { countryCode: 'JO', countryName: 'Jordan', isActive: true }
    ],
    pricing: {
      baseFee: 1.5, // ~$5.5 USD equivalent
      perKgRate: 1, // ~$1 USD per kg
      fuelSurcharge: 0.12,
      currency: 'USD'
    },
    features: {
      tracking: true,
      insurance: true,
      cashOnDelivery: true,
      signatureRequired: false
    },
    limits: {
      maxWeight: 25,
      maxDimensions: {
        length: 100,
        width: 70,
        height: 70,
        unit: 'cm'
      },
      maxValue: 30000
    }
  },
  {
    name: 'dhl',
    displayName: 'DHL Express',
    isActive: true,
    configuration: {
      dhl: {
        apiKey: process.env.DHL_API_KEY || '',
        secretKey: process.env.DHL_SECRET_KEY || '',
        accountNumber: process.env.DHL_ACCOUNT_NUMBER || '',
        environment: process.env.DHL_ENVIRONMENT || 'sandbox'
      }
    },
    supportedServices: [
      {
        serviceCode: 'N',
        serviceName: 'DHL Next Day 12:00',
        description: 'Next day delivery by 12:00',
        estimatedDays: { min: 1, max: 1 },
        isActive: true
      },
      {
        serviceCode: 'S',
        serviceName: 'DHL Next Day 10:30',
        description: 'Next day delivery by 10:30',
        estimatedDays: { min: 1, max: 1 },
        isActive: true
      },
      {
        serviceCode: 'G',
        serviceName: 'DHL Next Day 9:00',
        description: 'Next day delivery by 9:00',
        estimatedDays: { min: 1, max: 1 },
        isActive: true
      },
      {
        serviceCode: 'P',
        serviceName: 'DHL Express Worldwide',
        description: 'Express worldwide delivery',
        estimatedDays: { min: 1, max: 3 },
        isActive: true
      }
    ],
    supportedCountries: [
      { countryCode: 'AE', countryName: 'United Arab Emirates', isActive: true },
      { countryCode: 'SA', countryName: 'Saudi Arabia', isActive: true },
      { countryCode: 'US', countryName: 'United States', isActive: true },
      { countryCode: 'GB', countryName: 'United Kingdom', isActive: true },
      { countryCode: 'DE', countryName: 'Germany', isActive: true },
      { countryCode: 'FR', countryName: 'France', isActive: true }
    ],
    pricing: {
      baseFee: 1.5, // ~$12 USD equivalent
      perKgRate: 1.5, // ~$2 USD per kg
      fuelSurcharge: 0.18,
      currency: 'USD'
    },
    features: {
      tracking: true,
      insurance: true,
      cashOnDelivery: false,
      signatureRequired: true
    },
    limits: {
      maxWeight: 70,
      maxDimensions: {
        length: 150,
        width: 100,
        height: 100,
        unit: 'cm'
      },
      maxValue: 100000
    }
  },
  {
    name: 'local_pickup',
    displayName: 'Local Pickup',
    isActive: true,
    configuration: {},
    supportedServices: [
      {
        serviceCode: 'LOCAL_PICKUP',
        serviceName: 'Local Pickup',
        description: 'Pickup from seller location',
        estimatedDays: { min: 0, max: 1 },
        isActive: true
      }
    ],
    supportedCountries: [
      { countryCode: 'AE', countryName: 'United Arab Emirates', isActive: true }
    ],
    pricing: {
      baseFee: 0,
      perKgRate: 0,
      fuelSurcharge: 0,
      currency: 'USD'
    },
    features: {
      tracking: true,
      insurance: false,
      cashOnDelivery: true,
      signatureRequired: false
    },
    limits: {
      maxWeight: 50,
      maxDimensions: {
        length: 200,
        width: 150,
        height: 150,
        unit: 'cm'
      },
      maxValue: 100000
    }
  },
  {
    name: 'local_dropoff',
    displayName: 'Drop-off Point',
    isActive: true,
    configuration: {},
    supportedServices: [
      {
        serviceCode: 'LOCAL_DROPOFF',
        serviceName: 'Drop-off Point',
        description: 'Drop-off at designated location',
        estimatedDays: { min: 0, max: 1 },
        isActive: true
      }
    ],
    supportedCountries: [
      { countryCode: 'AE', countryName: 'United Arab Emirates', isActive: true }
    ],
    pricing: {
      baseFee: 1.5, // ~$1.5 USD equivalent
      perKgRate: 1.5,
      fuelSurcharge: 0,
      currency: 'USD'
    },
    features: {
      tracking: true,
      insurance: false,
      cashOnDelivery: true,
      signatureRequired: false
    },
    limits: {
      maxWeight: 30,
      maxDimensions: {
        length: 100,
        width: 80,
        height: 80,
        unit: 'cm'
      },
      maxValue: 50000
    }
  }
];

async function initializeShippingProviders() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Clear existing providers
    await ShippingProvider.deleteMany({});
    console.log('Cleared existing shipping providers');

    // Insert new providers
    for (const providerData of shippingProviders) {
      const provider = new ShippingProvider(providerData);
      await provider.save();
      console.log(`Created shipping provider: ${provider.displayName}`);
    }

    console.log('Shipping providers initialized successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error initializing shipping providers:', error);
    process.exit(1);
  }
}

// Run the initialization
initializeShippingProviders();
