/**
 * Test script to verify require paths work correctly
 */

console.log('🧪 Testing require paths...');

try {
  console.log('1. Testing EscrowTransaction model...');
  const EscrowTransaction = require('./db/models/escrowTransactionModel');
  console.log('✅ EscrowTransaction model loaded successfully');
  console.log('   Model name:', EscrowTransaction.modelName);
  
  console.log('2. Testing StandardPayment model...');
  const StandardPayment = require('./db/models/standardPaymentModel');
  console.log('✅ StandardPayment model loaded successfully');
  console.log('   Model name:', StandardPayment.modelName);
  
  console.log('3. Testing Transaction model...');
  const Transaction = require('./db/models/transactionModel');
  console.log('✅ Transaction model loaded successfully');
  console.log('   Model name:', Transaction.modelName);
  
  console.log('\n✅ All models loaded successfully!');
  
} catch (error) {
  console.error('❌ Error loading models:', error.message);
  console.error('Stack:', error.stack);
}
