/**
 * Final verification script for escrow payment status fix
 * Tests the complete flow: payment success page → order status update → orders list API
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000';

async function testCompleteEscrowFlow() {
  console.log('🎯 FINAL VERIFICATION: Complete Escrow Payment Status Flow\n');
  
  // Configuration - UPDATE THESE VALUES
  const config = {
    accessToken: 'your_actual_jwt_token_here', // REQUIRED: Replace with valid token
    escrowTransactionId: '68b04131db9487c31cc1b72c', // From your example
    specificOrderId: '68b03a162884f14f95332b85' // From your example
  };
  
  console.log('📋 Test Configuration:');
  console.log('  🆔 Escrow Transaction ID:', config.escrowTransactionId);
  console.log('  📦 Specific Order ID:', config.specificOrderId);
  console.log('  🔑 Access Token Set:', config.accessToken !== 'your_actual_jwt_token_here' ? 'Yes' : 'No');
  console.log('');
  
  if (config.accessToken === 'your_actual_jwt_token_here') {
    console.log('❌ PLEASE UPDATE THE ACCESS TOKEN BEFORE RUNNING THIS TEST');
    console.log('   Get it from browser localStorage or developer tools');
    return;
  }

  // Step 1: Simulate payment success page - complete escrow payment
  console.log('1️⃣ STEP 1: Simulating Payment Success Page - Complete Escrow Payment');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const completePaymentResponse = await axios.post(
      `${API_BASE_URL}/api/user/escrow/${config.escrowTransactionId}/complete-payment`,
      {
        paymentIntentId: 'test_payment_intent',
        amount: 22.66,
        currency: 'USD'
      },
      {
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (completePaymentResponse.data.success) {
      const escrowData = completePaymentResponse.data.data.escrowTransaction;
      console.log('✅ Payment completion API successful');
      console.log('   🔒 Escrow Status:', escrowData.status);
      console.log('   🆔 Transaction ID:', escrowData.transactionId);
      console.log('   🔄 Status Changed:', completePaymentResponse.data.data.statusChanged);
      
      if (escrowData.status === 'funds_held') {
        console.log('   🎉 SUCCESS: EscrowTransaction status correctly set to "funds_held"');
      } else {
        console.log('   ❌ ISSUE: Expected "funds_held", got:', escrowData.status);
      }
    } else {
      console.log('❌ Payment completion API failed:', completePaymentResponse.data);
      return;
    }
  } catch (error) {
    if (error.response?.status === 400 && error.response.data?.error?.includes('already processed')) {
      console.log('ℹ️  Payment already completed (this is expected for testing)');
      console.log('   Continuing with status verification...');
    } else {
      console.log('❌ Payment completion failed:', {
        status: error.response?.status,
        error: error.response?.data?.error || error.message
      });
      if (error.response?.status === 401) {
        console.log('   💡 Check your access token');
        return;
      }
    }
  }

  // Step 2: Check order details API (simulates what order details page shows)
  console.log('\n2️⃣ STEP 2: Testing Order Details API');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const orderDetailsResponse = await axios.get(
      `${API_BASE_URL}/api/user/orders/${config.specificOrderId}`,
      {
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (orderDetailsResponse.data.success) {
      const order = orderDetailsResponse.data.data.order;
      console.log('✅ Order details API successful');
      console.log('   📦 Order Number:', order.orderNumber);
      console.log('   🏷️  Order Status:', order.status);
      console.log('   💳 Payment Status:', order.payment?.status);
      console.log('   🔗 Order Type:', order.type);
      
      if (order.type === 'escrow' && order.payment?.status === 'funds_held' && order.status === 'paid') {
        console.log('   🎉 PERFECT: Order details show correct status mapping!');
      } else {
        console.log('   ❌ ISSUE: Status mapping not correct');
        console.log('   📋 Expected: type=escrow, payment.status=funds_held, status=paid');
        console.log('   📋 Actual:', { type: order.type, paymentStatus: order.payment?.status, orderStatus: order.status });
      }
    } else {
      console.log('❌ Order details API failed:', orderDetailsResponse.data);
    }
  } catch (error) {
    console.log('❌ Order details API error:', {
      status: error.response?.status,
      error: error.response?.data?.error || error.message
    });
  }

  // Step 3: Check orders list API (simulates what orders page shows)
  console.log('\n3️⃣ STEP 3: Testing Orders List API');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const ordersListResponse = await axios.get(
      `${API_BASE_URL}/api/user/orders?role=buyer&limit=20`,
      {
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (ordersListResponse.data.success) {
      const orders = ordersListResponse.data.data.orders;
      console.log(`✅ Orders list API successful - Found ${orders.length} orders`);
      
      // Find the specific order
      const targetOrder = orders.find(order => order._id === config.specificOrderId);
      
      if (targetOrder) {
        console.log('✅ Found target order in list:');
        console.log('   📦 Order Number:', targetOrder.orderNumber);
        console.log('   🏷️  Order Status:', targetOrder.status);
        console.log('   💳 Payment Status:', targetOrder.payment?.status);
        console.log('   🔗 Order Type:', targetOrder.type);
        
        if (targetOrder.type === 'escrow' && targetOrder.payment?.status === 'funds_held' && targetOrder.status === 'paid') {
          console.log('   🎉 PERFECT: Orders list shows correct status!');
          console.log('   ✅ User will see "paid" instead of "pending_payment"');
        } else {
          console.log('   ❌ ISSUE: Orders list still showing incorrect status');
          console.log('   📋 Expected: status=paid, payment.status=funds_held');
          console.log('   📋 Actual:', { orderStatus: targetOrder.status, paymentStatus: targetOrder.payment?.status });
        }
      } else {
        console.log('⚠️  Target order not found in orders list');
        console.log('   This could be due to pagination or user access');
      }
      
      // Count escrow orders with correct status
      const escrowOrders = orders.filter(order => order.type === 'escrow');
      const fixedEscrowOrders = escrowOrders.filter(order => 
        order.payment?.status === 'funds_held' && order.status === 'paid'
      );
      
      console.log(`\n📊 Summary of ${escrowOrders.length} escrow orders:`);
      console.log(`   ✅ Correctly fixed: ${fixedEscrowOrders.length}`);
      console.log(`   ❌ Still need fixing: ${escrowOrders.length - fixedEscrowOrders.length}`);
      
    } else {
      console.log('❌ Orders list API failed:', ordersListResponse.data);
    }
  } catch (error) {
    console.log('❌ Orders list API error:', {
      status: error.response?.status,
      error: error.response?.data?.error || error.message
    });
  }

  // Step 4: Final summary
  console.log('\n🏁 FINAL VERIFICATION SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('What was tested:');
  console.log('1. ✅ Escrow payment completion API (complete-payment endpoint)');
  console.log('2. ✅ Order details API (individual order status)');
  console.log('3. ✅ Orders list API (what user sees on orders page)');
  console.log('');
  console.log('Expected results:');
  console.log('- EscrowTransaction.status = "funds_held"');
  console.log('- Transaction.status = "completed" + orderStatus = "paid"');
  console.log('- Order details API shows: status = "paid"');
  console.log('- Orders list API shows: status = "paid" (not "pending_payment")');
  console.log('');
  console.log('🎯 If all steps show ✅ SUCCESS/PERFECT, your issue is resolved!');
  console.log('🔧 If any step shows ❌ ISSUE, check the server logs for details');
}

// Usage instructions
console.log('🧪 Final Escrow Payment Status Verification');
console.log('============================================\n');
console.log('This script tests the complete escrow payment flow after all fixes.\n');
console.log('⚠️  REQUIRED: Update the accessToken in the config object above');
console.log('💡 Get the token from browser localStorage or developer tools');
console.log('🚀 Ensure your backend server is running on port 5000\n');
console.log('Expected flow:');
console.log('1. Complete escrow payment (simulate payment success page)');
console.log('2. Check order details (individual order API)');
console.log('3. Check orders list (what user sees)');
console.log('4. Verify all statuses are correct\n');
console.log('🎯 Goal: Escrow orders with funds_held payment should show "paid" status\n');

// Uncomment to run the test
// testCompleteEscrowFlow();

console.log('Script loaded. Update the config and uncomment the test call to run.');