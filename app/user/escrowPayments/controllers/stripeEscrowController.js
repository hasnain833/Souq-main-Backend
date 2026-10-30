// controllers/stripeEscrowController.js
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const EscrowPayment = require('../../../../db/models/EscrowPayment');
const User = require('../../../../db/models/userModel');
const Product = require('../../../../db/models/productModel');
const Order = require('../../../../db/models/orderModel');
const NotificationService = require('../../../../services/NotificationService');
const {
  calculatePlatformCommission,
} = require('../../../../services/platformFee/PlatformFeeService');

exports.createStripeEscrowSession = async (req, res) => {
    console.log(" reached to stripe escrow session");
  try {
    const { productId, buyerEmail, prodQuantity, price, shippingAddress, userId } = req.body;
    
    const product = await Product.findById(productId).populate('user').exec();
    if (!product) return res.status(404).json({ error: 'Product not found' });
    
    if (!product.user.stripeAccountId) {
      return res.status(400).json({ error: 'Seller not onboarded to Stripe' });
    }

    const amount = Math.round(price * 100);
    const commissionInfo = await calculatePlatformCommission({
      amount: price,
      currency: product.currency || 'USD',
      categoryId: product.category || product.categoryId,
      userId: product.user?._id,
    });
    const commission = Math.min(amount, Math.round(commissionInfo.commissionAmount * 100));
    const netAmount = amount - commission;

    // Create Payment Intent with manual capture (escrow hold)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: product.currency || 'usd',
      payment_method_types: ['card'],
      capture_method: 'manual', // Don't capture immediately
      transfer_data: {
        destination: product.user.stripeAccountId,
      },
      application_fee_amount: commission, // Platform commission
      metadata: {
        productId: productId.toString(),
        buyerId: userId.toString(),
        sellerId: product.user._id.toString(),
        type: 'escrow'
      }
    });

    // Create escrow payment record
    const escrowPayment = new EscrowPayment({
      buyer: userId,
      seller: product.user._id,
      product: productId,
      totalAmount: price,
      commission: commission / 100,
      netAmount: netAmount / 100,
      paymentProvider: 'stripe',
      stripePaymentIntentId: paymentIntent.id,
      productDetails: {
        title: product.title,
        price: price,
        quantity: prodQuantity || 1
      },
      shippingAddress: shippingAddress,
      status: 'pending',
      platformFeeConfig: {
        configId: commissionInfo.configId,
        version: commissionInfo.configVersion,
        percentage: commissionInfo.commissionPercentage,
      }
    });

    await escrowPayment.save();

    res.json({
      clientSecret: paymentIntent.client_secret,
      escrowId: escrowPayment._id,
      paymentIntentId: paymentIntent.id
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.confirmStripeEscrowPayment = async (req, res) => {
  try {
    const { escrowId } = req.body;
    console.log("id found", escrowId)
    
    const escrowPayment = await EscrowPayment.findById(escrowId)
      .populate('buyer')
      .populate('seller')
      .populate('product');
      
    if (!escrowPayment) {
      return res.status(404).json({ error: 'Escrow payment not found' });
    }

    if (escrowPayment.status === 'held') {
      let order = await Order.findOne({escrowPayment:escrowId})
        .populate('product')
        .populate('buyer', 'userName email')
        .populate('seller', 'userName email');
      
      // If order exists but doesn't have transactionId, add it (using updateOne to avoid validation errors)
      if (order && !order.payment?.transactionId) {
        const { generateTransactionId } = require('../../../../utils/transactionUtils');
        const transactionId = generateTransactionId('TXN');
        
        // Use updateOne to only update the transactionId field without triggering full validation
        await Order.updateOne(
          { _id: order._id },
          { $set: { 'payment.transactionId': transactionId } }
        );
        
        // Reload order to get updated data
        order = await Order.findOne({escrowPayment:escrowId})
          .populate('product')
          .populate('buyer', 'userName email')
          .populate('seller', 'userName email');
      }
      
      return res.json({
        success: true,
        alreadyProcessed: true,
        message: 'Payment was already processed via webhook',
        escrowPayment,
        order
      });
    }

    // For escrow, we DON'T capture the payment yet - just authorize it
    // The payment is already authorized from the frontend, we just update status
    
    // Calculate commission breakdown using active platform fee
    const feeInfo = await calculatePlatformCommission({
      amount: escrowPayment.totalAmount,
      currency: escrowPayment.currency || 'USD',
      categoryId: escrowPayment.product?.category,
      userId: escrowPayment.seller?._id,
    });
    const platformCommission = feeInfo.commissionAmount;
    const transactionFee = escrowPayment.totalAmount * 0.029 + 0.30; // Stripe fee approximation
    const netAmountToSeller = escrowPayment.totalAmount - platformCommission - transactionFee;

    // Update escrow payment with commission details
    escrowPayment.commission = platformCommission;
    escrowPayment.transactionFee = transactionFee;
    escrowPayment.netAmount = netAmountToSeller;
    escrowPayment.status = 'held';
    escrowPayment.paymentHeldAt = new Date();
    await escrowPayment.save();

    const product = await Product.findById(escrowPayment.product._id);
      if (product) {
        if (product.quantity > 0) {
          product.quantity -= 1;
          
          // // Optional: Mark as out of stock if quantity reaches 0
          // if (product.quantity === 0) {
          //   product.status = 'sold out';
          // }
          
          await product.save();
          console.log(`Product quantity decreased. New quantity: ${product.quantity}`);
        } else {
          console.warn('Product quantity is already 0, cannot decrease further');
        }
      } else {
        console.error('Product not found for quantity update');
      }

    // Generate unified transaction ID
    const { generateTransactionId } = require('../../../../utils/transactionUtils');
    const transactionId = generateTransactionId('TXN');

    // Create order record with commission breakdown
    const order = await Order.create({
      product: escrowPayment.product._id,
      buyer: escrowPayment.buyer._id,
      seller: escrowPayment.seller._id,
      buyerEmail: escrowPayment.buyer.email,
      paymentMethod: 'Stripe Escrow',
      paymentStatus: 'Held in Escrow',
      orderStatus: 'Pending Delivery',
      totalAmount: escrowPayment.totalAmount,
      quantity: escrowPayment.productDetails.quantity,
      shipping: {
        toAddress: escrowPayment.shippingAddress,
        cost: {
          baseFee: escrowPayment.product.shipping_cost || 0
        }
      },
      payment: {
        method: 'Stripe Escrow',
        status: 'Held',
        transactionId: transactionId, // Unified transaction ID
        providerPaymentId: escrowPayment.stripePaymentIntentId
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
    });

    await NotificationService.notifyOrderPlaced(order);

    res.json({ 
      success: true,
      message: 'Payment held in escrow successfully', 
      escrowPayment,
      order,
      commissionBreakdown: {
        platformCommission,
        transactionFee, 
        netAmountToSeller,
        totalAmount: escrowPayment.totalAmount
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// FIXED: Actually capture the payment when releasing to seller
exports.releaseStripeEscrowPayment = async (req, res) => {
  try {
    const { escrowId } = req.body;
    console.log("Release request for escrow ID:", escrowId);
    const userId = req.user._id;

    const escrowPayment = await EscrowPayment.findOne({
      _id: escrowId,
      buyer: userId,
      status: 'held'
    }).populate('seller');

    if (!escrowPayment) {
      return res.status(404).json({ error: 'Escrow payment not found or not authorized' });
    }

    // Calculate final amounts (in cents for Stripe)
    const totalAmountCents = Math.round(escrowPayment.totalAmount * 100);
    let platformCommissionAmount =
      typeof escrowPayment.commission === 'number'
        ? escrowPayment.commission
        : (await calculatePlatformCommission({
            amount: escrowPayment.totalAmount,
            currency: escrowPayment.currency || 'USD',
            categoryId: escrowPayment.product?.category,
            userId: escrowPayment.seller?._id,
          })).commissionAmount;
    const platformCommission = Math.round(platformCommissionAmount * 100);
    const netAmountToSeller = totalAmountCents - platformCommission;

    console.log(`Capturing payment: ${escrowPayment.stripePaymentIntentId}`);
    console.log(`Amount: ${totalAmountCents}, Commission: ${platformCommission}, Seller Gets: ${netAmountToSeller}`);

    // ✅ ACTUALLY CAPTURE THE PAYMENT - This transfers funds to seller
    const paymentIntent = await stripe.paymentIntents.capture(
      escrowPayment.stripePaymentIntentId,
      {
        amount_to_capture: totalAmountCents,
        // For connected accounts with transfer_data, funds automatically go to seller
        // Platform commission is handled by application_fee_amount from original intent
      }
    );

    console.log('✅ Payment captured successfully:', paymentIntent.id);
    console.log('Payment Intent status:', paymentIntent.status);
    console.log('Amount captured:', paymentIntent.amount_captured);

    // Update escrow payment
    escrowPayment.status = 'released';
    escrowPayment.buyerApproved = true;
    escrowPayment.releasedAt = new Date();
    escrowPayment.commission = platformCommission / 100;
    escrowPayment.netAmount = netAmountToSeller / 100;
    escrowPayment.stripeCaptureId = paymentIntent.id;
    await escrowPayment.save();

    // Update order status
    await Order.findOneAndUpdate(
      { escrowPayment: escrowId },
      { 
        paymentStatus: 'Completed',
        orderStatus: 'Completed',
        escrowStatus: 'released',
        releasedAt: new Date(),
        'commissionBreakdown.platformCommission': platformCommission / 100,
        'commissionBreakdown.netAmountToSeller': netAmountToSeller / 100,
        'payment.providerPaymentId': paymentIntent.id
      }
    );

    // TODO: Send notification to seller about payment release
    console.log(`✅ Payment released to seller: ${escrowPayment.seller._id}, Amount: $${netAmountToSeller / 100}`);

    res.json({ 
      success: true,
      message: 'Payment released to seller successfully', 
      escrowPayment,
      commissionBreakdown: {
        platformCommission: platformCommission / 100,
        netAmountToSeller: netAmountToSeller / 100,
        totalAmount: escrowPayment.totalAmount
      },
      paymentIntent: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount_captured: paymentIntent.amount_captured / 100
      }
    });

  } catch (err) {
    console.error('❌ Error releasing payment:', err);
    
    // Handle specific Stripe errors
    if (err.type === 'StripeInvalidRequestError') {
      if (err.code === 'payment_intent_unexpected_state') {
        return res.status(400).json({ 
          success: false,
          error: 'Payment already captured or cancelled' 
        });
      }
      if (err.code === 'amount_to_capture_too_large') {
        return res.status(400).json({ 
          success: false,
          error: 'Cannot capture more than authorized amount' 
        });
      }
    }
    
    res.status(500).json({ 
      success: false,
      error: err.message,
      code: err.code 
    });
  }
};

// Add function to get escrow payment details
exports.getEscrowPaymentDetails = async (req, res) => {
  try {
    const { escrowId } = req.params;
    const userId = req.user._id;

    const escrowPayment = await EscrowPayment.findOne({
      _id: escrowId,
      $or: [{ buyer: userId }, { seller: userId }]
    })
    .populate('buyer', 'name email')
    .populate('seller', 'name email stripeAccountId')
    .populate('product', 'title images');

    if (!escrowPayment) {
      return res.status(404).json({ error: 'Escrow payment not found' });
    }

    // Get Stripe payment intent details for additional info
    let stripeDetails = null;
    try {
      stripeDetails = await stripe.paymentIntents.retrieve(escrowPayment.stripePaymentIntentId);
    } catch (stripeErr) {
      console.error('Error fetching Stripe details:', stripeErr);
    }

    res.json({
      success: true,
      escrowPayment,
      stripeDetails
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Add function to cancel escrow payment (if needed)
exports.cancelStripeEscrowPayment = async (req, res) => {
  try {
    const { escrowId } = req.body;
    const userId = req.user._id;

    const escrowPayment = await EscrowPayment.findOne({
      _id: escrowId,
      buyer: userId,
      status: 'held'
    });

    if (!escrowPayment) {
      return res.status(404).json({ error: 'Escrow payment not found or not authorized' });
    }

    // Cancel the payment intent in Stripe
    const cancelledPaymentIntent = await stripe.paymentIntents.cancel(
      escrowPayment.stripePaymentIntentId
    );

    // Update escrow payment
    escrowPayment.status = 'cancelled';
    escrowPayment.cancelledAt = new Date();
    await escrowPayment.save();

    // Update order status
    await Order.findOneAndUpdate(
      { escrowPayment: escrowId },
      { 
        paymentStatus: 'Cancelled',
        orderStatus: 'Cancelled',
        escrowStatus: 'cancelled'
      }
    );

    res.json({ 
      success: true,
      message: 'Escrow payment cancelled successfully',
      escrowPayment,
      paymentIntent: cancelledPaymentIntent
    });

  } catch (err) {
    console.error('Error cancelling payment:', err);
    res.status(500).json({ error: err.message });
  }
};