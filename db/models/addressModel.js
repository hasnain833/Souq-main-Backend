const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
  {
    // User reference
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Address details
    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    street1: {
      type: String,
      required: true,
      trim: true,
    },

    street2: {
      type: String,
      trim: true,
      default: "",
    },

    city: {
      type: String,
      required: true,
      trim: true,
    },

    state: {
      type: String,
      trim: true,
      default: "",
    },

    zipCode: {
      type: String,
      required: true,
      trim: true,
    },

    country: {
      type: String,
      required: true,
      trim: true,
      default: "United States",
    },

    // Phone number for delivery
    phoneNumber: {
      type: String,
      trim: true,
      default: "",
    },

    // Address type
    addressType: {
      type: String,
      enum: ["home", "work", "other"],
      default: "home",
    },

    // Default address flag
    isDefault: {
      type: Boolean,
      default: false,
    },

    // Active status
    isActive: {
      type: Boolean,
      default: true,
    },

    // Usage tracking
    lastUsed: {
      type: Date,
      default: null,
    },

    usageCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Index for efficient queries
addressSchema.index({ user: 1, isDefault: 1 });
addressSchema.index({ user: 1, isActive: 1 });

// Pre-save middleware to ensure only one default address per user
addressSchema.pre("save", async function (next) {
  if (this.isDefault && this.isModified("isDefault")) {
    // Remove default flag from other addresses of the same user
    await this.constructor.updateMany(
      {
        user: this.user,
        _id: { $ne: this._id },
        isDefault: true,
      },
      { $set: { isDefault: false } }
    );
  }
  next();
});

// Static method to get user's default address
addressSchema.statics.getDefaultAddress = function (userId) {
  return this.findOne({
    user: userId,
    isDefault: true,
    isActive: true,
  });
};

// Static method to get user's addresses
addressSchema.statics.getUserAddresses = function (userId) {
  return this.find({
    user: userId,
    isActive: true,
  }).sort({ isDefault: -1, createdAt: -1 });
};

// Instance method to set as default
addressSchema.methods.setAsDefault = async function () {
  // Remove default flag from other addresses
  await this.constructor.updateMany(
    {
      user: this.user,
      _id: { $ne: this._id },
      isDefault: true,
    },
    { $set: { isDefault: false } }
  );

  // Set this address as default
  this.isDefault = true;
  return this.save();
};

// Instance method to increment usage
addressSchema.methods.incrementUsage = function () {
  this.usageCount += 1;
  this.lastUsed = new Date();
  return this.save();
};

module.exports = mongoose.model("Address", addressSchema);
