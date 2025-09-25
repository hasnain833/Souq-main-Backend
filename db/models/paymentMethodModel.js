const mongoose = require('mongoose');

const paymentMethodSchema = new mongoose.Schema({
  // User reference
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Payment method type
  type: {
    type: String,
    required: true,
    enum: ['card', 'bank_account'],
    index: true
  },

  // Card details (for type: 'card')
  cardDetails: {
    cardholderName: {
      type: String,
      required: function() { return this.type === 'card'; }
    },
    lastFourDigits: {
      type: String,
      required: function() { return this.type === 'card'; }
    },
    cardBrand: {
      type: String,
      enum: ['visa', 'mastercard', 'amex', 'discover', 'other'],
      required: function() { return this.type === 'card'; }
    },
    expiryMonth: {
      type: String,
      required: function() { return this.type === 'card'; }
    },
    expiryYear: {
      type: String,
      required: function() { return this.type === 'card'; }
    },
    // Encrypted card number (never store plain text)
    encryptedCardNumber: {
      type: String,
      required: function() { return this.type === 'card'; }
    },
    // Gateway-specific card token
    cardToken: String,
    fingerprint: String // Unique identifier for the card
  },

  // Bank account details (for type: 'bank_account')
  bankDetails: {
    accountHolderName: {
      type: String,
      required: function() { return this.type === 'bank_account'; }
    },
    bankName: String,
    accountType: {
      type: String,
      enum: ['checking', 'savings'],
      required: function() { return this.type === 'bank_account'; }
    },
    // Encrypted account number (never store plain text)
    encryptedAccountNumber: {
      type: String,
      required: function() { return this.type === 'bank_account'; }
    },
    lastFourDigits: {
      type: String,
      required: function() { return this.type === 'bank_account'; }
    },
    routingNumber: {
      type: String,
      required: function() { return this.type === 'bank_account'; }
    },
    // Gateway-specific bank token
    bankToken: String
  },

  // Billing address
  billingAddress: {
    street1: String,
    street2: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },

  // Status and verification
  isDefault: {
    type: Boolean,
    default: false
  },

  isVerified: {
    type: Boolean,
    default: false
  },

  isActive: {
    type: Boolean,
    default: true
  },

  // Gateway information
  paymentGateway: {
    type: String,
    enum: ['stripe', 'paytabs', 'paypal', 'payfort', 'checkout'],
    default: 'stripe'
  },

  gatewayCustomerId: String,
  gatewayPaymentMethodId: String,

  // Metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Verification attempts
  verificationAttempts: {
    type: Number,
    default: 0
  },

  lastVerificationAttempt: Date,

  // Usage tracking
  lastUsed: Date,
  usageCount: {
    type: Number,
    default: 0
  }

}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      // Remove sensitive data from JSON output
      delete ret.encryptedCardNumber;
      delete ret.encryptedAccountNumber;
      delete ret.cardToken;
      delete ret.bankToken;
      delete ret.gatewayPaymentMethodId;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for performance
paymentMethodSchema.index({ user: 1, type: 1 });
paymentMethodSchema.index({ user: 1, isDefault: 1 });
paymentMethodSchema.index({ user: 1, isActive: 1 });
paymentMethodSchema.index({ fingerprint: 1 });
paymentMethodSchema.index({ gatewayCustomerId: 1 });

// Virtual for masked card number
paymentMethodSchema.virtual('maskedCardNumber').get(function() {
  if (this.type === 'card' && this.lastFourDigits) {
    return `**** **** **** ${this.lastFourDigits}`;
  }
  return null;
});

// Virtual for masked account number
paymentMethodSchema.virtual('maskedAccountNumber').get(function() {
  if (this.type === 'bank_account' && this.lastFourDigits) {
    return `****${this.lastFourDigits}`;
  }
  return null;
});

// Pre-save middleware to ensure only one default payment method per user
paymentMethodSchema.pre('save', async function(next) {
  if (this.isDefault && this.isModified('isDefault')) {
    // Remove default flag from other payment methods of the same user
    await this.constructor.updateMany(
      { 
        user: this.user, 
        _id: { $ne: this._id },
        type: this.type 
      },
      { isDefault: false }
    );
  }
  next();
});

// Static method to get user's default payment method
paymentMethodSchema.statics.getDefaultPaymentMethod = function(userId, type = null) {
  const query = { user: userId, isDefault: true, isActive: true };
  if (type) {
    query.type = type;
  }
  return this.findOne(query);
};

// Static method to get user's payment methods
paymentMethodSchema.statics.getUserPaymentMethods = function(userId, type = null) {
  const query = { user: userId, isActive: true };
  if (type) {
    query.type = type;
  }
  return this.find(query).sort({ isDefault: -1, createdAt: -1 });
};

// Instance method to set as default
paymentMethodSchema.methods.setAsDefault = async function() {
  // Remove default flag from other payment methods
  await this.constructor.updateMany(
    { 
      user: this.user, 
      _id: { $ne: this._id },
      type: this.type 
    },
    { isDefault: false }
  );
  
  // Set this as default
  this.isDefault = true;
  return this.save();
};

// Instance method to soft delete
paymentMethodSchema.methods.softDelete = function() {
  this.isActive = false;
  return this.save();
};

module.exports = mongoose.model('PaymentMethod', paymentMethodSchema);
