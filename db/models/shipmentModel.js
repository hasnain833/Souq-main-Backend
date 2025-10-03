const mongoose = require('mongoose');

const shipmentSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  
  shippingProvider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ShippingProvider',
    required: true
  },
  
  // Provider-specific shipment ID
  providerShipmentId: {
    type: String,
    required: true
  },
  
  trackingNumber: {
    type: String,
    required: true,
    unique: true
  },
  
  // Shipment details
  shipmentDetails: {
    serviceCode: String,
    serviceName: String,
    reference: String,
    description: String,
    
    // Package information
    packages: [{
      packageId: String,
      weight: Number,
      dimensions: {
        length: Number,
        width: Number,
        height: Number,
        unit: String
      },
      value: Number,
      currency: String,
      contents: String
    }],
    
    // Addresses
    origin: {
      name: String,
      company: String,
      street1: String,
      street2: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
      countryCode: String,
      phone: String,
      email: String
    },

    destination: {
      name: String,
      company: String,
      street1: String,
      street2: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
      countryCode: String,
      phone: String,
      email: String
    }
  },
  
  // Tracking information
  tracking: {
    status: {
      type: String,
      enum: [
        'created',
        'picked_up',
        'in_transit',
        'out_for_delivery',
        'delivered',
        'exception',
        'returned',
        'cancelled'
      ],
      default: 'created'
    },
    
    lastUpdate: Date,
    
    events: [{
      timestamp: Date,
      status: String,
      description: String,
      location: {
        city: String,
        state: String,
        country: String,
        facility: String
      },
      eventCode: String,
      eventType: String
    }],
    
    estimatedDelivery: Date,
    actualDelivery: Date,
    
    // Delivery details
    deliveryDetails: {
      deliveredTo: String,
      signature: String,
      deliveryLocation: String,
      deliveryInstructions: String,
      proofOfDelivery: {
        type: String,
        url: String
      }
    }
  },
  
  // Costs and billing
  costs: {
    baseFee: Number,
    fuelSurcharge: Number,
    insurance: Number,
    additionalServices: Number,
    taxes: Number,
    total: Number,
    currency: String,
    
    // Provider billing details
    providerInvoiceId: String,
    billingDate: Date,
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending'
    }
  },
  
  // Special services
  services: {
    insurance: {
      enabled: Boolean,
      value: Number,
      currency: String
    },
    cashOnDelivery: {
      enabled: Boolean,
      amount: Number,
      currency: String
    },
    signatureRequired: Boolean,
    saturdayDelivery: Boolean,
    holdForPickup: Boolean
  },
  
  // Labels and documentation
  documentation: {
    shippingLabel: {
      url: String,
      format: String, // PDF, PNG, etc.
      generated: Date
    },
    commercialInvoice: {
      url: String,
      format: String,
      generated: Date
    },
    customsDeclaration: {
      url: String,
      format: String,
      generated: Date
    }
  },
  
  // Provider response data
  providerData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Status and metadata
  status: {
    type: String,
    enum: ['active', 'cancelled', 'completed', 'failed'],
    default: 'active'
  },
  
  notifications: {
    buyerNotified: {
      type: Boolean,
      default: false
    },
    sellerNotified: {
      type: Boolean,
      default: false
    },
    lastNotificationSent: Date
  },
  
  // Error handling
  errors: [{
    timestamp: Date,
    errorCode: String,
    errorMessage: String,
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    resolved: {
      type: Boolean,
      default: false
    }
  }]
}, {
  timestamps: true
});

// Indexes
// shipmentSchema.index({ trackingNumber: 1 }); // Duplicate of field-level unique: true
shipmentSchema.index({ order: 1 });
shipmentSchema.index({ shippingProvider: 1 });
shipmentSchema.index({ 'tracking.status': 1 });
shipmentSchema.index({ status: 1 });
shipmentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Shipment', shipmentSchema);
