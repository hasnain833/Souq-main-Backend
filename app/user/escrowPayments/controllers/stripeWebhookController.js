// controllers/stripeWebhookController.js
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const EscrowPayment = require('../../../../db/models/EscrowPayment');
const Order = require('../../../../db/models/orderModel');
const Product = require('../../../../db/models/productModel');
const NotificationService = require('../../../../services/NotificationService');
const {
  calculatePlatformCommission,
  recordPlatformFeeUsage,
} = require('../../../../services/platformFee/PlatformFeeService');

// In-memory store for idempotency (use Redis in production)
const processedStripeEvents = new Set();

exports.handleStripeWebhook = async (req, res) => {
  let event;
  
  try {
    // Verify Stripe webhook signature
    const signature = req.headers['stripe-signature'];
    
    try {
      console.log("stripe webhook hit")
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        process.env.STRIPE_ESCROW_WEBHOOK_SECRET
      );
    } catch (err) {
      console.log('❌ Stripe webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log('🔔 Stripe Webhook Received:', {
      type: event.type,
      id: event.id
    });

    // Check for duplicate events
    if (processedStripeEvents.has(event.id)) {
      console.log(`⚡ Stripe event ${event.id} already processed, skipping`);
      return res.status(200).json({ received: true });
    }

    // Add to processed events
    processedStripeEvents.add(event.id);

    // Handle different event types
    let result;
    switch (event.type) {
      case 'payment_intent.succeeded':
        result = await handlePaymentIntentSucceeded(event);
        break;
      
      case 'payment_intent.amount_capturable_updated':  // ✅ CRITICAL FOR MANUAL CAPTURE
        result = await handlePaymentIntentAmountCapturableUpdated(event);
        break;
      
      case 'payment_intent.payment_failed':
        result = await handlePaymentIntentFailed(event);
        break;
      
      case 'payment_intent.canceled':
        result = await handlePaymentIntentCanceled(event);
        break;
      
      case 'charge.captured':
        result = await handleChargeCaptured(event);
        break;
      
      case 'charge.succeeded':  // ✅ ADDED
        result = await handleChargeSucceeded(event);
        break;
      
      case 'charge.refunded':
        result = await handleChargeRefunded(event);
        break;
      
      case 'payment_intent.created':  // ✅ ADDED FOR TRACKING
        result = await handlePaymentIntentCreated(event);
        break;
      
      default:
        console.log(`⚡ Unhandled Stripe event type: ${event.type}`);
        result = { processed: false, reason: 'unhandled_event_type' };
    }

    console.log(`✅ Stripe webhook processing completed for ${event.type}:`, result);
    res.status(200).json({ received: true, processed: result.processed });

  } catch (error) {
    console.error('❌ Stripe webhook processing error:', {
      error: error.message,
      event: event?.type,
      event_id: event?.id,
      stack: error.stack
    });
    
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

// ✅ FIXED: Pass the event parameter
async function handlePaymentIntentAmountCapturableUpdated(event) {
  const paymentIntent = event.data.object;
  const paymentIntentId = paymentIntent.id;
  
  console.log(`🔄 Processing payment_intent.amount_capturable_updated:`, {
    payment_intent: paymentIntentId,
    status: paymentIntent.status,
    amount: paymentIntent.amount,
    capture_method: paymentIntent.capture_method,
    metadata: paymentIntent.metadata
  });

  // This event means the payment is authorized and ready for capture (escrow hold)
  if (paymentIntent.capture_method === 'manual' || paymentIntent.metadata?.type === 'escrow') {
    console.log('✅ Manual capture escrow payment authorized, processing hold...');
    return await handleEscrowPaymentAuthorized(paymentIntent, event); // ✅ PASS EVENT PARAMETER
  }

  return { processed: false, reason: 'not_manual_escrow' };
}

async function handlePaymentIntentSucceeded(event) {
  const paymentIntent = event.data.object;
  const paymentIntentId = paymentIntent.id;
  
  console.log(`🔄 Processing payment_intent.succeeded:`, {
    payment_intent: paymentIntentId,
    status: paymentIntent.status,
    amount: paymentIntent.amount,
    capture_method: paymentIntent.capture_method,
    metadata: paymentIntent.metadata
  });

  // For manual capture escrow, this might not be called until we actually capture
  // But handle it if it does come through
  const isEscrowPayment = paymentIntent.capture_method === 'manual' || 
                         paymentIntent.metadata?.type === 'escrow';

  if (isEscrowPayment) {
    console.log('✅ Escrow payment succeeded (likely captured), processing...');
    return await handleEscrowPaymentAuthorized(paymentIntent, event); // ✅ PASS EVENT PARAMETER
  }

  return { processed: false, reason: 'not_escrow_payment' };
}

// ✅ FIXED: Accept event as second parameter
async function handleEscrowPaymentAuthorized(paymentIntent, event) { // ✅ ADD EVENT PARAMETER
  const session = await EscrowPayment.startSession();
  
  try {
    session.startTransaction();

    // Find escrow payment by stripePaymentIntentId
    const escrowPayment = await EscrowPayment.findOne({ 
      stripePaymentIntentId: paymentIntent.id 
    }).session(session);

    if (!escrowPayment) {
      console.error(`❌ Escrow payment not found for Stripe PI: ${paymentIntent.id}`);
      await session.abortTransaction();
      return { processed: false, error: 'escrow_not_found' };
    }

    // Check if already processed
    if (escrowPayment.status === 'held') {
      console.log(`⚡ Escrow payment already in 'held' status: ${escrowPayment._id}`);
      await session.abortTransaction();
      return { processed: false, reason: 'already_processed' };
    }

    console.log(`✅ Found escrow payment: ${escrowPayment._id}`);

    // Update escrow payment - matching your confirmStripeEscrowPayment logic
    escrowPayment.status = 'held';
    escrowPayment.paymentHeldAt = new Date();
    escrowPayment.stripePaymentIntentStatus = paymentIntent.status;
    
    // Calculate commission breakdown using current platform fee
    const feeInfo = await calculatePlatformCommission({
      amount: escrowPayment.totalAmount,
      currency: escrowPayment.currency || 'USD',
      categoryId: escrowPayment.product?.category,
      userId: escrowPayment.seller?._id,
    });
    const platformCommission = feeInfo.commissionAmount;
    const transactionFee = escrowPayment.totalAmount * 0.029 + 0.30; // Stripe fee approximation
    const netAmountToSeller = escrowPayment.totalAmount - platformCommission - transactionFee;
    const configId =
      escrowPayment.platformFeeConfig?.configId || feeInfo.configId;
    const feePercent =
      escrowPayment.platformFeeConfig?.percentage ||
      feeInfo.commissionPercentage;
    await recordPlatformFeeUsage({
      configId,
      feeAmount: platformCommission,
      feePercentage: feePercent,
    });

    escrowPayment.commission = platformCommission;
    escrowPayment.transactionFee = transactionFee;
    escrowPayment.netAmount = netAmountToSeller;
    
    // Add webhook event tracking - ✅ NOW event IS DEFINED
    escrowPayment.webhookEvents = escrowPayment.webhookEvents || [];
    escrowPayment.webhookEvents.push({
      eventType: event.type, // ✅ NOW event IS AVAILABLE
      eventId: event.id,     // ✅ NOW event IS AVAILABLE
      receivedAt: new Date(),
      processed: true
    });
    
    await escrowPayment.save({ session });

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
      // Generate unified transaction ID
      const { generateTransactionId } = require('../../../../utils/transactionUtils');
      const transactionId = generateTransactionId('TXN');
      
      const newOrder = await Order.create([{
        product: escrowPayment.product,
        buyer: escrowPayment.buyer,
        seller: escrowPayment.seller,
        buyerEmail: escrowPayment.buyerEmail,
        paymentMethod: 'Stripe Escrow',
        paymentStatus: 'Held in Escrow',
        orderStatus: 'Pending Delivery',
        totalAmount: escrowPayment.totalAmount,
        quantity: escrowPayment.productDetails.quantity,
        shipping: {
          toAddress: escrowPayment.shippingAddress,
        },
        payment: {
          method: 'Stripe Escrow',
          status: 'Held',
          transactionId: transactionId, // Unified transaction ID
          providerPaymentId: paymentIntent.id
        },
        currency: 'usd',
        escrowPayment: escrowPayment._id,
        paymentType: 'escrow',
        commissionBreakdown: {
          platformCommission: platformCommission,
          transactionFee: transactionFee,
          netAmountToSeller: netAmountToSeller,
          totalAmount: escrowPayment.totalAmount
        },
        escrowStatus: 'held'
      }], { session });
      await NotificationService.notifyOrderPlaced(newOrder[0]);
    } else {
      // If existing order doesn't have transactionId, update it (using updateOne to avoid validation errors)
      if (!existingOrder.payment?.transactionId) {
        const { generateTransactionId } = require('../../../../utils/transactionUtils');
        const transactionId = generateTransactionId('TXN');
        // Use updateOne to only update the transactionId field without triggering full validation
        await Order.updateOne(
          { _id: existingOrder._id },
          { $set: { 'payment.transactionId': transactionId } },
          { session }
        );
      }
    }

    await session.commitTransaction();
    console.log(`✅ Successfully processed Stripe escrow authorization for: ${paymentIntent.id}`);
    
    return { 
      processed: true, 
      message: 'Stripe escrow payment authorized and held via webhook',
      escrowId: escrowPayment._id,
      paymentIntentId: paymentIntent.id
    };
    
  } catch (error) {
    await session.abortTransaction();
    console.error('❌ Transaction failed for Stripe payment authorization:', error);
    throw error;
  } finally {
    session.endSession();
  }
}
// ✅ ADDED: Handler for payment intent created
async function handlePaymentIntentCreated(event) {
  const paymentIntent = event.data.object;
  console.log(`🔄 Payment Intent Created:`, {
    payment_intent: paymentIntent.id,
    status: paymentIntent.status,
    capture_method: paymentIntent.capture_method,
    metadata: paymentIntent.metadata
  });
  
  // Optional: You can update escrow payment with initial status
  try {
    const escrowPayment = await EscrowPayment.findOne({ 
      stripePaymentIntentId: paymentIntent.id 
    });
    
    if (escrowPayment) {
      escrowPayment.stripePaymentIntentStatus = paymentIntent.status;
      escrowPayment.webhookEvents = escrowPayment.webhookEvents || [];
      escrowPayment.webhookEvents.push({
        eventType: 'payment_intent.created',
        eventId: event.id,
        receivedAt: new Date(),
        processed: true
      });
      await escrowPayment.save();
      console.log(`✅ Updated escrow payment with created status: ${escrowPayment._id}`);
    }
  } catch (error) {
    console.error('Error updating escrow for payment_intent.created:', error);
  }
  
  return { processed: true, message: 'Payment intent creation logged' };
}

