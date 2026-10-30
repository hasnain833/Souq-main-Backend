const mongoose = require('mongoose');

const platformFeeSchema = new mongoose.Schema({
  // Fee configuration
  feeType: {
    type: String,
    enum: ['percentage', 'fixed', 'tiered'],
    default: 'percentage'
  },
  
  // Basic fee settings
  defaultPercentage: {
    type: Number,
    default: 10, // 10% default platform fee
    min: 0,
    max: 100
  },
  
  defaultFixedAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Currency-specific fees
  currencyFees: [{
    currency: {
      type: String,
      enum: ['USD', 'AED', 'EUR', 'GBP', 'SAR'],
      required: true
    },
    percentage: {
      type: Number,
      min: 0,
      max: 100
    },
    fixedAmount: {
      type: Number,
      min: 0,
      default: 0
    },
    minimumFee: {
      type: Number,
      min: 0,
      default: 0
    },
    maximumFee: {
      type: Number,
      min: 0,
      default: null
    }
  }],
  
  // Category-specific fees
  categoryFees: [{
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true
    },
    percentage: {
      type: Number,
      min: 0,
      max: 100
    },
    fixedAmount: {
      type: Number,
      min: 0,
      default: 0
    },
    description: String
  }],
  
  // Tiered fee structure (based on transaction amount)
  tieredFees: [{
    minAmount: {
      type: Number,
      required: true,
      min: 0
    },
    maxAmount: {
      type: Number,
      required: true,
      min: 0
    },
    percentage: {
      type: Number,
      min: 0,
      max: 100
    },
    fixedAmount: {
      type: Number,
      min: 0,
      default: 0
    }
  }],
  
  // User-specific fee overrides (for premium sellers, etc.)
  userFeeOverrides: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    percentage: {
      type: Number,
      min: 0,
      max: 100
    },
    fixedAmount: {
      type: Number,
      min: 0,
      default: 0
    },
    validFrom: {
      type: Date,
      default: Date.now
    },
    validUntil: {
      type: Date,
      default: null
    },
    reason: String
  }],
  
  // Promotional fee settings
  promotionalFees: [{
    name: {
      type: String,
      required: true
    },
    description: String,
    percentage: {
      type: Number,
      min: 0,
      max: 100
    },
    fixedAmount: {
      type: Number,
      min: 0,
      default: 0
    },
    validFrom: {
      type: Date,
      required: true
    },
    validUntil: {
      type: Date,
      required: true
    },
    applicableCategories: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category'
    }],
    applicableUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    minTransactionAmount: {
      type: Number,
      default: 0
    },
    maxTransactionAmount: {
      type: Number,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  
  // Fee collection settings
  collectionSettings: {
    collectFrom: {
      type: String,
      enum: ['seller', 'buyer', 'split'],
      default: 'seller'
    },
    sellerPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 100 // If split, what percentage seller pays
    }
  },
  
  // Minimum and maximum fee limits
  globalLimits: {
    minimumFee: {
      type: Number,
      default: 0,
      min: 0
    },
    maximumFee: {
      type: Number,
      default: null
    },
    minimumTransactionAmount: {
      type: Number,
      default: 1,
      min: 0
    }
  },
  
  // Fee statistics
  statistics: {
    totalFeesCollected: {
      type: Number,
      default: 0
    },
    totalTransactions: {
      type: Number,
      default: 0
    },
    averageFeePercentage: {
      type: Number,
      default: 0
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  
  // Configuration metadata
  isActive: {
    type: Boolean,
    default: true
  },
  
  version: {
    type: String,
    default: '1.0'
  },
  
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  
  notes: {
    type: String,
    default: ''
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
platformFeeSchema.index({ isActive: 1 });
platformFeeSchema.index({ 'currencyFees.currency': 1 });
platformFeeSchema.index({ 'categoryFees.category': 1 });
platformFeeSchema.index({ 'userFeeOverrides.user': 1 });

// Instance methods
platformFeeSchema.methods.calculateFee = function(amount, currency = 'USD', categoryId = null, userId = null) {
  let feePercentage = this.defaultPercentage;
  let fixedAmount = this.defaultFixedAmount;
  
  // Check for user-specific override first
  if (userId) {
    const userOverride = this.userFeeOverrides.find(override => 
      override.user.toString() === userId.toString() &&
      (!override.validUntil || override.validUntil > new Date()) &&
      override.validFrom <= new Date()
    );
    
    if (userOverride) {
      feePercentage = userOverride.percentage !== undefined ? userOverride.percentage : feePercentage;
      fixedAmount = userOverride.fixedAmount !== undefined ? userOverride.fixedAmount : fixedAmount;
    }
  }
  
  // Check for promotional fees
  const activePromo = this.promotionalFees.find(promo => 
    promo.isActive &&
    promo.validFrom <= new Date() &&
    promo.validUntil > new Date() &&
    (!promo.minTransactionAmount || amount >= promo.minTransactionAmount) &&
    (!promo.maxTransactionAmount || amount <= promo.maxTransactionAmount) &&
    (!categoryId || promo.applicableCategories.length === 0 || promo.applicableCategories.includes(categoryId)) &&
    (!userId || promo.applicableUsers.length === 0 || promo.applicableUsers.includes(userId))
  );
  
  if (activePromo) {
    feePercentage = activePromo.percentage !== undefined ? activePromo.percentage : feePercentage;
    fixedAmount = activePromo.fixedAmount !== undefined ? activePromo.fixedAmount : fixedAmount;
  }
  
  // Check for category-specific fees
  if (categoryId) {
    const categoryFee = this.categoryFees.find(fee => fee.category.toString() === categoryId.toString());
    if (categoryFee) {
      feePercentage = categoryFee.percentage !== undefined ? categoryFee.percentage : feePercentage;
      fixedAmount = categoryFee.fixedAmount !== undefined ? categoryFee.fixedAmount : fixedAmount;
    }
  }
  
  // Check for currency-specific fees
  const currencyFee = this.currencyFees.find(fee => fee.currency === currency);
  if (currencyFee) {
    feePercentage = currencyFee.percentage !== undefined ? currencyFee.percentage : feePercentage;
    fixedAmount = currencyFee.fixedAmount !== undefined ? currencyFee.fixedAmount : fixedAmount;
  }
  
  // Check for tiered fees
  if (this.feeType === 'tiered' && this.tieredFees.length > 0) {
    const applicableTier = this.tieredFees.find(tier => 
      amount >= tier.minAmount && amount <= tier.maxAmount
    );
    
    if (applicableTier) {
      feePercentage = applicableTier.percentage !== undefined ? applicableTier.percentage : feePercentage;
      fixedAmount = applicableTier.fixedAmount !== undefined ? applicableTier.fixedAmount : fixedAmount;
    }
  }
  
  // Calculate final fee
  let calculatedFee = fixedAmount + (amount * feePercentage / 100);
  
  // Apply global limits
  if (this.globalLimits.minimumFee && calculatedFee < this.globalLimits.minimumFee) {
    calculatedFee = this.globalLimits.minimumFee;
  }
  
  if (this.globalLimits.maximumFee && calculatedFee > this.globalLimits.maximumFee) {
    calculatedFee = this.globalLimits.maximumFee;
  }
  
  // Apply currency-specific limits
  if (currencyFee) {
    if (currencyFee.minimumFee && calculatedFee < currencyFee.minimumFee) {
      calculatedFee = currencyFee.minimumFee;
    }
    if (currencyFee.maximumFee && calculatedFee > currencyFee.maximumFee) {
      calculatedFee = currencyFee.maximumFee;
    }
  }
  
  return {
    feeAmount: Math.round(calculatedFee * 100) / 100,
    feePercentage: feePercentage,
    fixedAmount: fixedAmount,
    appliedRule: this.getAppliedRule(userId, categoryId, currency, amount)
  };
};

platformFeeSchema.methods.getAppliedRule = function(userId, categoryId, currency, amount) {
  if (userId && this.userFeeOverrides.find(o => o.user.toString() === userId.toString())) {
    return 'user_override';
  }
  
  const activePromo = this.promotionalFees.find(promo => 
    promo.isActive && promo.validFrom <= new Date() && promo.validUntil > new Date()
  );
  if (activePromo) return 'promotional';
  
  if (categoryId && this.categoryFees.find(f => f.category.toString() === categoryId.toString())) {
    return 'category_specific';
  }
  
  if (this.currencyFees.find(f => f.currency === currency)) {
    return 'currency_specific';
  }
  
  if (this.feeType === 'tiered') return 'tiered';
  
  return 'default';
};

// Static methods
platformFeeSchema.statics.getActiveFeeStructure = function() {
  return this.findOne({ isActive: true }).sort({ createdAt: -1 });
};

module.exports = mongoose.model('PlatformFee', platformFeeSchema, 'platformfees');
