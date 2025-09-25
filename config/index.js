// backend/config/index.js

require('dotenv').config(); // Load from .env file

module.exports = {
  environment: process.env.NODE_ENV || 'development',

  server: {
    port: process.env.PORT || 5000,
    baseUrl: process.env.BASE_URL || 'http://localhost:5000'
  },

  database: {
    mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/myapp'
  },

  configuration: {
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY || '',
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || ''
    },
    paypal: {
      clientId: process.env.PAYPAL_CLIENT_ID || '',
      clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
      mode: process.env.PAYPAL_MODE || 'sandbox'
    }
  }
};
