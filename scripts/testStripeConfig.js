require("dotenv").config();

console.log("🔍 Testing Stripe Configuration...");
console.log("");

// Check environment variables
console.log("Environment Variables:");
console.log(
  "STRIPE_PUBLISHABLE_KEY:",
  process.env.STRIPE_PUBLISHABLE_KEY
    ? process.env.STRIPE_PUBLISHABLE_KEY.substring(0, 7) + "..."
    : "Missing"
);
console.log(
  "STRIPE_SECRET_KEY:",
  process.env.STRIPE_SECRET_KEY
    ? process.env.STRIPE_SECRET_KEY.substring(0, 7) + "..."
    : "Missing"
);
console.log(
  "STRIPE_WEBHOOK_SECRET:",
  process.env.STRIPE_WEBHOOK_SECRET
    ? process.env.STRIPE_WEBHOOK_SECRET.substring(0, 7) + "..."
    : "Missing"
);
console.log("");

// Test Stripe initialization
try {
  const stripe = require("stripe");

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("❌ STRIPE_SECRET_KEY is not set in environment variables");
    process.exit(1);
  }

  if (process.env.STRIPE_SECRET_KEY === process.env.STRIPE_SECRET_KEY) {
    console.error("❌ STRIPE_SECRET_KEY is still using placeholder value");
    console.error(
      "Please replace with your actual Stripe test key from https://dashboard.stripe.com/test/apikeys"
    );
    process.exit(1);
  }

  const stripeInstance = stripe(process.env.STRIPE_SECRET_KEY);

  console.log("✅ Stripe instance created successfully", stripeInstance);

  // Test a simple API call
  console.log("🔄 Testing Stripe API connection...");
  stripeInstance.balance
    .retrieve()
    .then((balance) => {
      console.log("✅ Stripe API connection successful");
      console.log("Account balance:", balance);
    })
    .catch((error) => {
      console.error("❌ Stripe API connection failed:", error.message);
      if (error.type === "StripeAuthenticationError") {
        console.error("This usually means your secret key is invalid");
      }
    });
} catch (error) {
  console.error("❌ Failed to initialize Stripe:", error.message);
}

console.log("");
console.log("📝 To get real Stripe test keys:");
console.log("1. Go to https://dashboard.stripe.com/register");
console.log("2. Create a free account");
console.log("3. Go to https://dashboard.stripe.com/test/apikeys");
console.log('4. Copy the "Publishable key" and "Secret key"');
console.log("5. Update your .env file with the real keys");