// ✅ ADDED: Handler for charge succeeded
async function handleChargeSucceeded(event) {
  const charge = event.data.object;
  console.log(`🔄 Charge Succeeded:`, {
    charge_id: charge.id,
    payment_intent: charge.payment_intent,
    amount: charge.amount,
    captured: charge.captured
  });
  
  // For manual capture, charge.succeeded happens when payment is authorized but not captured
  // We can log this but the main business logic is in amount_capturable_updated
  
  return { processed: true, message: 'Charge success logged' };
}

async function handlePaymentIntentFailed(event) {
  const paymentIntent = event.data.object;
  const paymentIntentId = paymentIntent.id;
  
  console.log(`🔄 Processing payment_intent.payment_failed: ${paymentIntentId}`);

  try {
    const escrowPayment = await EscrowPayment.findOneAndUpdate(
      { stripePaymentIntentId: paymentIntentId },
      {
        status: 'failed',
        stripePaymentIntentStatus: 'failed',
        failureReason: paymentIntent.last_payment_error?.message || 'Payment failed',
        webhookEvents: {
          $push: {
            eventType: 'payment_intent.payment_failed',
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
      
      // Update order status if exists
      await Order.findOneAndUpdate(
        { providerPaymentId: paymentIntentId },
        {
          paymentStatus: 'Failed',
          orderStatus: 'Cancelled',
          'payment.status': 'Failed'
        }
      );
      
      return { processed: true, message: 'Payment failure processed' };
    } else {
      console.error(`❌ Escrow payment not found for failed payment: ${paymentIntentId}`);
      return { processed: false, error: 'escrow_not_found' };
    }
    
  } catch (error) {
    console.error('❌ Error processing payment failure:', error);
    throw error;
  }
}

async function handlePaymentIntentCanceled(event) {
  const paymentIntent = event.data.object;
  const paymentIntentId = paymentIntent.id;
  
  console.log(`🔄 Processing payment_intent.canceled: ${paymentIntentId}`);

  try {
    const escrowPayment = await EscrowPayment.findOneAndUpdate(
      { stripePaymentIntentId: paymentIntentId },
      {
        status: 'cancelled',
        stripePaymentIntentStatus: 'canceled',
        cancelledAt: new Date(),
        webhookEvents: {
          $push: {
            eventType: 'payment_intent.canceled',
            eventId: event.id,
            receivedAt: new Date(),
            processed: true
          }
        }
      },
      { new: true }
    );

    if (escrowPayment) {
      console.log(`✅ Updated escrow payment to 'cancelled' for: ${escrowPayment._id}`);
      
      // Update order status
      await Order.findOneAndUpdate(
        { providerPaymentId: paymentIntentId },
        {
          paymentStatus: 'Cancelled',
          orderStatus: 'Cancelled',
          'payment.status': 'Cancelled'
        }
      );
      
      return { processed: true, message: 'Payment cancellation processed' };
    } else {
      console.error(`❌ Escrow payment not found for canceled payment: ${paymentIntentId}`);
      return { processed: false, error: 'escrow_not_found' };
    }
    
  } catch (error) {
    console.error('❌ Error processing payment cancellation:', error);
    throw error;
  }
}

async function handleChargeCaptured(event) {
  const charge = event.data.object;
  const paymentIntentId = charge.payment_intent;
  
  console.log(`🔄 Processing charge.captured for payment intent: ${paymentIntentId}`);

  try {
    const escrowPayment = await EscrowPayment.findOneAndUpdate(
      { stripePaymentIntentId: paymentIntentId },
      {
        status: 'released',
        releasedAt: new Date(),
        stripeCaptureId: charge.id,
        webhookEvents: {
          $push: {
            eventType: 'charge.captured',
            eventId: event.id,
            receivedAt: new Date(),
            processed: true
          }
        }
      },
      { new: true }
    );

    if (escrowPayment) {
      console.log(`✅ Updated escrow payment to 'released' for: ${escrowPayment._id}`);
      
      // Update order status
      await Order.findOneAndUpdate(
        { providerPaymentId: paymentIntentId },
        {
          paymentStatus: 'Completed',
          orderStatus: 'Completed',
          'payment.status': 'Completed',
          releasedAt: new Date()
        }
      );
      
      return { processed: true, message: 'Payment release processed' };
    } else {
      console.error(`❌ Escrow payment not found for captured charge: ${paymentIntentId}`);
      return { processed: false, error: 'escrow_not_found' };
    }
    
  } catch (error) {
    console.error('❌ Error processing charge capture:', error);
    throw error;
  }
}

async function handleChargeRefunded(event) {
  const charge = event.data.object;
  const paymentIntentId = charge.payment_intent;
  
  console.log(`🔄 Processing charge.refunded for payment intent: ${paymentIntentId}`);

  try {
    const escrowPayment = await EscrowPayment.findOneAndUpdate(
      { stripePaymentIntentId: paymentIntentId },
      {
        status: 'refunded',
        refundedAt: new Date(),
        webhookEvents: {
          $push: {
            eventType: 'charge.refunded',
            eventId: event.id,
            receivedAt: new Date(),
            processed: true
          }
        }
      },
      { new: true }
    );

    if (escrowPayment) {
      console.log(`✅ Updated escrow payment to 'refunded' for: ${escrowPayment._id}`);
      
      // Update order status
      await Order.findOneAndUpdate(
        { providerPaymentId: paymentIntentId },
        {
          paymentStatus: 'Refunded',
          orderStatus: 'Cancelled',
          'payment.status': 'Refunded'
        }
      );
      
      return { processed: true, message: 'Refund processed' };
    } else {
      console.error(`❌ Escrow payment not found for refunded charge: ${paymentIntentId}`);
      return { processed: false, error: 'escrow_not_found' };
    }
    
  } catch (error) {
    console.error('❌ Error processing refund:', error);
    throw error;
  }
}

// Update your existing confirmStripeEscrowPayment to handle webhook race conditions
exports.syncStripeEscrowStatus = async (paymentIntentId) => {
  try {
    console.log(`🔄 Syncing Stripe escrow status for PI: ${paymentIntentId}`);
    
    const escrowPayment = await EscrowPayment.findOne({ stripePaymentIntentId: paymentIntentId });
    if (!escrowPayment) {
      throw new Error('Escrow payment not found');
    }

    // If webhook already processed it, return current status
    if (escrowPayment.status === 'held') {
      console.log(`✅ Webhook already processed this Stripe payment`);
      return {
        success: true,
        alreadyProcessed: true,
        escrowPayment
      };
    }

    // If not processed by webhook yet
    return {
      success: true,
      waitingForWebhook: true,
      currentStatus: escrowPayment.status
    };

  } catch (error) {
    console.error('Error syncing Stripe escrow status:', error);
    throw error;
  }
};

// Utility function to clear processed events (for testing)
exports.clearStripeProcessedEvents = () => {
  processedStripeEvents.clear();
  console.log('✅ Cleared Stripe processed events cache');
};

// Get webhook status (for debugging)
exports.getStripeWebhookStatus = () => {
  return {
    processedEventsCount: processedStripeEvents.size,
    supportedEvents: [
      'payment_intent.succeeded',
      'payment_intent.amount_capturable_updated', // ✅ ADDED
      'payment_intent.payment_failed', 
      'payment_intent.canceled',
      'payment_intent.created', // ✅ ADDED
      'charge.captured',
      'charge.succeeded', // ✅ ADDED
      'charge.refunded'
    ]
  };
};

// Debug endpoint handler
exports.debugWebhook = async (req, res) => {
  console.log('🎯 ACTUAL WEBHOOK ENDPOINT HIT!');
  console.log('📝 Headers:', req.headers);
  console.log('🔧 Method:', req.method);
  console.log('📦 Body present:', !!req.body);
  
  res.json({ 
    message: 'Actual webhook endpoint is working',
    timestamp: new Date().toISOString(),
    method: req.method,
    headers: req.headers
  });
};