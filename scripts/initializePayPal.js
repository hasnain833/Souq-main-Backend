/**
 * Script: initializePayPal.js
 * Purpose: Seed or update PayPal gateway configuration in the database
 */

require("dotenv").config();
const mongoose = require("mongoose");

// Adjust the path to your actual Gateway model
const PaymentGateway = require("../models/PaymentGateway"); 

// Mongo connection string
const MONGO_URI = process.env.MONGODB_URI ;

async function initPayPal() {
  try {
    console.log("🔌 Connecting to DB...");
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const clientId = process.env.PAYPAL_CLIENT_ID;
    const secret = process.env.PAYPAL_SECRET;
    const mode = process.env.PAYPAL_MODE || "sandbox"; // "sandbox" | "live"

    if (!clientId || !secret) {
      console.error("❌ Missing PayPal environment variables!");
      console.error(
        "Please set PAYPAL_CLIENT_ID and PAYPAL_SECRET in your .env file."
      );
      process.exit(1);
    }

    const gatewayConfig = {
      id: "paypal",
      name: "PayPal",
      enabled: true,
      type: "standard", // adjust if you differentiate between escrow/standard
      credentials: {
        clientId,
        secret,
        mode,
      },
      feePercentage: 3.49, // adjust as per PayPal agreement
      fixedFee: 0.49, // USD fixed fee
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    console.log("⚙️  Upserting PayPal gateway...");
    const result = await PaymentGateway.findOneAndUpdate(
      { id: "paypal" },
      { $set: gatewayConfig },
      { upsert: true, new: true }
    );

    console.log("✅ PayPal gateway initialized/updated:", result);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error initializing PayPal gateway:", err);
    process.exit(1);
  }
}

initPayPal();
