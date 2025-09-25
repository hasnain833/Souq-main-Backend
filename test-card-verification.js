// Simple test script to verify card functionality
require('dotenv').config();
const mongoose = require('mongoose');

// Connect to database
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/souq');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

const testCardVerification = async () => {
  try {
    await connectDB();
    
    console.log('🧪 Testing Card Verification Service...');
    
    const CardVerificationService = require('./services/payment/CardVerificationService');
    const service = new CardVerificationService();
    
    // Test card data
    const testCard = {
      cardNumber: '4111111111111111', // Test Visa card
      expiryMonth: '12',
      expiryYear: '25',
      cvv: '123',
      cardholderName: 'Test User'
    };
    
    console.log('🔍 Testing card verification...');
    const result = await service.verifyCard(testCard, 'stripe');
    
    console.log('✅ Verification result:', {
      success: result.success,
      cardBrand: result.cardBrand,
      lastFourDigits: result.lastFourDigits,
      isValid: result.isValid
    });
    
    if (result.success) {
      console.log('🎉 Card verification service is working correctly!');
    } else {
      console.log('❌ Card verification failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
};

// Run the test
testCardVerification();
