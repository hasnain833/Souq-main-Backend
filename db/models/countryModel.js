const mongoose = require('mongoose');

const countrySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    length: 2 // ISO 3166-1 alpha-2 code
  },
  dialCode: {
    type: String,
    required: true
  },
  flag: {
    type: String,
    default: ''
  },
  currency: {
    code: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    symbol: {
      type: String,
      required: true
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes
countrySchema.index({ name: 1 });
countrySchema.index({ code: 1 });
countrySchema.index({ isActive: 1, sortOrder: 1 });

// Virtual for display name with flag
countrySchema.virtual('displayName').get(function() {
  return this.flag ? `${this.flag} ${this.name}` : this.name;
});

// Static method to get active countries
countrySchema.statics.getActiveCountries = function() {
  return this.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });
};

// Static method to find by code
countrySchema.statics.findByCode = function(code) {
  return this.findOne({ code: code.toUpperCase(), isActive: true });
};

module.exports = mongoose.model('Country', countrySchema);
