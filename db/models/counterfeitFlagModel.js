const mongoose = require('mongoose');
const { v4: uuid4 } = require('uuid');

const counterfeitFlagSchema = new mongoose.Schema({
  id: {
    type: String,
    default: uuid4
  },
  flagId: {
    type: String,
    unique: true,
    default: () => 'CF-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5).toUpperCase()
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  reporterId: {
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
    enum: ['counterfeit_product', 'fake_brand', 'unauthorized_replica', 'misleading_description', 'stolen_images'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'under_investigation', 'verified', 'dismissed', 'resolved'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  reason: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  evidence: [{
    type: {
      type: String,
      enum: ['image', 'document', 'video', 'link'],
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
  investigation: {
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null
    },
    startedAt: {
      type: Date,
      default: null
    },
    notes: [{
      adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: true
      },
      note: {
        type: String,
        required: true
      },
      isInternal: {
        type: Boolean,
        default: true
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    verdict: {
      type: String,
      enum: ['counterfeit_confirmed', 'legitimate_product', 'insufficient_evidence', 'requires_further_investigation'],
      default: null
    },
    verdictReason: {
      type: String,
      default: null
    },
    completedAt: {
      type: Date,
      default: null
    }
  },
  actions: [{
    type: {
      type: String,
      enum: ['product_removed', 'seller_warned', 'seller_suspended', 'listing_updated', 'no_action'],
      required: true
    },
    description: String,
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true
    },
    performedAt: {
      type: Date,
      default: Date.now
    }
  }],
  reportCount: {
    type: Number,
    default: 1
  },
  additionalReporters: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reportedAt: {
      type: Date,
      default: Date.now
    },
    reason: String
  }],
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
counterfeitFlagSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('CounterfeitFlag', counterfeitFlagSchema);
