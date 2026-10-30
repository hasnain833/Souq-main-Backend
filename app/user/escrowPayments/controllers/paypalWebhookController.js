// controllers/paypalWebhookController.js
const mongoose = require('mongoose');
const EscrowPayment = require('../../../../db/models/EscrowPayment');
const Order = require('../../../../db/models/orderModel');
const Product = require('../../../../db/models/productModel');
const NotificationService = require('../../../../services/NotificationService');

// Webhook event types to handle
const SUPPORTED_EVENTS = {
  PAYMENT_CAPTURE_COMPLETED: 'PAYMENT.CAPTURE.COMPLETED',
  PAYMENT_CAPTURE_DENIED: 'PAYMENT.CAPTURE.DENIED',
  PAYMENT_CAPTURE_REFUNDED: 'PAYMENT.CAPTURE.REFUNDED',
  PAYMENT_CAPTURE_REVERSED: 'PAYMENT.CAPTURE.REVERSED',
  CHECKOUT_ORDER_APPROVED: 'CHECKOUT.ORDER.APPROVED',
  CHECKOUT_ORDER_COMPLETED: 'CHECKOUT.ORDER.COMPLETED',
  PAYMENT_CAPTURE_PENDING: 'PAYMENT.CAPTURE.PENDING'
};

// In-memory store for idempotency (use Redis in production)
const processedEvents = new Set();

exports.handlePaypalWebhook = async (req, res) => {
  let event;
  
  try {
    console.log('🔔 PayPal Webhook Received:', {
      headers: req.headers,
      body: req.body
    });

    event = req.body;

    // Validate required event fields
    if (!event.event_type || !event.id || !event.resource) {
      console.error('❌ Invalid webhook event structure');
      return res.status(400).json({ error: 'Invalid webhook event structure' });
    }

    // Check for duplicate events
    if (processedEvents.has(event.id)) {
      console.log(`⚡ Event ${event.id} already processed, skipping`);
      return res.status(200).json({ received: true, processed: false, reason: 'duplicate' });
    }

    // Add to processed events
    processedEvents.add(event.id);

    console.log(`🔄 Processing PayPal Webhook: ${event.event_type}`, {
      event_id: event.id,
      resource_type: event.resource_type
    });

    // Handle different event types
    let result;
    switch (event.event_type) {
      case SUPPORTED_EVENTS.PAYMENT_CAPTURE_COMPLETED:
        result = await handlePaymentCaptureCompleted(event);
        break;
      
      case SUPPORTED_EVENTS.PAYMENT_CAPTURE_PENDING:
        result = await handlePaymentCapturePending(event);
        break;
      
      case SUPPORTED_EVENTS.PAYMENT_CAPTURE_DENIED:
        result = await handlePaymentCaptureDenied(event);
        break;
      
      case SUPPORTED_EVENTS.PAYMENT_CAPTURE_REFUNDED:
        result = await handlePaymentCaptureRefunded(event);
        break;
      
      case SUPPORTED_EVENTS.PAYMENT_CAPTURE_REVERSED:
        result = await handlePaymentCaptureReversed(event);
        break;
      
      case SUPPORTED_EVENTS.CHECKOUT_ORDER_APPROVED:
        result = await handleCheckoutOrderApproved(event);
        break;
      
      case SUPPORTED_EVENTS.CHECKOUT_ORDER_COMPLETED:
        result = await handleCheckoutOrderCompleted(event);
        break;
      
      default:
        console.log(`⚡ Unhandled event type: ${event.event_type}`);
        result = { processed: false, reason: 'unhandled_event_type' };
    }

    console.log(`✅ Webhook processing completed for ${event.event_type}:`, result);
    res.status(200).json({ 
      received: true, 
      processed: result.processed,
      message: result.message || 'Webhook processed successfully'
    });

  } catch (error) {
    console.error('❌ Webhook processing error:', {
      error: error.message,
      event: event?.event_type,
      event_id: event?.id,
      stack: error.stack
    });
    
    // Still return 200 to PayPal to avoid retries
    res.status(200).json({ 
      received: true, 
      processed: false, 
      error: 'Webhook processing failed',
      message: error.message
    });
  }
};

