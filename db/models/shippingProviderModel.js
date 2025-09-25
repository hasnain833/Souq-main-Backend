const mongoose = require('mongoose');

const shippingProviderSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    enum: ['aramex', 'fetchr', 'dhl', 'zajel', 'local_pickup', 'local_dropoff'],
    unique: true
  },
  
  displayName: {
    type: String,
    required: true
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  configuration: {
    // Aramex configuration
    aramex: {
      username: String,
      password: String,
      accountNumber: String,
      accountPin: String,
      accountEntity: String,
      accountCountryCode: String,
      version: {
        type: String,
        default: 'v1.0'
      },
      environment: {
        type: String,
        enum: ['sandbox', 'production'],
        default: 'sandbox'
      }
    },
    
    // Fetchr configuration
    fetchr: {
      apiKey: String,
      secretKey: String,
      environment: {
        type: String,
        enum: ['sandbox', 'production'],
        default: 'sandbox'
      }
    },
    
    // DHL configuration
    dhl: {
      apiKey: String,
      secretKey: String,
      accountNumber: String,
      environment: {
        type: String,
        enum: ['sandbox', 'production'],
        default: 'sandbox'
      }
    },

    // Zajel configuration
    zajel: {
      apiKey: String,
      secretKey: String,
      accountId: String,
      environment: {
        type: String,
        enum: ['sandbox', 'production'],
        default: 'sandbox'
      }
    }
  },
  
  supportedServices: [{
    serviceCode: String,
    serviceName: String,
    description: String,
    estimatedDays: {
      min: Number,
      max: Number
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  
  supportedCountries: [{
    countryCode: String,
    countryName: String,
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  
  pricing: {
    baseFee: {
      type: Number,
      default: 0
    },
    perKgRate: {
      type: Number,
      default: 0
    },
    fuelSurcharge: {
      type: Number,
      default: 0
    },
    currency: {
      type: String,
      default: 'USD'
    }
  },
  
  features: {
    tracking: {
      type: Boolean,
      default: true
    },
    insurance: {
      type: Boolean,
      default: false
    },
    cashOnDelivery: {
      type: Boolean,
      default: false
    },
    signatureRequired: {
      type: Boolean,
      default: false
    }
  },
  
  limits: {
    maxWeight: {
      type: Number,
      default: 30 // kg
    },
    maxDimensions: {
      length: Number,
      width: Number,
      height: Number,
      unit: {
        type: String,
        default: 'cm'
      }
    },
    maxValue: {
      type: Number,
      default: 10000 // AED
    }
  },
  
  statistics: {
    totalShipments: {
      type: Number,
      default: 0
    },
    successfulDeliveries: {
      type: Number,
      default: 0
    },
    averageDeliveryTime: {
      type: Number,
      default: 0 // in hours
    },
    lastUsed: Date
  }
}, {
  timestamps: true
});

// Indexes for better performance
shippingProviderSchema.index({ name: 1 });
shippingProviderSchema.index({ isActive: 1 });
shippingProviderSchema.index({ 'supportedCountries.countryCode': 1 });

module.exports = mongoose.model('ShippingProvider', shippingProviderSchema);
