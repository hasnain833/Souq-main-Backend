const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
  // Transaction reference (one of these will be set based on transaction type)
  standardPayment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StandardPayment',
    required: false,
    index: true
  },

  escrowTransaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EscrowTransaction',
    required: false,
    index: true
  },

  // Product being rated
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },

  // Rating participants
  ratedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  ratedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Rating type (buyer rating seller or seller rating buyer)
  ratingType: {
    type: String,
    enum: ['buyer_to_seller', 'seller_to_buyer'],
    required: true,
    index: true
  },

  // Rating details
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
    validate: {
      validator: function(v) {
        return Number.isInteger(v) && v >= 1 && v <= 5;
      },
      message: 'Rating must be an integer between 1 and 5'
    }
  },

  // Review text (optional but encouraged)
  review: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: ''
  },

  // Rating categories for detailed feedback
  categories: {
    // For buyer rating seller
    communication: {
      type: Number,
      min: 1,
      max: 5,
      validate: {
        validator: function(v) {
          return v === undefined || (Number.isInteger(v) && v >= 1 && v <= 5);
        },
        message: 'Communication rating must be an integer between 1 and 5'
      }
    },
    
    itemDescription: {
      type: Number,
      min: 1,
      max: 5,
      validate: {
        validator: function(v) {
          return v === undefined || (Number.isInteger(v) && v >= 1 && v <= 5);
        },
        message: 'Item description rating must be an integer between 1 and 5'
      }
    },
    
    shipping: {
      type: Number,
      min: 1,
      max: 5,
      validate: {
        validator: function(v) {
          return v === undefined || (Number.isInteger(v) && v >= 1 && v <= 5);
        },
        message: 'Shipping rating must be an integer between 1 and 5'
      }
    },

    // For seller rating buyer
    payment: {
      type: Number,
      min: 1,
      max: 5,
      validate: {
        validator: function(v) {
          return v === undefined || (Number.isInteger(v) && v >= 1 && v <= 5);
        },
        message: 'Payment rating must be an integer between 1 and 5'
      }
    },

    buyerCommunication: {
      type: Number,
      min: 1,
      max: 5,
      validate: {
        validator: function(v) {
          return v === undefined || (Number.isInteger(v) && v >= 1 && v <= 5);
        },
        message: 'Buyer communication rating must be an integer between 1 and 5'
      }
    }
  },

  // Status tracking
  status: {
    type: String,
    enum: ['pending', 'submitted', 'published', 'hidden'],
    default: 'submitted',
    index: true
  },

  // Moderation
  isModerated: {
    type: Boolean,
    default: false
  },

  moderationNotes: {
    type: String,
    trim: true,
    maxlength: 500
  },

  // Helpful votes from other users
  helpfulVotes: {
    type: Number,
    default: 0,
    min: 0
  },

  votedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    voteType: {
      type: String,
      enum: ['helpful', 'not_helpful']
    },
    votedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Response from rated user
  response: {
    text: {
      type: String,
      trim: true,
      maxlength: 500
    },
    respondedAt: {
      type: Date
    }
  },

  // Metadata
  metadata: {
    userAgent: String,
    ipAddress: String,
    deviceInfo: String
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Pre-save validation to ensure transaction type is provided for transaction-based ratings
// Product ratings (from profile pages) can exist without transactions
ratingSchema.pre('save', function(next) {
  // Allow product ratings without transactions (direct product ratings from profile)
  // Transaction-based ratings still require either standardPayment or escrowTransaction
  const isProductRating = !this.standardPayment && !this.escrowTransaction;

  if (isProductRating) {
    // For product ratings, ensure we have the required fields
    if (!this.product || !this.ratedBy || !this.ratedUser) {
      return next(new Error('Product ratings require product, ratedBy, and ratedUser fields'));
    }
  }

  next();
});

// Compound indexes for performance
ratingSchema.index({ standardPayment: 1, ratingType: 1 });
ratingSchema.index({ escrowTransaction: 1, ratingType: 1 });
ratingSchema.index({ ratedUser: 1, status: 1, createdAt: -1 });
ratingSchema.index({ product: 1, status: 1, createdAt: -1 });
ratingSchema.index({ ratedBy: 1, createdAt: -1 });

// Ensure one rating per user per transaction per type (for escrow transactions)
ratingSchema.index({
  escrowTransaction: 1,
  ratedBy: 1,
  ratingType: 1
}, {
  unique: true,
  partialFilterExpression: { escrowTransaction: { $exists: true } }
});

// Ensure one rating per user per transaction per type (for standard payments)
ratingSchema.index({
  standardPayment: 1,
  ratedBy: 1,
  ratingType: 1
}, {
  unique: true,
  partialFilterExpression: { standardPayment: { $exists: true } }
});

// Virtual for average category rating
ratingSchema.virtual('averageCategoryRating').get(function() {
  const categories = this.categories;
  if (!categories) return this.rating;
  
  const validRatings = Object.values(categories).filter(rating => 
    rating !== undefined && rating !== null
  );
  
  if (validRatings.length === 0) return this.rating;
  
  const sum = validRatings.reduce((acc, rating) => acc + rating, 0);
  return Math.round((sum / validRatings.length) * 10) / 10;
});

// Static method to get user's average rating
ratingSchema.statics.getUserAverageRating = async function(userId) {
  const result = await this.aggregate([
    {
      $match: {
        ratedUser: new mongoose.Types.ObjectId(userId),
        status: 'published'
      }
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalRatings: { $sum: 1 },
        ratingDistribution: {
          $push: '$rating'
        }
      }
    }
  ]);

  if (result.length === 0) {
    return {
      averageRating: 0,
      totalRatings: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    };
  }

  const data = result[0];
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  
  data.ratingDistribution.forEach(rating => {
    distribution[rating] = (distribution[rating] || 0) + 1;
  });

  return {
    averageRating: Math.round(data.averageRating * 10) / 10,
    totalRatings: data.totalRatings,
    ratingDistribution: distribution
  };
};

// Static method to get product's average rating
ratingSchema.statics.getProductAverageRating = async function(productId) {
  const result = await this.aggregate([
    {
      $match: {
        product: new mongoose.Types.ObjectId(productId),
        status: 'published'
      }
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalRatings: { $sum: 1 }
      }
    }
  ]);

  if (result.length === 0) {
    return { averageRating: 0, totalRatings: 0 };
  }

  return {
    averageRating: Math.round(result[0].averageRating * 10) / 10,
    totalRatings: result[0].totalRatings
  };
};

module.exports = mongoose.model('Rating', ratingSchema);
