const mongoose = require('mongoose');

const bankAccountSchema = new mongoose.Schema({
  // User reference
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Account holder information
  accountHolderName: {
    type: String,
    required: true,
    trim: true
  },

  // Bank information
  bankName: {
    type: String,
    required: true,
    trim: true
  },

  // Account details
  accountType: {
    type: String,
    required: true,
    enum: ['checking', 'savings'],
    lowercase: true
  },

  // Masked account number (only last 4 digits stored)
  lastFourDigits: {
    type: String,
    required: true,
    length: 4
  },

  // Routing number
  routingNumber: {
    type: String,
    required: true,
    length: 9
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

  // Status flags
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

  gatewayAccountId: String,

  // Verification tracking
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
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for performance
bankAccountSchema.index({ user: 1, isActive: 1 });
bankAccountSchema.index({ user: 1, isDefault: 1 });
bankAccountSchema.index({ user: 1, lastFourDigits: 1, routingNumber: 1 });

// Virtual for masked account number
bankAccountSchema.virtual('maskedAccountNumber').get(function() {
  return `****${this.lastFourDigits}`;
});

// Pre-save middleware to ensure only one default account per user
bankAccountSchema.pre('save', async function(next) {
  if (this.isDefault && this.isModified('isDefault')) {
    // Remove default flag from other accounts of the same user
    await this.constructor.updateMany(
      { 
        user: this.user, 
        _id: { $ne: this._id }
      },
      { isDefault: false }
    );
  }
  next();
});

// Static method to get user's default bank account
bankAccountSchema.statics.getDefaultAccount = function(userId) {
  return this.findOne({ 
    user: userId, 
    isDefault: true, 
    isActive: true 
  });
};

// Static method to get user's bank accounts
bankAccountSchema.statics.getUserAccounts = function(userId) {
  return this.find({ 
    user: userId, 
    isActive: true 
  }).sort({ isDefault: -1, createdAt: -1 });
};

// Static method to set default account
bankAccountSchema.statics.setDefaultAccount = async function(userId, accountId) {
  // Remove default from all accounts
  await this.updateMany(
    { user: userId },
    { isDefault: false }
  );
  
  // Set the specified account as default
  return this.findByIdAndUpdate(
    accountId,
    { isDefault: true },
    { new: true }
  );
};

// Static method to find user accounts
bankAccountSchema.statics.findUserAccounts = function(userId, activeOnly = true) {
  const query = { user: userId };
  if (activeOnly) {
    query.isActive = true;
  }
  return this.find(query).sort({ isDefault: -1, createdAt: -1 });
};

// Instance method to set as default
bankAccountSchema.methods.setAsDefault = async function() {
  // Remove default flag from other accounts
  await this.constructor.updateMany(
    { 
      user: this.user, 
      _id: { $ne: this._id }
    },
    { isDefault: false }
  );
  
  // Set this as default
  this.isDefault = true;
  return this.save();
};

// Instance method to soft delete
bankAccountSchema.methods.softDelete = function() {
  this.isActive = false;
  return this.save();
};

module.exports = mongoose.model('BankAccount', bankAccountSchema);