async function handlePaymentCaptureCompleted(event) {
  const capture = event.resource;
  const captureId = capture.id;
  const orderId = capture.supplementary_data?.related_ids?.order_id;
  
  if (!orderId) {
    console.error('❌ No order ID found in capture event');
    return { processed: false, error: 'No order ID' };
  }

  console.log(`🔄 Processing payment capture completed:`, {
    capture_id: captureId,
    order_id: orderId,
    status: capture.status,
    amount: capture.amount
  });

  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();

    // Find escrow payment by paypalOrderId
    const escrowPayment = await EscrowPayment.findOne({ 
      paypalOrderId: orderId 
    }).session(session);

    if (!escrowPayment) {
      console.error(`❌ Escrow payment not found for PayPal order: ${orderId}`);
      await session.abortTransaction();
      return { processed: false, error: 'escrow_not_found' };
    }

    // Check if already processed
    if (escrowPayment.status === 'held') {
      console.log(`⚡ Escrow payment already in 'held' status: ${escrowPayment._id}`);
      await session.abortTransaction();
      return { processed: false, reason: 'already_processed' };
    }

    console.log(`✅ Found escrow payment: ${escrowPayment._id} for order: ${orderId}`);

    // Update escrow payment - matching your capturePaypalEscrowPayment logic
    escrowPayment.status = 'held';
    escrowPayment.paymentHeldAt = new Date();
    escrowPayment.paypalCaptureId = captureId;
    escrowPayment.paypalOrderStatus = capture.status;
    escrowPayment.captureDetails = capture;
    
    // Add webhook event tracking
    escrowPayment.webhookEvents = escrowPayment.webhookEvents || [];
    escrowPayment.webhookEvents.push({
      eventType: event.event_type,
      eventId: event.id,
      receivedAt: new Date(),
      processed: true
    });
    
    await escrowPayment.save({ session });
    console.log(`✅ Updated escrow payment status to 'held' for: ${escrowPayment._id}`);

    // Update product quantity - matching your existing logic
    if (escrowPayment.product) {
      const product = await Product.findById(escrowPayment.product).session(session);
      if (product) {
        if (product.quantity > 0) {
          product.quantity -= 1;
          console.log(`✅ Reduced product quantity for: ${product._id}, new quantity: ${product.quantity}`);
          
          if (product.quantity === 0) {
            product.status = 'sold out';
            console.log(`✅ Marked product as sold out: ${product._id}`);
          }
          await product.save({ session });
        } else {
          console.log(`⚠️ Product already out of stock: ${product._id}`);
        }
      } else {
        console.error(`❌ Product not found: ${escrowPayment.product}`);
      }
    }

    // Create order if doesn't exist - matching your existing order structure
    const existingOrder = await Order.findOne({ 
      escrowPayment: escrowPayment._id 
    }).session(session);
    
    if (!existingOrder) {
      const newOrder = await Order.create([{
        product: escrowPayment.product,
        buyer: escrowPayment.buyer,
        seller: escrowPayment.seller,
        buyerEmail: escrowPayment.buyerEmail,
        paymentMethod: 'PayPal Escrow',
        paymentStatus: 'Held in Escrow',
        orderStatus: 'Pending Delivery',
        totalAmount: escrowPayment.totalAmount,
        shipping: {
          toAddress: escrowPayment.shippingAddress,
        },
        payment: {
          method: 'PayPal Escrow',
          status: 'Held',
          captureId: captureId,
          amount: capture.amount?.value,
          currency: capture.amount?.currency_code
        },
        providerPaymentId: orderId,
        currency: capture.amount?.currency_code || 'USD',
        escrowPayment: escrowPayment._id,
        orderDate: new Date()
      }], { session });
      await NotificationService.notifyOrderPlaced(newOrder[0]);
      
      console.log(`✅ Order created via webhook: ${newOrder[0]._id} for escrow: ${escrowPayment._id}`);
    } else {
      console.log(`✅ Order already exists: ${existingOrder._id}`);
      
      // Update existing order if needed
      await Order.findOneAndUpdate(
        { _id: existingOrder._id },
        {
          paymentStatus: 'Held in Escrow',
          'payment.status': 'Held',
          'payment.captureId': captureId
        },
        { session }
      );
    }

    await session.commitTransaction();
    console.log(`✅ Successfully processed payment capture via webhook for order: ${orderId}`);
    
    return { 
      processed: true, 
      message: 'Payment captured and order created/updated successfully via webhook',
      escrowId: escrowPayment._id,
      orderId: orderId,
      captureId: captureId
    };
    
  } catch (error) {
    await session.abortTransaction();
    console.error('❌ Transaction failed for payment capture:', error);
    throw error;
  } finally {
    session.endSession();
  }
}

