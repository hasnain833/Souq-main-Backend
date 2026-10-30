const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema({
  // Transaction details
  transactionId: {
    type: String,
    required: true
    // Removed index: true to prevent duplicate key errors on null values
  },
  
  type: {
    type: String,
    enum: [
      'credit',      // Money added to wallet
      'debit',       // Money deducted from wallet
      'refund',      // Refund to wallet
      'withdrawal',  // Money withdrawn from wallet
      'fee',         // Platform fee deduction
      'bonus',       // Bonus/reward credit
      'transfer'     // Transfer between wallets
    ],
    required: true
  },
  
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  
  currency: {
    type: String,
    required: true,
    default: 'AED', // Changed default to AED
    enum: ['USD', 'AED', 'EUR', 'GBP']
  },
  
  // Balance after this transaction
  balanceAfter: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Description/reason for transaction
  description: {
    type: String,
    required: true,
    trim: true
  },
  
  // Reference to related entities
  relatedTransaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  
  relatedEscrowTransaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EscrowTransaction'
  },
  
  relatedProduct: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  },
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'completed'
  },
  
  // Metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

const walletSchema = new mongoose.Schema({
  // User reference
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  
  // Balance in different currencies
  balances: {
    USD: {
      type: Number,
      default: 0,
      min: 0
    },
    AED: {
      type: Number,
      default: 0,
      min: 0
    },
    EUR: {
      type: Number,
      default: 0,
      min: 0
    },
    GBP: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  
  // Primary currency for the wallet
  primaryCurrency: {
    type: String,
    default: 'AED', // Changed default to AED
    enum: ['USD', 'AED', 'EUR', 'GBP']
  },
  
  // Wallet status
  isActive: {
    type: Boolean,
    default: true
  },
  
  isBlocked: {
    type: Boolean,
    default: false
  },
  
  // Security settings
  withdrawalLimit: {
    daily: {
      type: Number,
      default: 1000 // USD equivalent
    },
    monthly: {
      type: Number,
      default: 10000 // USD equivalent
    }
  },
  
  // Withdrawal tracking
  withdrawalTracking: {
    dailyWithdrawn: {
      type: Number,
      default: 0
    },
    monthlyWithdrawn: {
      type: Number,
      default: 0
    },
    lastWithdrawalReset: {
      type: Date,
      default: Date.now
    }
  },
  
  // Transaction history (embedded for quick access)
  transactions: [walletTransactionSchema],
  
  // Statistics
  statistics: {
    totalEarned: {
      type: Number,
      default: 0
    },
    totalWithdrawn: {
      type: Number,
      default: 0
    },
    totalTransactions: {
      type: Number,
      default: 0
    },
    lastTransactionAt: {
      type: Date,
      default: null
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
// Note: Unique index on `user` exists via field definition (unique: true), avoid duplicate simple index.
// Remove the problematic index on transactions.transactionId to avoid null value conflicts
// walletSchema.index({ 'transactions.transactionId': 1 }, { sparse: true });
walletSchema.index({ 'transactions.createdAt': -1 });
walletSchema.index({ 'transactions.type': 1 });
// Add compound index for user and transaction queries
walletSchema.index({ user: 1, 'transactions.createdAt': -1 });

// Virtual for total balance in primary currency
walletSchema.virtual('totalBalance').get(function() {
  return this.balances[this.primaryCurrency] || 0;
});

// Generate unique transaction ID
walletTransactionSchema.pre('validate', function(next) {
  if (!this.transactionId) {
    // Generate a more unique transaction ID with user context and timestamp
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const userPart = this.parent()?.user?.toString().slice(-6) || 'NOUSER';
    this.transactionId = `WTX_${timestamp}_${userPart}_${random}`;
  }
  next();
});

// Instance methods
walletSchema.methods.addTransaction = function(transactionData) {
  const { type, amount, currency, description, relatedTransaction, relatedEscrowTransaction, relatedProduct, metadata } = transactionData;
  
  // Calculate new balance
  const currentBalance = this.balances[currency] || 0;
  let newBalance;
  
  if (type === 'credit' || type === 'refund' || type === 'bonus') {
    newBalance = currentBalance + amount;
  } else if (type === 'debit' || type === 'withdrawal' || type === 'fee') {
    newBalance = Math.max(0, currentBalance - amount);
  } else {
    newBalance = currentBalance;
  }
  
  // Generate unique transaction ID if not provided
  const transactionId = transactionData.transactionId ||
    `WTX_${Date.now()}_${this.user.toString().slice(-6)}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  // Create transaction record
  const transaction = {
    type,
    amount,
    currency,
    balanceAfter: newBalance,
    description,
    transactionId,
    relatedTransaction,
    relatedEscrowTransaction,
    relatedProduct,
    metadata: metadata || {}
  };
  
  // Update balance
  this.balances[currency] = newBalance;
  
  // Add transaction to history
  this.transactions.unshift(transaction);
  
  // Keep only last 100 transactions in embedded array
  if (this.transactions.length > 100) {
    this.transactions = this.transactions.slice(0, 100);
  }
  
  // Update statistics
  this.statistics.totalTransactions += 1;
  this.statistics.lastTransactionAt = new Date();
  
  if (type === 'credit' || type === 'refund' || type === 'bonus') {
    this.statistics.totalEarned += amount;
  } else if (type === 'withdrawal') {
    this.statistics.totalWithdrawn += amount;
  }
  
  return this.save();
};

walletSchema.methods.canWithdraw = function(amount, currency = 'USD') {
  const balance = this.balances[currency] || 0;
  if (balance < amount) return { canWithdraw: false, reason: 'Insufficient balance' };
  
  // Check daily limit
  const today = new Date();
  const lastReset = new Date(this.withdrawalTracking.lastWithdrawalReset);
  
  if (today.toDateString() !== lastReset.toDateString()) {
    this.withdrawalTracking.dailyWithdrawn = 0;
    this.withdrawalTracking.lastWithdrawalReset = today;
  }
  
  // if (this.withdrawalTracking.dailyWithdrawn + amount > this.withdrawalLimit.daily) {
  //   return { canWithdraw: false, reason: 'Daily withdrawal limit exceeded' };
  // }
  
  return { canWithdraw: true };
};

// Static methods
walletSchema.statics.findOrCreateWallet = async function(userId) {
  let wallet = await this.findOne({ user: userId });
  
  if (!wallet) {
    wallet = new this({ user: userId });
    await wallet.save();
  }
  
  return wallet;
};

walletSchema.statics.creditWallet = async function(userId, amount, currency, description, relatedData = {}) {
  const wallet = await this.findOrCreateWallet(userId);
  
  return wallet.addTransaction({
    type: 'credit',
    amount,
    currency,
    description,
    ...relatedData
  });
};

walletSchema.statics.debitWallet = async function(userId, amount, currency, description, relatedData = {}) {
  const wallet = await this.findOrCreateWallet(userId);
  
  const canWithdraw = wallet.canWithdraw(amount, currency);
  if (!canWithdraw.canWithdraw) {
    throw new Error(canWithdraw.reason);
  }
  
  return wallet.addTransaction({
    type: 'debit',
    amount,
    currency,
    description,
    ...relatedData
  });
};

module.exports = mongoose.model('Wallet', walletSchema);
