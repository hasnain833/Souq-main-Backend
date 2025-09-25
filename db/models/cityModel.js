const mongoose = require('mongoose');

const citySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  country: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Country',
    required: true
  },
  countryCode: {
    type: String,
    required: true,
    uppercase: true
  },
  state: {
    type: String,
    trim: true,
    default: ''
  },
  latitude: {
    type: Number,
    default: null
  },
  longitude: {
    type: Number,
    default: null
  },
  population: {
    type: Number,
    default: 0
  },
  isCapital: {
    type: Boolean,
    default: false
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

// Compound indexes
citySchema.index({ country: 1, name: 1 });
citySchema.index({ countryCode: 1, name: 1 });
citySchema.index({ isActive: 1, sortOrder: 1 });
citySchema.index({ name: 'text' }); // For text search

// Ensure unique city name per country
citySchema.index({ name: 1, country: 1 }, { unique: true });

// Virtual for full location
citySchema.virtual('fullLocation').get(function() {
  return this.state ? `${this.name}, ${this.state}` : this.name;
});

// Static method to get cities by country
citySchema.statics.getCitiesByCountry = function(countryId) {
  return this.find({ 
    country: countryId, 
    isActive: true 
  }).sort({ 
    isCapital: -1, // Capitals first
    sortOrder: 1, 
    name: 1 
  });
};

// Static method to get cities by country code
citySchema.statics.getCitiesByCountryCode = function(countryCode) {
  return this.find({ 
    countryCode: countryCode.toUpperCase(), 
    isActive: true 
  }).sort({ 
    isCapital: -1, // Capitals first
    sortOrder: 1, 
    name: 1 
  });
};

// Static method to search cities
citySchema.statics.searchCities = function(query, countryId = null) {
  const searchQuery = {
    $text: { $search: query },
    isActive: true
  };
  
  if (countryId) {
    searchQuery.country = countryId;
  }
  
  return this.find(searchQuery).sort({ score: { $meta: 'textScore' } });
};

module.exports = mongoose.model('City', citySchema);
