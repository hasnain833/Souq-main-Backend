const mongoose = require('mongoose');
const { v4: uuid4 } = require('uuid')
// Inlined enums were previously imported from ../../constants/enum
// GENDERS, COUNTRIES, CITIES, LANGUAGES are currently unused as corresponding fields are commented out.

const userSchema = new mongoose.Schema({
  id: {
    type: String,
    default: uuid4
  },
  // Legacy profile image URL/path (kept for fallback rendering)
  profile: {
    type: String,
    default: null
  },
  // Deprecated: previously stored image buffers; now using MongoDB storage in `profileImage`
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  userName: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: function () {
      // Require password only if not social login
      return !this.isSocialLogin;
    }
  },
  roles: {
    type: [String],
    enum: ['buyer', 'seller'],
    default: ['buyer'],
  },
  currentMode: {
    type: String,
    enum: ['buyer', 'seller'],
    default: 'buyer',
  },
  stripeAccountId:{
    type: String,
    default: null
  },
  paypalEmail:{
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['active', 'suspended'],
    default: 'active'
  },
  isSocialLogin: {
    type: Boolean,
    default: false
  },
  loginWithGoogle: {
    type: Boolean,
    default: false,
  },
  loginWithFacebook: {
    type: Boolean,
    default: false,
  },
  phone: {
    type: String,
    trim: true,
    default: null
  },
  emailVerifiedAt: {
    type: Date,
    default: null
  },
  phoneVerifiedAt: {
    type: Date,
    default: null
  },
  about: {
    type: String,
    default: '',
    maxlength: 1000
  },
  otp: {
    type: String,
    default: null
  },
  otpCreatedAt: {
    type: Date,
    default: null
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    default: null
  },
  dateOfBirth: {
    type: Date,
    default: null
  },
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  country: {
    type: String,
    default: null
  },
  city: {
    type: String,
    default: null
  },
  cityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'City',
    default: null
  },
  countryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Country',
    default: null
  },
  // street1: {
  //   type: String
  // },
  // street2: {
  //   type: String
  // },
  // zipCode: {
  //   type: String
  // },
  cityShow: {
    type: Boolean,
    default: true
  },
  language: {
    type: String,
    enum: ['en', 'ar'],
    default: 'en'
  },
  vacationMode: {
    type: Boolean,
    default: false
  },
  refreshToken: {
    type: String,
    default: null
  },
  lastLoginAt: {
    type: Date,
    default: null
  },
  deletedAt: {
    type: Date,
    default: null
  },
    userNameUpdatedAt: {
    type: Date,
    default: null,
  }

}, {
  id: false,
  timestamps: true // includes createdAt and updatedAt
});

module.exports = mongoose.model('User', userSchema);
