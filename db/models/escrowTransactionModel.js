const mongoose = require('mongoose');

console.log('🔄 Loading EscrowTransaction model with street1/street2 fields');

const escrowTransactionSchema = new mongoose.Schema({
  // Transaction identifiers
  transactionId: {
    type: String,
    unique: true,
    required: true,
    default: function() {
      return 'ESC-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    }
  },
  
  // Related entities
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  offer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Offer',
    default: null // Can be null for direct purchases
  },
  chat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    default: null
  },

  // Financial details
  productPrice: {
    type: Number,
    required: true,
    min: 0
  },
  shippingCost: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  platformFeePercentage: {
    type: Number,
    default: 10, // 10% platform fee
    min: 0,
    max: 100
  },
  platformFeeAmount: {
    type: Number,
    required: true,
    min: 0
  },
  gatewayFeeAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  gatewayFeePaidBy: {
    type: String,
    enum: ['buyer', 'seller'],
    default: 'buyer'
  },
  sellerPayout: {
    type: Number,
    required: true,
    min: 0
  },

  // Currency
  currency: {
    type: String,
    default: 'USD',
    enum: ['USD', 'AED', 'EUR', 'GBP', 'SAR']
  },

  // Original currency (if converted)
  originalCurrency: {
    type: String,
    default: null
  },
  originalAmount: {
    type: Number,
    default: null
  },

  // Payment summary for display purposes
  paymentSummary: {
    productPrice: { type: Number, default: null },
    platformFee: { type: Number, default: null },
    shippingCost: { type: Number, default: null },
    salesTax: { type: Number, default: null },
    processingFee: { type: Number, default: null },
    totalAmount: { type: Number, default: null },
    currency: { type: String, default: null },
    exchangeRate: { type: Number, default: null }
  },
  exchangeRate: {
    type: Number,
    default: 1.0
  },
  exchangeRateDate: {
    type: Date,
    default: Date.now
  },

  // Shipping address
  shippingAddress: {
    fullName: {
      type: String,
      required: true
    },
    street1: {
      type: String,
      required: true
    },
    street2: {
      type: String,
      default: ''
    },
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    zipCode: {
      type: String,
      required: true
    },
    country: {
      type: String,
      required: true,
      default: 'AE'
    }
  },

  // Payment gateway details
  paymentGateway: {
    type: String,
    required: true,
    enum: ['paytabs', 'payfort', 'checkout', 'stripe', 'paypal']
  },
  gatewayTransactionId: {
    type: String,
    default: null
  },
  gatewayResponse: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Transaction status
  status: {
    type: String,
    enum: [
      'pending_payment',    // Waiting for buyer payment
      'payment_processing', // Payment being processed
      'payment_failed',     // Payment failed
      'funds_held',         // Payment successful, funds held in escrow
      'shipped',            // Seller marked as shipped
      'delivered',          // Buyer confirmed delivery
      'completed',          // Transaction completed, seller paid
      'disputed',           // Dispute raised
      'refunded',           // Refunded to buyer
      'cancelled'           // Transaction cancelled
    ],
    default: 'pending_payment'
  },

  // Delivery tracking
  deliveryDetails: {
    trackingNumber: {
      type: String,
      default: null
    },
    carrier: {
      type: String,
      default: null
    },
    shippedAt: {
      type: Date,
      default: null
    },
    estimatedDelivery: {
      type: Date,
      default: null
    },
    deliveredAt: {
      type: Date,
      default: null
    },
    deliveryConfirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    deliveryConfirmedAt: {
      type: Date,
      default: null
    }
  },

  // Payout details
  payoutDetails: {
    payoutMethod: {
      type: String,
      enum: ['bank_transfer', 'paypal', 'stripe', 'wallet'],
      default: null
    },
    payoutReference: {
      type: String,
      default: null
    },
    payoutProcessedAt: {
      type: Date,
      default: null
    },
    payoutAmount: {
      type: Number,
      default: null
    }
  },

  // Dispute handling
  disputeDetails: {
    disputeReason: {
      type: String,
      default: null
    },
    disputeRaisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    disputeRaisedAt: {
      type: Date,
      default: null
    },
    disputeResolution: {
      type: String,
      default: null
    },
    disputeResolvedAt: {
      type: Date,
      default: null
    }
  },

  // Auto-release settings
  autoReleaseEnabled: {
    type: Boolean,
    default: true
  },
  autoReleaseDays: {
    type: Number,
    default: 7 // Auto-release funds after 7 days if no delivery confirmation
  },
  autoReleaseAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + (this.autoReleaseDays || 7) * 24 * 60 * 60 * 1000);
    }
  },

  // Metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Timestamps for status changes
  statusHistory: [{
    status: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    note: String
  }]
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
escrowTransactionSchema.index({ buyer: 1, status: 1 });
escrowTransactionSchema.index({ seller: 1, status: 1 });
escrowTransactionSchema.index({ product: 1 });
escrowTransactionSchema.index({ transactionId: 1 });
escrowTransactionSchema.index({ gatewayTransactionId: 1 });
escrowTransactionSchema.index({ status: 1, autoReleaseAt: 1 });

