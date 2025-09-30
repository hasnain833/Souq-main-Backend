require('dotenv').config(); 

module.exports = {
  environment: process.env.NODE_ENV || 'development',

  server: {
    port: process.env.PORT,
    baseUrl: process.env.BASE_URL
  },

  database: {
    mongoUri: process.env.MONGO_URI
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
