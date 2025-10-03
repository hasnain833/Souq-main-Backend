const mongoose = require('mongoose');

const paymentGatewaySchema = new mongoose.Schema({
  // Gateway identification
  gatewayName: {
    type: String,
    required: true,
    enum: ['paytabs', 'payfort', 'checkout', 'stripe', 'paypal'],
    unique: true
  },
  
  displayName: {
    type: String,
    required: true
  },
  
  // Gateway status
  isActive: {
    type: Boolean,
    default: true
  },
  
  isTestMode: {
    type: Boolean,
    default: false
  },
  
  // Supported features
  supportedCurrencies: [{
    type: String,
    enum: ['USD', 'AED', 'EUR', 'GBP', 'SAR']
  }],
  
  supportedPaymentMethods: [{
    type: String,
    enum: ['credit_card', 'debit_card', 'bank_transfer', 'wallet', 'apple_pay', 'google_pay']
  }],
  
  // Fee structure
  feeStructure: {
    fixedFee: {
      type: Number,
      default: 0,
      min: 0
    },
    percentageFee: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    minimumFee: {
      type: Number,
      default: 0,
      min: 0
    },
    maximumFee: {
      type: Number,
      default: null
    }
  },
  
  // Configuration settings
  configuration: {
    // Common fields
    apiKey: {
      type: String,
      default: null
    },
    secretKey: {
      type: String,
      default: null
    },
    merchantId: {
      type: String,
      default: null
    },
    
    // Gateway-specific settings
    paytabs: {
      profileId: String,
      serverKey: String,
      region: {
        type: String,
        enum: ['ARE', 'SAU', 'EGY', 'JOR', 'IRQ'],
        default: 'ARE'
      }
    },
    
    payfort: {
      accessCode: String,
      merchantIdentifier: String,
      shaRequestPhrase: String,
      shaResponsePhrase: String,
      environment: {
        type: String,
        enum: ['sandbox', 'production'],
        default: 'sandbox'
      }
    },
    
    checkout: {
      publicKey: String,
      secretKey: String,
      environment: {
        type: String,
        enum: ['sandbox', 'production'],
        default: 'sandbox'
      }
    },
    
    stripe: {
      publishableKey: String,
      secretKey: String,
      webhookSecret: String
    },
    
    paypal: {
      clientId: String,
      clientSecret: String,
      environment: {
        type: String,
        enum: ['sandbox', 'production'],
        default: 'sandbox'
      }
    }
  },
  
  // API endpoints
  endpoints: {
    baseUrl: String,
    paymentUrl: String,
    refundUrl: String,
    webhookUrl: String,
    statusUrl: String
  },
  
  // Processing limits
  limits: {
    minAmount: {
      type: Number,
      default: 1
    },
    maxAmount: {
      type: Number,
      default: 100000
    },
    dailyLimit: {
      type: Number,
      default: null
    },
    monthlyLimit: {
      type: Number,
      default: null
    }
  },
  
  // Settlement details
  settlementDetails: {
    settlementCurrency: {
      type: String,
      default: 'AED'
    },
    settlementPeriod: {
      type: String,
      enum: ['instant', 'daily', 'weekly', 'monthly'],
      default: 'daily'
    },
    holdingPeriod: {
      type: Number,
      default: 0 // Days to hold funds before settlement
    }
  },
  
  // Statistics
  statistics: {
    totalTransactions: {
      type: Number,
      default: 0
    },
    successfulTransactions: {
      type: Number,
      default: 0
    },
    failedTransactions: {
      type: Number,
      default: 0
    },
    totalVolume: {
      type: Number,
      default: 0
    },
    lastTransactionAt: {
      type: Date,
      default: null
    }
  },
  
  // Metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
// paymentGatewaySchema.index({ gatewayName: 1 }); // Duplicate of field-level unique: true; commented out to avoid duplicate index
paymentGatewaySchema.index({ isActive: 1 });
paymentGatewaySchema.index({ 'supportedCurrencies': 1 });

// Virtual for success rate
paymentGatewaySchema.virtual('successRate').get(function() {
  if (this.statistics.totalTransactions === 0) return 0;
  return (this.statistics.successfulTransactions / this.statistics.totalTransactions) * 100;
});

// Instance methods
paymentGatewaySchema.methods.calculateFee = function(amount, currency = 'AED') {
  const { fixedFee, percentageFee, minimumFee, maximumFee } = this.feeStructure;
  
  let fee = fixedFee + (amount * percentageFee / 100);
  
  if (minimumFee && fee < minimumFee) {
    fee = minimumFee;
  }
  
  if (maximumFee && fee > maximumFee) {
    fee = maximumFee;
  }
  
  return Math.round(fee * 100) / 100; // Round to 2 decimal places
};

paymentGatewaySchema.methods.updateStatistics = function(success, amount) {
  this.statistics.totalTransactions += 1;
  if (success) {
    this.statistics.successfulTransactions += 1;
    this.statistics.totalVolume += amount;
  } else {
    this.statistics.failedTransactions += 1;
  }
  this.statistics.lastTransactionAt = new Date();
  return this.save();
};

paymentGatewaySchema.methods.isSupported = function(currency, paymentMethod) {
  const currencySupported = this.supportedCurrencies.includes(currency);
  const methodSupported = this.supportedPaymentMethods.includes(paymentMethod);
  return currencySupported && methodSupported && this.isActive;
};

// Static methods
paymentGatewaySchema.statics.getActiveGateways = function(currency = null) {
  const query = { isActive: true };
  if (currency) {
    query.supportedCurrencies = currency;
  }
  return this.find(query).sort({ displayName: 1 });
};

paymentGatewaySchema.statics.getBestGateway = function(amount, currency = 'AED') {
  return this.find({
    isActive: true,
    supportedCurrencies: currency,
    'limits.minAmount': { $lte: amount },
    'limits.maxAmount': { $gte: amount }
  }).then(gateways => {
    if (gateways.length === 0) return null;
    
    // Find gateway with lowest fee
    let bestGateway = gateways[0];
    let lowestFee = bestGateway.calculateFee(amount, currency);
    
    for (let gateway of gateways) {
      const fee = gateway.calculateFee(amount, currency);
      if (fee < lowestFee) {
        lowestFee = fee;
        bestGateway = gateway;
      }
    }
    
    return bestGateway;
  });
};

module.exports = mongoose.model('PaymentGateway', paymentGatewaySchema);
