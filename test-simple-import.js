console.log('🧪 Testing simple import...');

try {
  console.log('1. Importing wallet controller...');
  const walletController = require('./app/user/wallet/controllers/walletController');
  
  console.log('2. Checking exports...');
  console.log('Available exports:', Object.keys(walletController));
  
  console.log('3. Checking creditWalletInternal...');
  console.log('creditWalletInternal exists:', 'creditWalletInternal' in walletController);
  console.log('creditWalletInternal type:', typeof walletController.creditWalletInternal);
  
  if (walletController.creditWalletInternal) {
    console.log('✅ creditWalletInternal is available');
  } else {
    console.log('❌ creditWalletInternal is NOT available');
  }
  
} catch (error) {
  console.error('❌ Import failed:', error.message);
  console.error('Stack:', error.stack);
}
