const mongoose = require('mongoose');

const deliveryOptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  shippingProvider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ShippingProvider',
    required: true
  },
  
  serviceCode: {
    type: String,
    required: true
  },
  
  serviceName: {
    type: String,
    required: true
  },
  
  isDefault: {
    type: Boolean,
    default: false
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  settings: {
    // Pickup settings
    pickup: {
      enabled: {
        type: Boolean,
        default: false
      },
      name: String,
      address: {
        fullName: String,
        addressLine1: String,
        addressLine2: String,
        city: String,
        state: String,
        zipCode: String,
        country: String,
        phoneNumber: String
      },
      timeSlots: [{
        day: {
          type: String,
          enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        },
        startTime: String, // HH:MM format
        endTime: String,   // HH:MM format
        isActive: {
          type: Boolean,
          default: true
        }
      }],
      instructions: String
    },
    
    // Drop-off settings
    dropoff: {
      enabled: {
        type: Boolean,
        default: false
      },
      locations: [{
        name: String,
        address: {
          street1: String,
          street2: String,
          city: String,
          state: String,
          zipCode: String,
          country: String
        },
        coordinates: {
          latitude: Number,
          longitude: Number
        },
        operatingHours: [{
          day: String,
          startTime: String,
          endTime: String,
          isActive: Boolean
        }],
        contactInfo: {
          phone: String,
          email: String
        },
        isActive: {
          type: Boolean,
          default: true
        }
      }]
    },
    
    // Local pickup/delivery settings
    localDelivery: {
      enabled: {
        type: Boolean,
        default: false
      },
      radius: {
        type: Number,
        default: 10 // km
      },
      fee: {
        type: Number,
        default: 0
      },
      estimatedTime: {
        type: Number,
        default: 24 // hours
      },
      meetingPoints: [{
        name: String,
        address: String,
        coordinates: {
          latitude: Number,
          longitude: Number
        },
        isActive: {
          type: Boolean,
          default: true
        }
      }]
    }
  },
  
  preferences: {
    autoSelectCheapest: {
      type: Boolean,
      default: false
    },
    autoSelectFastest: {
      type: Boolean,
      default: false
    },
    preferredCurrency: {
      type: String,
      default: 'AED'
    },
    includeInsurance: {
      type: Boolean,
      default: false
    },
    requireSignature: {
      type: Boolean,
      default: false
    },
    allowCashOnDelivery: {
      type: Boolean,
      default: false
    }
  },
  
  restrictions: {
    maxWeight: Number,
    maxDimensions: {
      length: Number,
      width: Number,
      height: Number
    },
    excludedCountries: [String],
    excludedPostalCodes: [String]
  }
}, {
  timestamps: true
});

// Indexes
deliveryOptionSchema.index({ user: 1 });
deliveryOptionSchema.index({ user: 1, isDefault: 1 });
deliveryOptionSchema.index({ shippingProvider: 1 });
deliveryOptionSchema.index({ isActive: 1 });

// Ensure only one default delivery option per user
deliveryOptionSchema.pre('save', async function(next) {
  if (this.isDefault && this.isModified('isDefault')) {
    await this.constructor.updateMany(
      { user: this.user, _id: { $ne: this._id } },
      { isDefault: false }
    );
  }
  next();
});

module.exports = mongoose.model('DeliveryOption', deliveryOptionSchema);