// Virtual for calculating days until auto-release
escrowTransactionSchema.virtual('daysUntilAutoRelease').get(function() {
  if (!this.autoReleaseAt) return null;
  const now = new Date();
  const diffTime = this.autoReleaseAt - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
});

// Pre-save middleware to calculate amounts
escrowTransactionSchema.pre('save', function(next) {
  // Calculate platform fee only if not already set
  if (!this.platformFeeAmount && this.platformFeePercentage && this.productPrice) {
    this.platformFeeAmount = (this.productPrice * this.platformFeePercentage) / 100;
  }

  // Calculate seller payout only if not already set
  if (!this.sellerPayout && this.productPrice && this.platformFeeAmount !== undefined) {
    this.sellerPayout = this.productPrice - this.platformFeeAmount;
    if (this.gatewayFeePaidBy === 'seller' && this.gatewayFeeAmount) {
      this.sellerPayout -= this.gatewayFeeAmount;
    }

    // Ensure seller payout is not negative
    this.sellerPayout = Math.max(0, this.sellerPayout);
  }
  
  // Update status history
  if (this.isModified('status')) {
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date(),
      note: `Status changed to ${this.status}`
    });
  }
  
  next();
});

// Instance methods
escrowTransactionSchema.methods.updateStatus = function(newStatus, note = '') {
  this.status = newStatus;
  this.statusHistory.push({
    status: newStatus,
    timestamp: new Date(),
    note: note || `Status changed to ${newStatus}`
  });
  return this.save();
};

escrowTransactionSchema.methods.confirmDelivery = function(userId) {
  this.deliveryDetails.deliveryConfirmedBy = userId;
  this.deliveryDetails.deliveryConfirmedAt = new Date();
  this.deliveryDetails.deliveredAt = new Date();
  return this.updateStatus('delivered', 'Delivery confirmed by buyer');
};

escrowTransactionSchema.methods.markAsShipped = function(trackingNumber, carrier) {
  this.deliveryDetails.trackingNumber = trackingNumber;
  this.deliveryDetails.carrier = carrier;
  this.deliveryDetails.shippedAt = new Date();
  return this.updateStatus('shipped', 'Item marked as shipped by seller');
};

escrowTransactionSchema.methods.processRefund = function(reason) {
  this.disputeDetails.disputeReason = reason;
  this.disputeDetails.disputeResolvedAt = new Date();
  return this.updateStatus('refunded', `Refund processed: ${reason}`);
};

// Static methods
escrowTransactionSchema.statics.findPendingAutoRelease = function() {
  return this.find({
    status: 'funds_held',
    autoReleaseEnabled: true,
    autoReleaseAt: { $lte: new Date() }
  });
};

escrowTransactionSchema.statics.getTransactionStats = function(userId, userType = 'buyer') {
  const matchField = userType === 'buyer' ? 'buyer' : 'seller';
  return this.aggregate([
    { $match: { [matchField]: userId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$totalAmount' }
      }
    }
  ]);
};

module.exports = mongoose.model('EscrowTransaction', escrowTransactionSchema);
