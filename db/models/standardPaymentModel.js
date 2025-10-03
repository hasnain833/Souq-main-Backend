const mongoose = require('mongoose');

const standardPaymentSchema = new mongoose.Schema({
  // Transaction identification
  transactionId: {
    type: String,
    required: true,
    unique: true,
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
    required: true,
    index: true
  },

  // Offer reference (if payment is for an accepted offer)
  offer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Offer',
    default: null
  },

  // Payment amounts
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

  salesTax: {
    type: Number,
    default: 0,
    min: 0
  },

  platformFeeAmount: {
    type: Number,
    default: 0,
    min: 0
  },

  gatewayFeeAmount: {
    type: Number,
    default: 0,
    min: 0
  },

  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },

  currency: {
    type: String,
    required: true,
    default: 'USD',
    enum: ['USD', 'AED', 'SAR', 'EUR', 'GBP']
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

  // Payment gateway details
  paymentGateway: {
    type: String,
    required: true,
    enum: ['stripe', 'paytabs', 'paypal', 'payfort', 'checkout']
  },

  gatewayTransactionId: {
    type: String,
    index: true
  },

  gatewayResponse: {
    type: mongoose.Schema.Types.Mixed
  },

  // Payment status
  status: {
    type: String,
    required: true,
    enum: [
      'pending',           // Payment created but not processed
      'processing',        // Payment being processed by gateway
      'completed',         // Payment successful
      'failed',           // Payment failed
      'cancelled',        // Payment cancelled
      'refunded'          // Payment refunded
    ],
    default: 'pending',
    index: true
  },

  // Payment method details
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'debit_card', 'paypal', 'bank_transfer'],
    default: 'credit_card'
  },

  // Card details (if applicable)
  cardDetails: {
    cardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Card'
    },
    lastFourDigits: String,
    cardBrand: String
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
    street2: String,
    city: {
      type: String,
      required: true
    },
    state: String,
    zip: {
      type: String,
      required: true
    },
    country: {
      type: String,
      required: true
    }
  },

  // Fee allocation
  gatewayFeePaidBy: {
    type: String,
    enum: ['buyer', 'seller'],
    default: 'buyer'
  },

  // Timestamps
  paymentDate: {
    type: Date
  },

  refundDate: {
    type: Date
  },

  // Metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Order status tracking (for shipping/delivery)
  orderStatus: {
    type: String,
    enum: [
      'pending_payment',
      'paid',
      'processing',
      'shipped',
      'in_transit',
      'out_for_delivery',
      'delivered',
      'cancelled',
      'returned',
      'refunded'
    ],
    default: 'pending_payment'
  },

  // Status history for order tracking
  statusHistory: [{
    status: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    description: String,
    updatedBy: {
      type: String,
      enum: ['system', 'buyer', 'seller', 'shipping_provider']
    }
  }],

  // Delivery tracking
  deliveryConfirmedAt: Date,
  deliveryConfirmedBy: {
    type: String,
    enum: ['buyer', 'system', 'shipping_provider']
  },
  deliveryRating: {
    type: Number,
    min: 1,
    max: 5
  },
  deliveryFeedback: String,
  ratedAt: Date

}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      // Remove sensitive data from JSON output
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for performance
standardPaymentSchema.index({ buyer: 1, status: 1 });
standardPaymentSchema.index({ seller: 1, status: 1 });
// standardPaymentSchema.index({ product: 1 }); // Duplicate of field-level index: true
standardPaymentSchema.index({ createdAt: -1 });
// standardPaymentSchema.index({ gatewayTransactionId: 1 }); // Duplicate of field-level index: true

// Virtual for seller payout amount
standardPaymentSchema.virtual('sellerPayout').get(function() {
  let payout = this.productPrice - this.platformFeeAmount;
  if (this.gatewayFeePaidBy === 'seller') {
    payout -= this.gatewayFeeAmount;
  }
  return Math.max(0, payout);
});

// Pre-save middleware to generate transaction ID (fallback)
standardPaymentSchema.pre('save', function(next) {
  if (this.isNew && !this.transactionId) {
    console.warn('⚠️ TransactionId missing, generating fallback ID');
    this.transactionId = `PAY_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  }
  next();
});

// Static method to generate unique transaction ID
standardPaymentSchema.statics.generateTransactionId = function() {
  return `PAY_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
};

module.exports = mongoose.model('StandardPayment', standardPaymentSchema);