async function handlePaymentCapturePending(event) {
  const capture = event.resource;
  const orderId = capture.supplementary_data?.related_ids?.order_id;
  
  if (!orderId) {
    return { processed: false, error: 'No order ID' };
  }

  console.log(`🔄 Processing payment capture pending for order: ${orderId}`);

  try {
    const escrowPayment = await EscrowPayment.findOneAndUpdate(
      { paypalOrderId: orderId },
      {
        status: 'pending',
        paypalOrderStatus: 'PENDING',
        webhookEvents: {
          $push: {
            eventType: event.event_type,
            eventId: event.id,
            receivedAt: new Date(),
            processed: true
          }
        }
      },
      { new: true }
    );

    if (escrowPayment) {
      console.log(`✅ Updated escrow payment to 'pending' for: ${escrowPayment._id}`);
      return { processed: true, message: 'Payment pending status updated' };
    } else {
      console.error(`❌ Escrow payment not found for pending payment: ${orderId}`);
      return { processed: false, error: 'escrow_not_found' };
    }
    
  } catch (error) {
    console.error('❌ Error processing payment pending:', error);
    throw error;
  }
}

async function handlePaymentCaptureDenied(event) {
  const capture = event.resource;
  const orderId = capture.supplementary_data?.related_ids?.order_id;
  
  if (!orderId) {
    return { processed: false, error: 'No order ID' };
  }

  console.log(`🔄 Processing payment capture denied for order: ${orderId}`);

  try {
    const escrowPayment = await EscrowPayment.findOneAndUpdate(
      { paypalOrderId: orderId },
      {
        status: 'failed',
        paypalOrderStatus: 'DENIED',
        failureReason: 'Payment capture denied by PayPal',
        webhookEvents: {
          $push: {
            eventType: event.event_type,
            eventId: event.id,
            receivedAt: new Date(),
            processed: true
          }
        }
      },
      { new: true }
    );

    if (escrowPayment) {
      console.log(`✅ Updated escrow payment to 'failed' for: ${escrowPayment._id}`);
      
      // Also update order status if exists
      await Order.findOneAndUpdate(
        { providerPaymentId: orderId },
        {
          paymentStatus: 'Failed',
          orderStatus: 'Cancelled',
          'payment.status': 'Failed'
        }
      );
      
      return { processed: true, message: 'Payment denied processed' };
    } else {
      console.error(`❌ Escrow payment not found for denied payment: ${orderId}`);
      return { processed: false, error: 'escrow_not_found' };
    }
    
  } catch (error) {
    console.error('❌ Error processing payment denial:', error);
    throw error;
  }
}

async function handlePaymentCaptureRefunded(event) {
  const capture = event.resource;
  const orderId = capture.supplementary_data?.related_ids?.order_id;
  
  if (!orderId) {
    return { processed: false, error: 'No order ID' };
  }

  console.log(`🔄 Processing payment capture refunded for order: ${orderId}`);

  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();

    // Update escrow payment
    const escrowPayment = await EscrowPayment.findOneAndUpdate(
      { paypalOrderId: orderId },
      {
        status: 'refunded',
        paypalOrderStatus: 'REFUNDED',
        refundedAt: new Date(),
        webhookEvents: {
          $push: {
            eventType: event.event_type,
            eventId: event.id,
            receivedAt: new Date(),
            processed: true
          }
        }
      },
      { new: true, session }
    );

    if (!escrowPayment) {
      console.error(`❌ Escrow payment not found for refund: ${orderId}`);
      await session.abortTransaction();
      return { processed: false, error: 'escrow_not_found' };
    }

    console.log(`✅ Updated escrow payment to 'refunded' for: ${escrowPayment._id}`);

    // Update order status
    await Order.findOneAndUpdate(
      { providerPaymentId: orderId },
      {
        paymentStatus: 'Refunded',
        orderStatus: 'Cancelled',
        'payment.status': 'Refunded',
        refundedAt: new Date()
      },
      { session }
    );

    console.log(`✅ Updated order status to 'refunded' for payment: ${orderId}`);

    await session.commitTransaction();
    return { processed: true, message: 'Refund processed successfully' };
    
  } catch (error) {
    await session.abortTransaction();
    console.error('❌ Transaction failed for refund:', error);
    throw error;
  } finally {
    session.endSession();
  }
}

