/**
 * Quick verification script to test escrow order status after the fix
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000';

async function testEscrowOrdersAPI() {
  console.log('🧪 Testing Escrow Orders API After Fix\n');
  
  // Test data - replace with your actual token
  const accessToken = 'your_actual_jwt_token_here';
  
  console.log('📝 Testing orders list API for escrow payment status...');
  console.log('Expected: Orders with funds_held payment should show "paid" order status\n');

  try {
    // Test the orders list API
    const response = await axios.get(`${API_BASE_URL}/api/user/orders?role=buyer&limit=20`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data.success) {
      const orders = response.data.data.orders;
      
      console.log(`✅ SUCCESS: Retrieved ${orders.length} orders`);
      console.log('\n📊 Escrow Orders Analysis:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      // Find escrow orders
      const escrowOrders = orders.filter(order => order.type === 'escrow');
      
      if (escrowOrders.length > 0) {
        console.log(`🏦 Found ${escrowOrders.length} escrow orders:`);
        
        let fixedCount = 0;
        let stillNeedFixing = 0;
        
        escrowOrders.forEach((order, index) => {
          const paymentStatus = order.payment?.status;
          const orderStatus = order.status;
          const isFundsHeld = paymentStatus === 'funds_held';
          const isStatusCorrect = isFundsHeld && orderStatus === 'paid';
          
          console.log(`\n${index + 1}. 📋 Order: ${order.orderNumber}`);
          console.log(`   💳 Payment Status: ${paymentStatus}`);
          console.log(`   🏷️  Order Status: ${orderStatus}`);
          console.log(`   🔍 Order Type: ${order.type}`);
          
          if (isFundsHeld) {
            if (isStatusCorrect) {
              console.log(`   ✅ FIXED: Status correctly shows "paid" for funds_held payment`);
              fixedCount++;
            } else {
              console.log(`   ❌ STILL BROKEN: Shows "${orderStatus}" instead of "paid"`);
              stillNeedFixing++;
            }
          } else {
            console.log(`   ℹ️  INFO: Payment status is "${paymentStatus}" (not funds_held)`);
          }
        });
        
        console.log('\n📈 Summary:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`✅ Fixed orders (funds_held → paid): ${fixedCount}`);
        console.log(`❌ Still need fixing: ${stillNeedFixing}`);
        console.log(`📋 Total escrow orders: ${escrowOrders.length}`);
        
        if (stillNeedFixing > 0) {
          console.log('\n🔧 If orders still need fixing:');
          console.log('1. Make sure the backend server was restarted after the code changes');
          console.log('2. The database fix script should have updated the orderStatus field');
          console.log('3. Check server logs for any errors during API calls');
        } else if (fixedCount > 0) {
          console.log('\n🎉 SUCCESS: All escrow orders with funds_held payment now show "paid" status!');
          console.log('✅ The fix is working correctly');
        }
        
      } else {
        console.log('ℹ️  No escrow orders found in the current response');
        console.log('ℹ️  Try with a different user token or increase the limit parameter');
      }
      
    } else {
      console.log('❌ API returned success=false:', response.data);
    }

  } catch (error) {
    if (error.response) {
      console.log('❌ API Error:', {
        status: error.response.status,
        message: error.response.data?.error || error.response.data?.message || 'Unknown error'
      });
      
      if (error.response.status === 401) {
        console.log('\n🔍 401 Unauthorized:');
        console.log('Please update the accessToken variable with a valid JWT token');
        console.log('You can get this from your browser\'s localStorage or developer tools');
      }
    } else {
      console.log('❌ Network Error:', error.message);
      console.log('💡 Make sure the backend server is running on port 5000');
    }
  }
}

async function testSpecificOrder() {
  console.log('\n🎯 Testing Specific Order from User Report\n');
  
  const accessToken = 'your_actual_jwt_token_here';
  const specificOrderId = '68b03a162884f14f95332b85'; // From user's example
  
  console.log(`📝 Testing specific order: ${specificOrderId}`);
  console.log('This is the order mentioned in the user\'s issue report\n');

  try {
    const response = await axios.get(`${API_BASE_URL}/api/user/orders/${specificOrderId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data.success) {
      const order = response.data.data.order;
      
      console.log('✅ SUCCESS: Specific order details retrieved');
      console.log('\n📊 Order Analysis:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🆔 Order ID:', order._id);
      console.log('📋 Order Number:', order.orderNumber);
      console.log('🔗 Order Type:', order.type);
      console.log('🏷️  Order Status:', order.status);
      console.log('💳 Payment Method:', order.payment?.method);
      console.log('💰 Payment Status:', order.payment?.status);
      
      // Check if this matches the expected fix
      const isEscrow = order.type === 'escrow';
      const paymentStatus = order.payment?.status;
      const orderStatus = order.status;
      
      console.log('\n🔍 Fix Verification:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      if (isEscrow && paymentStatus === 'funds_held') {
        if (orderStatus === 'paid') {
          console.log('🎉 SUCCESS: The specific order from user report is now FIXED!');
          console.log('✅ Order status correctly shows "paid" for funds_held escrow payment');
          console.log('✅ The user should now see "paid" instead of "pending_payment"');
        } else {
          console.log('❌ ISSUE: Order status still shows "' + orderStatus + '" instead of "paid"');
          console.log('❌ This specific order still needs manual fixing');
        }
      } else {
        console.log('ℹ️  Order info:', {
          isEscrow,
          paymentStatus,
          orderStatus
        });
        console.log('ℹ️  This order may not be an escrow payment with funds_held status');
      }
      
    } else {
      console.log('❌ Failed to get specific order:', response.data);
    }

  } catch (error) {
    if (error.response) {
      console.log('❌ API Error:', {
        status: error.response.status,
        message: error.response.data?.error || 'Unknown error'
      });
    } else {
      console.log('❌ Network Error:', error.message);
    }
  }
}

console.log('🔧 Escrow Order Status Verification Script');
console.log('========================================\n');
console.log('This script verifies that the escrow order status fix is working correctly.\n');
console.log('⚠️  BEFORE RUNNING: Update the accessToken variables with valid JWT tokens\n');
console.log('💡 What this script tests:');
console.log('- Orders list API: /api/user/orders?role=buyer');
console.log('- Specific order API: /api/user/orders/{id}');
console.log('- Verifies escrow orders with funds_held payment show "paid" status\n');
console.log('🚀 Uncomment the lines below and run: node verify-escrow-fix.js\n');

// Uncomment these lines when you have valid credentials:
// testEscrowOrdersAPI();
// testSpecificOrder();

console.log('Script loaded. Update tokens and uncomment test calls to run verification.');