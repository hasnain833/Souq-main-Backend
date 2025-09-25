const mongoose = require('mongoose');
const Transaction = require('./db/models/transactionModel');
const StandardPayment = require('./db/models/standardPaymentModel');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/souq', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function testShippedStatusFix() {
  try {
    const orderId = '68667c19dd844264ef0bffea';
    console.log('🔍 Testing shipped status fix for order:', orderId);

    // Try to find the order in different collections
    let order = null;
    let isTransaction = false;
    let isStandardPayment = false;

    // Try Transaction collection
    order = await Transaction.findById(orderId);
    if (order) {
      isTransaction = true;
      console.log('✅ Found in Transaction collection:', {
        id: order._id,
        paymentStatus: order.status,
        orderStatus: order.orderStatus,
        buyer: order.buyer,
        seller: order.seller
      });
    }

    // Try StandardPayment collection
    if (!order) {
      order = await StandardPayment.findById(orderId);
      if (order) {
        isStandardPayment = true;
        console.log('✅ Found in StandardPayment collection:', {
          id: order._id,
          paymentStatus: order.status,
          orderStatus: order.orderStatus,
          buyer: order.buyer,
          seller: order.seller
        });
      }
    }

    if (!order) {
      console.log('❌ Order not found in any collection');
      return;
    }

    // Test the status mapping logic
    function mapPaymentStatusToOrderStatus(paymentStatus) {
      const statusMap = {
        'completed': 'paid',
        'paid': 'paid',
        'pending': 'pending_payment',
        'processing': 'pending_payment', // Payment being processed, order still pending
        'failed': 'cancelled',
        'cancelled': 'cancelled'
      };
      return statusMap[paymentStatus] || 'pending_payment';
    }

    let currentStatus = order.orderStatus || mapPaymentStatusToOrderStatus(order.status);
    console.log('📋 Current order status:', currentStatus, '(mapped from payment status:', order.status + ')');

    // Test transition validation
    const targetStatus = 'shipped';
    
    console.log('🔄 Testing transition from', currentStatus, 'to', targetStatus);

    // Check if trying to transition to the same status
    if (currentStatus === targetStatus) {
      console.log('❌ Cannot transition to same status:', { currentStatus, targetStatus });
      console.log('✅ Duplicate status transition validation works!');
      return;
    }

    // Valid transitions
    const validTransitions = {
      'pending_payment': ['paid', 'cancelled'],
      'paid': ['processing', 'shipped', 'cancelled'],
      'processing': ['shipped', 'cancelled'],
      'shipped': ['in_transit', 'delivered'],
      'in_transit': ['out_for_delivery', 'delivered'],
      'out_for_delivery': ['delivered'],
      'delivered': ['returned'],
      'cancelled': [],
      'returned': [],
      'refunded': []
    };

    // Test special case logic for processing payments
    if (currentStatus === 'pending_payment' && targetStatus === 'shipped') {
      if ((isTransaction || isStandardPayment) && (order.status === 'completed' || order.status === 'processing')) {
        console.log('✅ Special case: Auto-transitioning completed/processing payment from pending_payment to shipped');
        currentStatus = 'paid'; // Treat as paid for transition validation
      }
    }

    // Check if transition is valid
    if (validTransitions[currentStatus]?.includes(targetStatus)) {
      console.log('✅ Transition is valid:', currentStatus, '->', targetStatus);
    } else {
      console.log('❌ Invalid transition:', currentStatus, '->', targetStatus);
      console.log('Valid transitions from', currentStatus, ':', validTransitions[currentStatus]);
    }

    // Test frontend button logic
    console.log('\n🖥️ Frontend button visibility test:');
    const orderStatusForFrontend = currentStatus;
    
    // Original logic: order.status === 'processing'
    const shouldShowButtonOld = orderStatusForFrontend === 'processing';
    console.log('Old logic (show if processing):', shouldShowButtonOld);
    
    // New logic: (order.status === 'processing' || order.status === 'paid') && order.status !== 'shipped'
    const shouldShowButtonNew = (orderStatusForFrontend === 'processing' || orderStatusForFrontend === 'paid') && orderStatusForFrontend !== 'shipped';
    console.log('New logic (show if processing/paid but not shipped):', shouldShowButtonNew);

    if (orderStatusForFrontend === 'shipped') {
      console.log('✅ Button correctly hidden for shipped orders');
    } else {
      console.log('ℹ️ Button visibility depends on order status');
    }

  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    mongoose.connection.close();
  }
}

testShippedStatusFix();