async function handlePaymentCaptureReversed(event) {
  const capture = event.resource;
  const orderId = capture.supplementary_data?.related_ids?.order_id;
  
  if (!orderId) {
    return { processed: false, error: 'No order ID' };
  }

  console.log(`🔄 Processing payment capture reversed for order: ${orderId}`);

  try {
    const escrowPayment = await EscrowPayment.findOneAndUpdate(
      { paypalOrderId: orderId },
      {
        status: 'reversed',
        paypalOrderStatus: 'REVERSED',
        reversedAt: new Date(),
        webhookEvents: {
          $push: {
            eventType: event.event_type,
            eventId: event.id,
            receivedAt: new Date(),
            processed: true
          }
        }
      },
      { new: true }
    );

    if (escrowPayment) {
      console.log(`✅ Updated escrow payment to 'reversed' for: ${escrowPayment._id}`);
      
      // Update order status
      await Order.findOneAndUpdate(
        { providerPaymentId: orderId },
        {
          paymentStatus: 'Reversed',
          orderStatus: 'Cancelled',
          'payment.status': 'Reversed'
        }
      );
      
      return { processed: true, message: 'Payment reversal processed' };
    } else {
      console.error(`❌ Escrow payment not found for reversal: ${orderId}`);
      return { processed: false, error: 'escrow_not_found' };
    }
    
  } catch (error) {
    console.error('❌ Error processing payment reversal:', error);
    throw error;
  }
}

async function handleCheckoutOrderApproved(event) {
  const order = event.resource;
  console.log(`✅ Checkout order approved: ${order.id}`);
  
  // Update escrow when order is approved (before capture)
  try {
    const escrowPayment = await EscrowPayment.findOneAndUpdate(
      { paypalOrderId: order.id },
      {
        paypalOrderStatus: 'APPROVED',
        webhookEvents: {
          $push: {
            eventType: event.event_type,
            eventId: event.id,
            receivedAt: new Date(),
            processed: true
          }
        }
      },
      { new: true }
    );

    if (escrowPayment) {
      console.log(`✅ Updated escrow payment to 'APPROVED' for: ${escrowPayment._id}`);
      return { processed: true, message: 'Order approval processed' };
    } else {
      console.log(`⚠️ No escrow payment found for approved order: ${order.id}`);
      return { processed: false, error: 'escrow_not_found' };
    }
  } catch (error) {
    console.error('❌ Error processing order approval:', error);
    return { processed: false, error: error.message };
  }
}

async function handleCheckoutOrderCompleted(event) {
  const order = event.resource;
  console.log(`✅ Checkout order completed: ${order.id}`);
  
  // This might be handled by PAYMENT.CAPTURE.COMPLETED in most cases
  return { processed: true, message: 'Order completion processed' };
}

// Update your existing capturePaypalEscrowPayment to handle webhook race conditions
exports.syncEscrowPaymentStatus = async (orderId) => {
  try {
    console.log(`🔄 Syncing escrow payment status for order: ${orderId}`);
    
    const escrowPayment = await EscrowPayment.findOne({ paypalOrderId: orderId });
    if (!escrowPayment) {
      throw new Error('Escrow payment not found');
    }

    // If webhook already processed it, return current status
    if (escrowPayment.status === 'held') {
      console.log(`✅ Webhook already processed this payment`);
      return {
        success: true,
        alreadyProcessed: true,
        escrowPayment
      };
    }

    // If not processed by webhook yet, you might want to manually process
    // or wait for webhook. For now, just return current status.
    return {
      success: true,
      waitingForWebhook: true,
      currentStatus: escrowPayment.status
    };

  } catch (error) {
    console.error('Error syncing escrow status:', error);
    throw error;
  }
};

// Utility function to clear processed events (for testing)
exports.clearProcessedEvents = () => {
  processedEvents.clear();
  console.log('✅ Cleared processed events cache');
};

// Get webhook status (for debugging)
exports.getWebhookStatus = () => {
  return {
    processedEventsCount: processedEvents.size,
    supportedEvents: Object.values(SUPPORTED_EVENTS)
  };
};