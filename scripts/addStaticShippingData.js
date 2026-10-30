const mongoose = require('mongoose');
const ShippingProvider = require('../db/models/shippingProviderModel');
require('dotenv').config();

const staticShippingProviders = [
  {
    name: 'local_pickup',
    displayName: 'Local Pickup',
    description: 'Pick up your order directly from the seller',
    isActive: true,
    configuration: {
      local: {
        enabled: true,
        maxDistance: 50, // km
        operatingHours: {
          start: '09:00',
          end: '18:00'
        }
      }
    },
    supportedServices: [
      {
        serviceCode: 'LOCAL_PICKUP',
        serviceName: 'Local Pickup',
        description: 'Pick up from seller location',
        estimatedDays: { min: 0, max: 1 },
        isActive: true,
        features: ['free', 'same_day', 'contactless']
      }
    ],
    pricing: {
      baseFee: 0,
      perKgRate: 0,
      currency: 'USD',
      freeShippingThreshold: 0
    },
    coverage: {
      countries: ['United Arab Emirates'],
      regions: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain']
    },
    settings: {
      requiresSignature: false,
      allowsCashOnDelivery: true,
      providesInsurance: false,
      maxWeight: 50, // kg
      maxDimensions: {
        length: 100,
        width: 100,
        height: 100
      }
    }
  },
  {
    name: 'local_dropoff',
    displayName: 'Drop-off Point',
    description: 'Collect your order from convenient drop-off locations',
    isActive: true,
    configuration: {
      local: {
        enabled: true,
        locations: [
          {
            name: 'Dubai Mall Collection Point',
            address: 'Dubai Mall, Ground Floor, Dubai',
            coordinates: { lat: 25.1972, lng: 55.2796 },
            operatingHours: {
              monday: { start: '10:00', end: '22:00' },
              tuesday: { start: '10:00', end: '22:00' },
              wednesday: { start: '10:00', end: '22:00' },
              thursday: { start: '10:00', end: '22:00' },
              friday: { start: '10:00', end: '24:00' },
              saturday: { start: '10:00', end: '24:00' },
              sunday: { start: '10:00', end: '22:00' }
            }
          },
          {
            name: 'Mall of the Emirates Collection Point',
            address: 'Mall of the Emirates, Level 1, Dubai',
            coordinates: { lat: 25.1181, lng: 55.2008 },
            operatingHours: {
              monday: { start: '10:00', end: '22:00' },
              tuesday: { start: '10:00', end: '22:00' },
              wednesday: { start: '10:00', end: '22:00' },
              thursday: { start: '10:00', end: '22:00' },
              friday: { start: '10:00', end: '24:00' },
              saturday: { start: '10:00', end: '24:00' },
              sunday: { start: '10:00', end: '22:00' }
            }
          }
        ]
      }
    },
    supportedServices: [
      {
        serviceCode: 'LOCAL_DROPOFF',
        serviceName: 'Drop-off Point Collection',
        description: 'Collect from designated drop-off points',
        estimatedDays: { min: 0, max: 2 },
        isActive: true,
        features: ['low_cost', 'convenient', 'secure']
      }
    ],
    pricing: {
      baseFee: 1.5, // ~$1.5 USD equivalent
      perKgRate: 0,
      currency: 'USD',
      freeShippingThreshold: 55 // ~$55 USD equivalent
    },
    coverage: {
      countries: ['United Arab Emirates'],
      regions: ['Dubai', 'Abu Dhabi', 'Sharjah']
    },
    settings: {
      requiresSignature: true,
      allowsCashOnDelivery: false,
      providesInsurance: true,
      maxWeight: 30,
      maxDimensions: {
        length: 80,
        width: 80,
        height: 80
      }
    }
  },
  {
    name: 'aramex',
    displayName: 'Aramex',
    description: 'Professional courier service with tracking',
    isActive: true,
    configuration: {
      aramex: {
        username: process.env.ARAMEX_USERNAME || 'demo_username',
        password: process.env.ARAMEX_PASSWORD || 'demo_password',
        accountNumber: process.env.ARAMEX_ACCOUNT_NUMBER || 'demo_account',
        environment: process.env.NODE_ENV === 'production' ? 'live' : 'sandbox'
      }
    },
    supportedServices: [
      {
        serviceCode: 'PPX',
        serviceName: 'Priority Parcel Express',
        description: 'Fast and reliable express delivery',
        estimatedDays: { min: 1, max: 3 },
        isActive: true,
        features: ['tracking', 'insurance', 'express']
      },
      {
        serviceCode: 'PDX',
        serviceName: 'Priority Document Express',
        description: 'Express document delivery',
        estimatedDays: { min: 1, max: 2 },
        isActive: true,
        features: ['tracking', 'express', 'documents']
      }
    ],
    pricing: {
      baseFee: 25,
      perKgRate: 8,
      currency: 'AED',
      freeShippingThreshold: 500
    },
    coverage: {
      countries: ['United Arab Emirates', 'Saudi Arabia', 'Kuwait', 'Qatar', 'Bahrain', 'Oman'],
      regions: ['GCC', 'Middle East']
    },
    settings: {
      requiresSignature: true,
      allowsCashOnDelivery: true,
      providesInsurance: true,
      maxWeight: 100,
      maxDimensions: {
        length: 150,
        width: 150,
        height: 150
      }
    }
  },
  {
    name: 'fetchr',
    displayName: 'Fetchr',
    description: 'Last-mile delivery specialist',
    isActive: true,
    configuration: {
      fetchr: {
        apiKey: process.env.FETCHR_API_KEY || 'demo_api_key',
        environment: process.env.NODE_ENV === 'production' ? 'live' : 'sandbox'
      }
    },
    supportedServices: [
      {
        serviceCode: 'SAME_DAY',
        serviceName: 'Same Day Delivery',
        description: 'Delivery within the same day',
        estimatedDays: { min: 0, max: 1 },
        isActive: true,
        features: ['same_day', 'tracking', 'fast']
      },
      {
        serviceCode: 'NEXT_DAY',
        serviceName: 'Next Day Delivery',
        description: 'Delivery by next business day',
        estimatedDays: { min: 1, max: 2 },
        isActive: true,
        features: ['next_day', 'tracking', 'reliable']
      }
    ],
    pricing: {
      baseFee: 5,
      perKgRate: 5,
      currency: 'AED',
      freeShippingThreshold: 300
    },
    coverage: {
      countries: ['United Arab Emirates'],
      regions: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman']
    },
    settings: {
      requiresSignature: false,
      allowsCashOnDelivery: true,
      providesInsurance: false,
      maxWeight: 50,
      maxDimensions: {
        length: 120,
        width: 120,
        height: 120
      }
    }
  },
  {
    name: 'dhl',
    displayName: 'DHL Express',
    description: 'International express delivery service',
    isActive: true,
    configuration: {
      dhl: {
        apiKey: process.env.DHL_API_KEY || 'demo_api_key',
        environment: process.env.NODE_ENV === 'production' ? 'live' : 'sandbox'
      }
    },
    supportedServices: [
      {
        serviceCode: 'EXPRESS',
        serviceName: 'DHL Express Worldwide',
        description: 'International express delivery',
        estimatedDays: { min: 2, max: 5 },
        isActive: true,
        features: ['international', 'tracking', 'insurance', 'express']
      },
      {
        serviceCode: 'DOMESTIC',
        serviceName: 'DHL Domestic Express',
        description: 'Domestic express delivery',
        estimatedDays: { min: 1, max: 3 },
        isActive: true,
        features: ['domestic', 'tracking', 'express']
      }
    ],
    pricing: {
      baseFee: 35,
      perKgRate: 12,
      currency: 'AED',
      freeShippingThreshold: 1000
    },
    coverage: {
      countries: ['Worldwide'],
      regions: ['Global']
    },
    settings: {
      requiresSignature: true,
      allowsCashOnDelivery: false,
      providesInsurance: true,
      maxWeight: 200,
      maxDimensions: {
        length: 200,
        width: 200,
        height: 200
      }
    }
  }
];

async function addStaticShippingData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/souq');
    console.log('Connected to MongoDB');

    // Clear existing shipping providers
    await ShippingProvider.deleteMany({});
    console.log('Cleared existing shipping providers');

    // Add static shipping providers
    const createdProviders = await ShippingProvider.insertMany(staticShippingProviders);
    console.log(`Added ${createdProviders.length} shipping providers:`);
    
    createdProviders.forEach(provider => {
      console.log(`- ${provider.displayName} (${provider.name})`);
    });

    console.log('\n✅ Static shipping data added successfully!');
    
    // Display summary
    console.log('\n📊 Summary:');
    console.log(`Total Providers: ${createdProviders.length}`);
    console.log(`Active Providers: ${createdProviders.filter(p => p.isActive).length}`);
    console.log(`Total Services: ${createdProviders.reduce((sum, p) => sum + p.supportedServices.length, 0)}`);

  } catch (error) {
    console.error('❌ Error adding static shipping data:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the script
if (require.main === module) {
  addStaticShippingData();
}

module.exports = { addStaticShippingData, staticShippingProviders };
