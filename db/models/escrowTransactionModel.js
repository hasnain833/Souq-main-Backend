// EscrowTransaction model: stores escrow payment lifecycle for admin monitoring and future user escrow flow
const mongoose = require('mongoose');

const { Schema } = mongoose;

const EscrowTimelineEntrySchema = new Schema(
  {
    at: { type: Date, default: Date.now },
    by: { type: String, default: '' },
    action: { type: String, default: '' },
    meta: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const EscrowTransactionSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', default: null },
    buyerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    sellerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },

    amount: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    platformFee: { type: Number, default: 0 },
    gateway: { type: String, default: 'manual' },

    status: {
      type: String,
      enum: [
        'pending_payment',
        'funds_held',
        'shipped',
        'delivered',
        'released',
        'refunded',
        'cancelled',
      ],
      default: 'pending_payment',
    },

    holdUntil: { type: Date, default: null },
    notes: { type: String, default: '' },

    timeline: { type: [EscrowTimelineEntrySchema], default: [] },
  },
  { timestamps: true, strict: false }
);

// Indexes for common lookups
EscrowTransactionSchema.index({ orderId: 1 });
EscrowTransactionSchema.index({ buyerId: 1 });
EscrowTransactionSchema.index({ sellerId: 1 });

module.exports = mongoose.model('EscrowTransaction', EscrowTransactionSchema);


