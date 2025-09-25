console.log('🧪 Testing PaymentCompletionService import...');

try {
  console.log('1. Importing PaymentCompletionService...');
  const PaymentCompletionService = require('./services/payment/PaymentCompletionService');
  
  console.log('✅ PaymentCompletionService imported successfully');
  console.log('Available methods:', Object.getOwnPropertyNames(PaymentCompletionService));
  
  console.log('2. Testing static methods...');
  console.log('processStandardPaymentCompletion:', typeof PaymentCompletionService.processStandardPaymentCompletion);
  console.log('processEscrowPaymentCompletion:', typeof PaymentCompletionService.processEscrowPaymentCompletion);
  console.log('processPaymentCompletionByTransaction:', typeof PaymentCompletionService.processPaymentCompletionByTransaction);
  
  console.log('✅ All PaymentCompletionService methods are available');
  
} catch (error) {
  console.error('❌ PaymentCompletionService import failed:', error.message);
  console.error('Stack:', error.stack);
}
