const mongoose = require('mongoose');

const trackingSchema = new mongoose.Schema({
  // Order reference - can be from any order type
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  
  // Order type to know which collection to reference
  orderType: {
    type: String,
    enum: ['transaction', 'standardPayment', 'order'],
    required: true
  },
  
  // Transaction ID for easy reference
  transactionId: {
    type: String,
    required: true,
    index: true
  },
  
  // User references
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Product reference
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  
  // Shipping provider details
  shippingProvider: {
    name: {
      type: String,
      required: true,
      enum: [
        'emirates_post',
        'aramex',
        'dhl',
        'fedex',
        'ups',
        'smsa',
        'naqel',
        'zajil',
        'other'
      ]
    },
    serviceType: String, // Express, Standard, Economy, etc.
    website: String,
    contactNumber: String
  },
  
  // Tracking information
  trackingId: {
    type: String,
    required: true,
    index: true
  },
  
  trackingUrl: {
    type: String,
    required: true
  },
  
  // AfterShip integration
  aftershipTracking: {
    slug: String, // AfterShip courier slug
    trackingNumber: String,
    aftershipId: String,
    trackingUrl: String,
    isActive: {
      type: Boolean,
      default: false
    }
  },
  
  // Shipping details
  shippingDetails: {
    shippedDate: {
      type: Date,
      default: Date.now
    },
    estimatedDelivery: Date,
    actualDelivery: Date,
    
    // Package details
    packageDetails: {
      weight: Number, // in kg
      dimensions: {
        length: Number,
        width: Number,
        height: Number,
        unit: {
          type: String,
          default: 'cm'
        }
      },
      description: String,
      value: Number,
      currency: String
    },
    
    // Addresses
    fromAddress: {
      fullName: String,
      street1: String,
      street2: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
      phoneNumber: String
    },
    
    toAddress: {
      fullName: String,
      street1: String,
      street2: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
      phoneNumber: String
    }
  },
  
  // Tracking status
  status: {
    type: String,
    enum: [
      'shipped',
      'in_transit',
      'out_for_delivery',
      'delivered',
      'exception',
      'returned',
      'cancelled'
    ],
    default: 'shipped',
    index: true
  },
  
  // Tracking events/updates
  trackingEvents: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    status: String,
    description: String,
    location: {
      city: String,
      state: String,
      country: String,
      facility: String
    },
    eventCode: String,
    source: {
      type: String,
      enum: ['manual', 'webhook', 'api_sync', 'aftership'],
      default: 'manual'
    }
  }],
  
  // Delivery confirmation
  deliveryConfirmation: {
    isDelivered: {
      type: Boolean,
      default: false
    },
    deliveredAt: Date,
    deliveredTo: String,
    signature: String,
    deliveryProof: {
      type: String, // URL to delivery proof image
    },
    confirmedBy: {
      type: String,
      enum: ['buyer', 'system', 'shipping_provider']
    },
    confirmationDate: Date
  },
  
  // Notifications
  notifications: {
    buyerNotified: {
      type: Boolean,
      default: false
    },
    sellerNotified: {
      type: Boolean,
      default: false
    },
    lastNotificationSent: Date,
    notificationPreferences: {
      sms: {
        type: Boolean,
        default: true
      },
      email: {
        type: Boolean,
        default: true
      },
      push: {
        type: Boolean,
        default: true
      }
    }
  },
  
  // Additional metadata
  metadata: {
    sellerNotes: String,
    shippingInstructions: String,
    specialHandling: String,
    insurance: {
      isInsured: {
        type: Boolean,
        default: false
      },
      value: Number,
      currency: String
    }
  },
  
  // System fields
  isActive: {
    type: Boolean,
    default: true
  },
  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  lastUpdated: {
    type: Date,
    default: Date.now
  }
  
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for performance
trackingSchema.index({ orderId: 1, orderType: 1 });
trackingSchema.index({ buyer: 1, status: 1 });
trackingSchema.index({ seller: 1, status: 1 });
// trackingSchema.index({ trackingId: 1 }); // Duplicate of field-level index: true
// trackingSchema.index({ transactionId: 1 }); // Duplicate of field-level index: true
trackingSchema.index({ 'shippingProvider.name': 1 });
trackingSchema.index({ createdAt: -1 });
trackingSchema.index({ 'aftershipTracking.aftershipId': 1 });

// Virtual for tracking URL with fallback
trackingSchema.virtual('fullTrackingUrl').get(function() {
  if (this.aftershipTracking.isActive && this.aftershipTracking.trackingUrl) {
    return this.aftershipTracking.trackingUrl;
  }
  return this.trackingUrl;
});

// Pre-save middleware to update lastUpdated
trackingSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

// Instance methods
trackingSchema.methods.addTrackingEvent = function(eventData) {
  this.trackingEvents.push({
    timestamp: eventData.timestamp || new Date(),
    status: eventData.status,
    description: eventData.description,
    location: eventData.location,
    eventCode: eventData.eventCode,
    source: eventData.source || 'manual'
  });
  
  // Update main status if provided
  if (eventData.status) {
    this.status = eventData.status;
  }
  
  return this.save();
};

trackingSchema.methods.markAsDelivered = function(deliveryData = {}) {
  this.status = 'delivered';
  this.deliveryConfirmation.isDelivered = true;
  this.deliveryConfirmation.deliveredAt = deliveryData.deliveredAt || new Date();
  this.deliveryConfirmation.deliveredTo = deliveryData.deliveredTo;
  this.deliveryConfirmation.signature = deliveryData.signature;
  this.deliveryConfirmation.deliveryProof = deliveryData.deliveryProof;
  this.deliveryConfirmation.confirmedBy = deliveryData.confirmedBy || 'system';
  this.deliveryConfirmation.confirmationDate = new Date();
  
  // Add delivery event
  this.trackingEvents.push({
    timestamp: new Date(),
    status: 'delivered',
    description: 'Package delivered successfully',
    source: 'manual'
  });
  
  return this.save();
};

// Static methods
trackingSchema.statics.findByOrderId = function(orderId, orderType) {
  return this.findOne({ orderId, orderType, isActive: true });
};

trackingSchema.statics.findByTrackingId = function(trackingId) {
  return this.findOne({ trackingId, isActive: true });
};

trackingSchema.statics.findByTransactionId = function(transactionId) {
  return this.findOne({ transactionId, isActive: true });
};

module.exports = mongoose.model('Tracking', trackingSchema);