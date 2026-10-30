const mongoose = require("mongoose");

const personalizationSchema = new mongoose.Schema(
  {
    user: {
      type: String, // ✅ Changed from ObjectId to String
      ref: "User",
      required: true,
    },
    followedCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    followedBrands: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    likedProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Personalization", personalizationSchema);
