const mongoose = require('mongoose');

const withdrawalTransactionSchema = new mongoose.Schema({
  // User who initiated the withdrawal
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Provider transaction ID (PayPal payout item ID, etc.)
  providerItemId: {
    type: String,
    required: true,
    index: true
  },
  
  // Withdrawal amount
  amount: {
    type: Number,
    required: true
  },
  
  // Net amount after fees
  netAmount: {
    type: Number,
    required: true
  },
  
  // Currency
  currency: {
    type: String,
    required: true,
    default: 'USD'
  },
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'blocked', 'returned', 'refunded'],
    default: 'pending',
    index: true
  },
  
  // Error information
  error: {
    code: String,
    message: String,
    details: mongoose.Schema.Types.Mixed
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Method to set error
withdrawalTransactionSchema.methods.setError = function(code, message, details = null) {
  this.error = {
    code,
    message,
    details
  };
  this.status = 'failed';
  this.updatedAt = new Date();
  return this.save();
};

// Method to update status
withdrawalTransactionSchema.methods.updateStatus = function(status, details = null) {
  this.status = status;
  if (details) {
    this.error = {
      code: status,
      message: details,
      details: null
    };
  }
  this.updatedAt = new Date();
  return this.save();
};

module.exports = mongoose.model('WithdrawalTransaction', withdrawalTransactionSchema);
