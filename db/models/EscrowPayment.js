// models/EscrowPayment.js
const mongoose = require('mongoose');

const escrowPaymentSchema = new mongoose.Schema({
  // Basic info
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  
  // Payment amounts
  totalAmount: Number,
  commission: Number, // Platform commission
  netAmount: Number, // Amount seller receives
  platformFeeConfig: {
    configId: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformFee', default: null },
    version: { type: String, default: null },
    percentage: { type: Number, default: null }
  },
  
  // Payment provider info
  paymentProvider: {
    type: String,
    enum: ['stripe', 'paypal'],
    required: true
  },
  stripePaymentIntentId: String, // For Stripe escrow
  paypalOrderId: String, // For PayPal escrow
  paypalCaptureId: String, // For PayPal escrow
  
  // Status tracking
  status: {
    type: String,
    enum: ['pending', 'held', 'released', 'cancelled', 'disputed'],
    default: 'pending'
  },
  buyerApproved: {
    type: Boolean,
    default: false
  },
  
  // Product & shipping info
  productDetails: {
    title: String,
    price: Number,
    quantity: Number
  },
  shippingAddress: Object,
  
  // Timestamps
  paymentHeldAt: Date,
  releasedAt: Date,
  disputeRaisedAt: Date,
  
  // Dispute info
  disputeReason: String,
  disputeRaisedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('EscrowPayment', escrowPaymentSchema);