console.log('🧪 Testing wallet controller import...');

try {
  console.log('1. Importing wallet controller...');
  const walletController = require('./app/user/wallet/controllers/walletController');
  
  console.log('✅ Wallet controller imported successfully');
  console.log('Available exports:', Object.keys(walletController));
  
  console.log('2. Checking completePayment function...');
  console.log('completePayment exists:', 'completePayment' in walletController);
  console.log('completePayment type:', typeof walletController.completePayment);
  
  if (walletController.completePayment) {
    console.log('✅ completePayment function is available');
  } else {
    console.log('❌ completePayment function is NOT available');
  }
  
  console.log('3. Testing wallet routes import...');
  const walletRoutes = require('./app/user/wallet/routes/walletRoutes');
  console.log('✅ Wallet routes imported successfully');
  
  console.log('4. Testing user routes import...');
  const userRoutes = require('./app/user/index');
  console.log('✅ User routes imported successfully');
  
  console.log('🎉 All imports successful - no circular dependency issues!');
  
} catch (error) {
  console.error('❌ Import failed:', error.message);
  console.error('Stack:', error.stack);
}
