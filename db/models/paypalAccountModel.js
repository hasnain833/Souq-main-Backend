const mongoose = require('mongoose');

const paypalAccountSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      },
      message: 'Invalid email format'
    }
  },
  accountType: {
    type: String,
    enum: ['personal', 'business'],
    default: 'personal'
  },
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
  paypalAccountId: {
    type: String,
    sparse: true // PayPal account ID from PayPal API
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'failed', 'unverified'],
    default: 'unverified'
  },
  verificationDate: {
    type: Date
  },
  lastUsedAt: {
    type: Date
  },
  metadata: {
    country: String,
    currency: String,
    accountStatus: String,
    verificationMethod: String
  }
}, {
  timestamps: true
});

// Indexes
paypalAccountSchema.index({ user: 1, email: 1 }, { unique: true });
paypalAccountSchema.index({ user: 1, isActive: 1 });
paypalAccountSchema.index({ user: 1, isDefault: 1 });

// Static methods
paypalAccountSchema.statics.findUserAccounts = function(userId, activeOnly = true) {
  const query = { user: userId };
  if (activeOnly) {
    query.isActive = true;
  }
  return this.find(query).sort({ isDefault: -1, createdAt: -1 });
};

paypalAccountSchema.statics.getDefaultAccount = function(userId) {
  return this.findOne({ 
    user: userId, 
    isDefault: true, 
    isActive: true 
  });
};

// Instance methods
paypalAccountSchema.methods.setAsDefault = async function() {
  // Remove default from other accounts
  await this.constructor.updateMany(
    { user: this.user, _id: { $ne: this._id } },
    { isDefault: false }
  );
  
  // Set this account as default
  this.isDefault = true;
  return this.save();
};

paypalAccountSchema.methods.softDelete = function() {
  this.isActive = false;
  this.isDefault = false;
  return this.save();
};

paypalAccountSchema.methods.markAsUsed = function() {
  this.lastUsedAt = new Date();
  return this.save();
};

paypalAccountSchema.methods.updateVerificationStatus = function(status, method = null) {
  this.verificationStatus = status;
  this.isVerified = status === 'verified';
  
  if (status === 'verified') {
    this.verificationDate = new Date();
  }
  
  if (method) {
    this.metadata = this.metadata || {};
    this.metadata.verificationMethod = method;
  }
  
  return this.save();
};

// Pre-save middleware
paypalAccountSchema.pre('save', async function(next) {
  // If this is being set as default, ensure no other account is default
  if (this.isDefault && this.isModified('isDefault')) {
    await this.constructor.updateMany(
      { user: this.user, _id: { $ne: this._id } },
      { isDefault: false }
    );
  }
  
  // If this is the first account for the user, make it default
  if (this.isNew) {
    const existingAccounts = await this.constructor.countDocuments({ 
      user: this.user, 
      isActive: true 
    });
    
    if (existingAccounts === 0) {
      this.isDefault = true;
    }
  }
  
  next();
});

// Virtual for display name
paypalAccountSchema.virtual('displayName').get(function() {
  return this.email;
});

// Transform for JSON output
paypalAccountSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('PaypalAccount', paypalAccountSchema);