const mongoose = require('mongoose');
const { v4: uuid4 } = require('uuid');

const disputeSchema = new mongoose.Schema({
  id: {
    type: String,
    default: uuid4
  },
  disputeId: {
    type: String,
    unique: true,
    default: () => 'DSP-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5).toUpperCase()
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  buyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['product_not_received', 'product_damaged', 'not_as_described', 'counterfeit', 'payment_issue', 'other'],
    required: true
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved', 'closed', 'escalated'],
    default: 'open'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  evidence: [{
    type: {
      type: String,
      enum: ['image', 'document', 'video'],
      required: true
    },
    url: {
      type: String,
      required: true
    },
    description: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  messages: [{
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'messages.senderType',
      required: true
    },
    senderType: {
      type: String,
      enum: ['User', 'Admin'],
      required: true
    },
    message: {
      type: String,
      required: true
    },
    isInternal: {
      type: Boolean,
      default: false
    },
    sentAt: {
      type: Date,
      default: Date.now
    }
  }],
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  resolution: {
    type: String,
    enum: ['refund_buyer', 'favor_seller', 'partial_refund', 'replacement', 'other'],
    default: null
  },
  resolutionDetails: {
    type: String,
    default: null
  },
  refundAmount: {
    type: Number,
    default: 0
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  id: false,
  timestamps: true
});

// Update the updatedAt field before saving
disputeSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Dispute', disputeSchema);
