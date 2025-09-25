const mongoose = require('mongoose');
const crypto = require('crypto');

const cardSchema = new mongoose.Schema({
  // User association
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Card details (encrypted)
  cardNumber: {
    type: String,
    required: true,
    set: function(value) {
      // Store original value for pre-save middleware
      this._originalCardNumber = value;
      // Encrypt card number before storing
      return this.encryptCardNumber(value);
    }
  },

  // Last 4 digits for display (not encrypted)
  lastFourDigits: {
    type: String,
    required: true,
    length: 4
  },

  // Card brand (Visa, Mastercard, etc.)
  cardBrand: {
    type: String,
    required: true,
    enum: ['visa', 'mastercard', 'amex', 'discover', 'diners', 'jcb', 'unknown']
  },

  // Cardholder name
  cardholderName: {
    type: String,
    required: true,
    trim: true
  },

  // Expiry date (MM/YY format)
  expiryMonth: {
    type: String,
    required: true,
    match: /^(0[1-9]|1[0-2])$/
  },

  expiryYear: {
    type: String,
    required: true,
    match: /^\d{2}$/
  },

  // CVV (encrypted, optional for storage)
  cvv: {
    type: String,
    set: function(value) {
      if (value) {
        return this.encryptCVV(value);
      }
      return undefined;
    }
  },

  // Verification status
  isVerified: {
    type: Boolean,
    default: false
  },

  verificationDate: {
    type: Date
  },

  // Gateway verification details
  gatewayVerification: {
    gateway: {
      type: String,
      enum: ['stripe', 'paytabs', 'paypal', 'payfort', 'checkout']
    },
    verificationId: String,
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'failed']
    },
    verificationResponse: mongoose.Schema.Types.Mixed
  },

  // Card status
  isActive: {
    type: Boolean,
    default: true
  },

  isDefault: {
    type: Boolean,
    default: false
  },

  // Usage tracking
  lastUsed: {
    type: Date
  },

  usageCount: {
    type: Number,
    default: 0
  },

  // Security
  fingerprint: {
    type: String,
    unique: true,
    index: true
  },

  // Metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      // Never return sensitive data in JSON
      delete ret.cardNumber;
      delete ret.cvv;
      delete ret.fingerprint;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Encryption key from environment
const ENCRYPTION_KEY = process.env.CARD_ENCRYPTION_KEY || 'default-key-change-in-production-32';
const ALGORITHM = 'aes-256-gcm';

// Ensure key is 32 bytes for AES-256
const getEncryptionKey = () => {
  const key = ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32);
  return Buffer.from(key, 'utf8');
};

// Instance methods for encryption/decryption
cardSchema.methods.encryptCardNumber = function(cardNumber) {
  try {
    // Simple base64 encoding for development
    // In production, use proper AES encryption
    return Buffer.from(cardNumber).toString('base64');
  } catch (error) {
    console.error('Encryption error:', error);
    return cardNumber; // Fallback to plain text for development
  }
};

cardSchema.methods.decryptCardNumber = function() {
  if (!this.cardNumber) return null;

  try {
    // Simple base64 decoding for development
    return Buffer.from(this.cardNumber, 'base64').toString('utf8');
  } catch (error) {
    console.error('Decryption error:', error);
    return this.cardNumber; // Fallback to plain text for development
  }
};

cardSchema.methods.encryptCVV = function(cvv) {
  try {
    // Simple base64 encoding for development
    return Buffer.from(cvv).toString('base64');
  } catch (error) {
    console.error('CVV encryption error:', error);
    return cvv; // Fallback to plain text for development
  }
};

cardSchema.methods.decryptCVV = function() {
  if (!this.cvv) return null;

  try {
    // Simple base64 decoding for development
    return Buffer.from(this.cvv, 'base64').toString('utf8');
  } catch (error) {
    console.error('CVV decryption error:', error);
    return this.cvv; // Fallback to plain text for development
  }
};

// Generate card fingerprint for duplicate detection
cardSchema.methods.generateFingerprint = function(cardNumber) {
  return crypto.createHash('sha256').update(cardNumber + this.user.toString()).digest('hex');
};

// Detect card brand from card number
cardSchema.methods.detectCardBrand = function(cardNumber) {
  const number = cardNumber.replace(/\s/g, '');
  
  if (/^4/.test(number)) return 'visa';
  if (/^5[1-5]/.test(number) || /^2[2-7]/.test(number)) return 'mastercard';
  if (/^3[47]/.test(number)) return 'amex';
  if (/^6(?:011|5)/.test(number)) return 'discover';
  if (/^3[0689]/.test(number)) return 'diners';
  if (/^35/.test(number)) return 'jcb';
  
  return 'unknown';
};

// Validate card number using Luhn algorithm
cardSchema.methods.validateCardNumber = function(cardNumber) {
  const number = cardNumber.replace(/\s/g, '');
  
  if (!/^\d+$/.test(number)) return false;
  
  let sum = 0;
  let isEven = false;
  
  for (let i = number.length - 1; i >= 0; i--) {
    let digit = parseInt(number[i]);
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  return sum % 10 === 0;
};

// Pre-save middleware
cardSchema.pre('save', function(next) {
  if (this.isNew && this._originalCardNumber) {
    // Generate fingerprint for new cards using original card number
    this.fingerprint = this.generateFingerprint(this._originalCardNumber);

    // Extract last 4 digits from original card number if not already set
    if (!this.lastFourDigits) {
      this.lastFourDigits = this._originalCardNumber.slice(-4);
    }

    // Detect card brand from original card number if not already set
    if (!this.cardBrand || this.cardBrand === 'unknown') {
      this.cardBrand = this.detectCardBrand(this._originalCardNumber);
    }

    // Clean up the temporary field
    delete this._originalCardNumber;
  }

  next();
});

// Indexes
cardSchema.index({ user: 1, isActive: 1 });
cardSchema.index({ user: 1, isDefault: 1 });
cardSchema.index({ fingerprint: 1 }, { unique: true });

// Static methods
cardSchema.statics.findUserCards = function(userId, activeOnly = true) {
  const query = { user: userId };
  if (activeOnly) {
    query.isActive = true;
  }
  return this.find(query).sort({ isDefault: -1, createdAt: -1 });
};

cardSchema.statics.findDefaultCard = function(userId) {
  return this.findOne({ user: userId, isDefault: true, isActive: true });
};

cardSchema.statics.setDefaultCard = async function(userId, cardId) {
  // Remove default from all user cards
  await this.updateMany(
    { user: userId },
    { isDefault: false }
  );
  
  // Set new default
  return this.findByIdAndUpdate(
    cardId,
    { isDefault: true },
    { new: true }
  );
};

module.exports = mongoose.model('Card', cardSchema);
