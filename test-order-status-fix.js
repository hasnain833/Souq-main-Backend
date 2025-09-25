const mongoose = require('mongoose');
const Transaction = require('./db/models/transactionModel');
const StandardPayment = require('./db/models/standardPaymentModel');
const Order = require('./db/models/orderModel');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/souq', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function testOrderStatusFix() {
  try {
    const orderId = '68667c19dd844264ef0bffea';
    console.log('🔍 Testing order status fix for order:', orderId);

    // Try to find the order in different collections
    let order = null;
    let isTransaction = false;
    let isStandardPayment = false;

    // Try Order collection first
    order = await Order.findById(orderId);
    if (order) {
      console.log('✅ Found in Order collection:', {
        id: order._id,
        status: order.status,
        orderStatus: order.orderStatus
      });
    }

    // Try Transaction collection
    if (!order) {
      order = await Transaction.findById(orderId);
      if (order) {
        isTransaction = true;
        console.log('✅ Found in Transaction collection:', {
          id: order._id,
          status: order.status,
          orderStatus: order.orderStatus,
          buyer: order.buyer,
          seller: order.seller
        });
      }
    }

    // Try StandardPayment collection
    if (!order) {
      order = await StandardPayment.findById(orderId);
      if (order) {
        isStandardPayment = true;
        console.log('✅ Found in StandardPayment collection:', {
          id: order._id,
          status: order.status,
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
    let currentStatus = order.status;
    if (isTransaction || isStandardPayment) {
      if (order.orderStatus) {
        currentStatus = order.orderStatus;
        console.log('📋 Using orderStatus field:', currentStatus);
      } else {
        // Apply the new mapping logic
        if (order.status === 'completed' || order.status === 'paid') {
          currentStatus = 'paid';
        } else if (order.status === 'pending') {
          currentStatus = 'pending_payment';
        } else if (order.status === 'processing') {
          currentStatus = 'pending_payment'; // New logic
        } else {
          currentStatus = order.status === 'failed' || order.status === 'cancelled' ? 'cancelled' : 'pending_payment';
        }
        console.log('📋 Mapped payment status to order status:', order.status, '->', currentStatus);
      }
    }

    // Test the transition logic
    const targetStatus = 'shipped';
    const updatedBy = 'seller';

    console.log('🔄 Testing transition from', currentStatus, 'to', targetStatus);

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

    // Test special case logic
    if (currentStatus === 'pending_payment' && targetStatus === 'shipped' && updatedBy === 'seller') {
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

  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    mongoose.connection.close();
  }
}

testOrderStatusFix();
