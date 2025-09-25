const express = require('express');

async function testWalletRouteConfiguration() {
  try {
    console.log('🧪 Testing wallet route configuration...');
    
    // Create a test Express app
    const app = express();
    app.use(express.json());
    
    // Import wallet controller
    console.log('1. Importing wallet controller...');
    const walletController = require('./app/user/wallet/controllers/walletController');
    console.log('✅ Wallet controller imported');
    
    // Import wallet routes
    console.log('2. Importing wallet routes...');
    const walletRoutes = require('./app/user/wallet/routes/walletRoutes');
    console.log('✅ Wallet routes imported');
    
    // Mount wallet routes
    console.log('3. Mounting wallet routes...');
    app.use('/api/user/wallet', walletRoutes);
    console.log('✅ Wallet routes mounted');
    
    // Check if the route exists
    console.log('4. Checking route configuration...');
    const routes = [];
    app._router.stack.forEach(function(middleware) {
      if (middleware.route) {
        routes.push({
          method: Object.keys(middleware.route.methods)[0].toUpperCase(),
          path: middleware.route.path
        });
      } else if (middleware.name === 'router') {
        middleware.handle.stack.forEach(function(handler) {
          if (handler.route) {
            routes.push({
              method: Object.keys(handler.route.methods)[0].toUpperCase(),
              path: '/api/user/wallet' + handler.route.path
            });
          }
        });
      }
    });
    
    console.log('📋 Available routes:');
    routes.forEach(route => {
      console.log(`   ${route.method} ${route.path}`);
    });
    
    // Check if our specific route exists
    const completePaymentRoute = routes.find(route => 
      route.method === 'POST' && route.path === '/api/user/wallet/complete-payment'
    );
    
    if (completePaymentRoute) {
      console.log('✅ POST /api/user/wallet/complete-payment route is configured correctly');
    } else {
      console.log('❌ POST /api/user/wallet/complete-payment route is NOT found');
    }
    
    // Test the controller function directly (without database)
    console.log('5. Testing controller function availability...');
    if (typeof walletController.completePayment === 'function') {
      console.log('✅ completePayment function is available');
      console.log('Function length (parameters):', walletController.completePayment.length);
    } else {
      console.log('❌ completePayment function is NOT available');
    }
    
    console.log('🎉 Route configuration test completed successfully!');
    
  } catch (error) {
    console.error('❌ Route configuration test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testWalletRouteConfiguration();
