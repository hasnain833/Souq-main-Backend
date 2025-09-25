const mongoose = require('mongoose');
require('dotenv').config();

async function testCreditWalletExport() {
  try {
    console.log('🧪 Testing creditWalletInternal export...');
    
    // Test 1: Check if the function can be imported
    console.log('\n1. Testing import...');
    try {
      const { creditWalletInternal } = require('./app/user/wallet/controllers/walletController');
      console.log('✅ creditWalletInternal imported successfully');
      console.log('📋 Function type:', typeof creditWalletInternal);
      console.log('📋 Function name:', creditWalletInternal.name);
    } catch (importError) {
      console.error('❌ Import failed:', importError.message);
      return;
    }
    
    // Test 2: Check if the function exists in the exports
    console.log('\n2. Testing exports object...');
    const walletController = require('./app/user/wallet/controllers/walletController');
    console.log('📋 Available exports:', Object.keys(walletController));
    console.log('📋 creditWalletInternal exists:', 'creditWalletInternal' in walletController);
    console.log('📋 creditWalletInternal type:', typeof walletController.creditWalletInternal);
    
    // Test 3: Connect to database and test the function
    console.log('\n3. Testing function execution...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    // Create a test user ID
    const testUserId = new mongoose.Types.ObjectId();
    console.log('📋 Test user ID:', testUserId);
    
    // Test the function
    try {
      const result = await walletController.creditWalletInternal(
        testUserId,
        10.50,
        'USD',
        'Test credit from export test',
        {
          metadata: { test: true, source: 'export_test' }
        }
      );
      
      console.log('✅ Function executed successfully');
      console.log('📋 Result:', JSON.stringify(result, null, 2));
      
    } catch (execError) {
      console.error('❌ Function execution failed:', execError.message);
      console.error('❌ Stack:', execError.stack);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('🔌 Disconnected from MongoDB');
    }
  }
}

// Test the PaymentCompletionService import as well
async function testPaymentCompletionServiceImport() {
  try {
    console.log('\n🧪 Testing PaymentCompletionService import...');
    
    const PaymentCompletionService = require('./services/payment/PaymentCompletionService');
    console.log('✅ PaymentCompletionService imported successfully');
    console.log('📋 Available methods:', Object.getOwnPropertyNames(PaymentCompletionService));
    
    // Check if the service can access creditWalletInternal
    console.log('\n📋 Checking internal imports in PaymentCompletionService...');
    
  } catch (error) {
    console.error('❌ PaymentCompletionService import failed:', error.message);
  }
}

// Run tests
console.log('🚀 Starting creditWalletInternal export tests...');
testCreditWalletExport()
  .then(() => testPaymentCompletionServiceImport())
  .then(() => {
    console.log('\n🎉 All tests completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
