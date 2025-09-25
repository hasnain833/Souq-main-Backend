const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  // Transaction identification
  transactionId: {
    type: String,
    unique: true,
    index: true
  },
  
  // Gateway transaction ID (from Stripe, PayTabs, etc.)
  gatewayTransactionId: {
    type: String,
    required: true,
    index: true
  },
  
  // Related entities
  escrowTransaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EscrowTransaction',
    required: true,
    index: true
  },
  
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
  
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  
  // Payment details
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  
  currency: {
    type: String,
    required: true,
    enum: ['USD', 'AED', 'EUR', 'GBP', 'SAR'],
    default: 'USD'
  },
  
  // Payment gateway information
  paymentGateway: {
    type: String,
    required: true,
    enum: ['stripe', 'paytabs', 'paypal', 'payfort', 'checkout']
  },
  
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'debit_card', 'bank_transfer', 'wallet', 'apple_pay', 'google_pay'],
    default: 'credit_card'
  },
  
  // Transaction status
  status: {
    type: String,
    enum: [
      'pending',           // Payment initialized but not completed
      'processing',        // Payment being processed by gateway
      'completed',         // Payment successfully completed
      'failed',           // Payment failed
      'cancelled',        // Payment cancelled by user
      'refunded',         // Payment refunded
      'partially_refunded' // Partial refund processed
    ],
    default: 'pending',
    index: true
  },
  
  // Fee breakdown
  fees: {
    platformFee: {
      type: Number,
      default: 0
    },
    gatewayFee: {
      type: Number,
      default: 0
    },
    totalFees: {
      type: Number,
      default: 0
    }
  },
  
  // Gateway response data
  gatewayResponse: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Payment metadata
  metadata: {
    clientSecret: String,        // For Stripe
    paymentIntentId: String,     // For Stripe
    publishableKey: String,      // For frontend
    returnUrl: String,
    cancelUrl: String,
    mockMode: {
      type: Boolean,
      default: false
    }
  },
  
  // Timestamps for different stages
  timestamps: {
    initiated: {
      type: Date,
      default: Date.now
    },
    processing: Date,
    completed: Date,
    failed: Date,
    cancelled: Date,
    refunded: Date
  },
  
  // Error information
  errorDetails: {
    code: String,
    message: String,
    details: mongoose.Schema.Types.Mixed
  },
  
  // Refund information
  refunds: [{
    refundId: String,
    amount: Number,
    reason: String,
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed']
    },
    processedAt: Date,
    gatewayRefundId: String
  }],
  
  // Audit trail
  notes: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    action: String,
    details: String,
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],

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
  collection: 'transactions'
});

// Indexes for performance
transactionSchema.index({ buyer: 1, createdAt: -1 });
transactionSchema.index({ seller: 1, createdAt: -1 });
transactionSchema.index({ paymentGateway: 1, status: 1 });
transactionSchema.index({ 'timestamps.initiated': -1 });

// Generate unique transaction ID before validation
transactionSchema.pre('validate', function(next) {
  if (!this.transactionId) {
    this.transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  }
  next();
});

// Also ensure it's set before save as a backup
transactionSchema.pre('save', function(next) {
  if (!this.transactionId) {
    this.transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  }
  next();
});

// Update timestamp based on status change
transactionSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    const now = new Date();
    switch (this.status) {
      case 'processing':
        this.timestamps.processing = now;
        break;
      case 'completed':
        this.timestamps.completed = now;
        break;
      case 'failed':
        this.timestamps.failed = now;
        break;
      case 'cancelled':
        this.timestamps.cancelled = now;
        break;
      case 'refunded':
        this.timestamps.refunded = now;
        break;
    }
  }
  next();
});

// Instance methods
transactionSchema.methods.addNote = function(action, details, performedBy) {
  this.notes.push({
    action,
    details,
    performedBy
  });
  return this.save();
};

transactionSchema.methods.updateStatus = function(newStatus, errorDetails = null) {
  this.status = newStatus;
  if (errorDetails) {
    this.errorDetails = errorDetails;
  }
  return this.save();
};

// Static methods
transactionSchema.statics.findByEscrowTransaction = function(escrowTransactionId) {
  return this.findOne({ escrowTransaction: escrowTransactionId });
};

transactionSchema.statics.findByGatewayTransactionId = function(gatewayTransactionId) {
  return this.findOne({ gatewayTransactionId });
};

module.exports = mongoose.model('Transaction', transactionSchema);
