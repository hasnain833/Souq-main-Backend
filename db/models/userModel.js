const mongoose = require('mongoose');
const { v4: uuid4 } = require('uuid')
const { GENDERS, COUNTRIES, CITIES, LANGUAGES } = require('../../constants/enum')

const userSchema = new mongoose.Schema({
  id: {
    type: String,
    default: uuid4
  },
  profile: {
    type: String,
    default: null
  },
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
  // isSocialLogin: {
  //   type: Boolean,
  //   default: false
  // },
  // loginWithGoogle: {
  //   type: Boolean,
  //   default: false,
  // },
  // loginWithFacebook: {
  //   type: Boolean,
  //   default: false,
  // },
  // phone: {
  //   type: String,
  //   trim: true,
  //   default: null
  // },
  // emailVerifiedAt: {
  //   type: Date,
  //   default: null
  // },
  // phoneVerifiedAt: {
  //   type: Date,
  //   default: null
  // },
  // about: {
  //   type: String,
  //   default: '',
  //   maxlength: 1000
  // },
  // otp: {
  //   type: String,
  //   default: null
  // },
  // otpCreatedAt: {
  //   type: Date,
  //   default: null
  // },
  // gender: {
  //   type: String,
  //   enum: GENDERS,
  //   // default: 'other'
  // },
  // dateOfBirth: {
  //   type: Date,
  //   default: null
  // },
  // followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // country: {
  //   type: String,
  //   enum: COUNTRIES,
  //   // default: 'IN'
  // },
  // city: {
  //   type: String,
  //   enum: CITIES,
  //   // default: 'Mumbai'
  // },
  // street1: {
  //   type: String
  // },
  // street2: {
  //   type: String
  // },
  // zipCode: {
  //   type: String
  // },
  // cityShow: {
  //   type: Boolean,
  //   default: true
  // },
  // language: {
  //   type: String,
  //   enum: LANGUAGES,
  //   default: 'en'
  // },
  // vacationMode: {
  //   type: Boolean,
  //   default: false
  // },
  // refreshToken: {
  //   type: String,
  //   default: null
  // },
  // lastLoginAt: {
  //   type: Date,
  //   default: null
  // },
  // createdAt: {
  //   type: Date,
  //   default: Date.now
  // },
  // deletedAt: {
  //   type: Date,
  //   default: null
  // },
  //   userNameUpdatedAt: {
  //   type: Date,
  //   default: null,
  // }

},{ 
  id: false, 
  timestamps: true // includes createdAt and updatedAt
});

module.exports = mongoose.model('User', userSchema);
