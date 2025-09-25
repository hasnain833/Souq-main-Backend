const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true
  },
  
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
  
  // Order details
  orderDetails: {
    productPrice: {
      type: Number,
      required: true
    },
    offerAmount: Number, // If order was from an accepted offer
    offerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Offer'
    },
    quantity: {
      type: Number,
      default: 1
    },
    currency: {
      type: String,
      default: 'USD'
    }
  },
  
  // Payment information
  payment: {
    method: {
      type: String,
      enum: ['escrow', 'standard'],
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded', 'partially_refunded'],
      default: 'pending'
    },
    transactionId: String,
    escrowTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EscrowTransaction'
    },
    paymentGateway: String,
    fees: {
      platformFee: Number,
      paymentGatewayFee: Number,
      shippingFee: Number,
      tax: Number,
      total: Number
    }
  },
  
  // Shipping information
  shipping: {
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ShippingProvider'
    },
    serviceCode: String,
    serviceName: String,
    method: {
      type: String,
      enum: ['delivery', 'pickup', 'dropoff', 'local_delivery'],
      default: 'delivery'
    },
    
    // Addresses
    fromAddress: {
      fullName: String,
      street1: String,
      street2: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
      phoneNumber: String
    },

    toAddress: {
      fullName: String,
      street1: String,
      street2: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
      phoneNumber: String
    },
    
    // Tracking information
    trackingNumber: String,
    trackingUrl: String,
    estimatedDelivery: Date,
    actualDelivery: Date,
    
    // Package details
    packageDetails: {
      weight: Number, // in kg
      dimensions: {
        length: Number,
        width: Number,
        height: Number,
        unit: {
          type: String,
          default: 'cm'
        }
      },
      description: String,
      value: Number,
      currency: String
    },
    
    // Shipping costs
    cost: {
      baseFee: Number,
      weightFee: Number,
      fuelSurcharge: Number,
      insurance: Number,
      total: Number,
      currency: String
    },
    
    // Special services
    services: {
      insurance: {
        type: Boolean,
        default: false
      },
      signatureRequired: {
        type: Boolean,
        default: false
      },
      cashOnDelivery: {
        type: Boolean,
        default: false
      }
    }
  },
  
  // Order status and timeline
  status: {
    type: String,
    enum: [
      'pending_payment',
      'paid',
      'processing',
      'shipped',
      'in_transit',
      'out_for_delivery',
      'delivered',
      'cancelled',
      'returned',
      'refunded'
    ],
    default: 'pending_payment'
  },
  
  timeline: [{
    status: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    description: String,
    location: String,
    updatedBy: {
      type: String,
      enum: ['system', 'buyer', 'seller', 'shipping_provider']
    }
  }],
  
  // Delivery confirmation
  delivery: {
    confirmedBy: {
      type: String,
      enum: ['buyer', 'system', 'shipping_provider']
    },
    confirmationDate: Date,
    deliveryProof: {
      signature: String,
      photo: String,
      notes: String
    },
    rating: {
      deliveryRating: {
        type: Number,
        min: 1,
        max: 5
      },
      feedback: String,
      ratedAt: Date
    }
  },
  
  // Notes and communication
  notes: {
    buyerNotes: String,
    sellerNotes: String,
    shippingInstructions: String,
    internalNotes: String
  }
}, {
  timestamps: true
});

// Indexes for better performance
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ buyer: 1 });
orderSchema.index({ seller: 1 });
orderSchema.index({ product: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ 'shipping.trackingNumber': 1 });
orderSchema.index({ createdAt: -1 });

// Generate order number before saving
orderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    const count = await this.constructor.countDocuments();
    this.orderNumber = `ORD-${Date.now()}-${(count + 1).toString().padStart(6, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
