const mongoose = require('mongoose');
const EscrowTransaction = require('../../../../db/models/escrowTransactionModel');
const Transaction = require('../../../../db/models/transactionModel');
const PlatformFee = require('../../../../db/models/platformFeeModel');
const Product = require('../../../../db/models/productModel');
const User = require('../../../../db/models/userModel');
const Offer = require('../../../../db/models/offerModel');
const Chat = require('../../../../db/models/chatModel');
const paymentGatewayFactory = require('../../../../services/payment/PaymentGatewayFactory');
const currencyService = require('../../../../services/currency/CurrencyService');
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');
const { creditWalletInternal } = require('../../wallet/controllers/walletController');

/**
 * Get available payment gateways
 */
exports.getAvailablePaymentGateways = async (req, res) => {
  try {
    console.log('🔍 Getting available payment gateways...');

    const availableGateways = paymentGatewayFactory.getAllGateways();
    const gatewayInfo = availableGateways.map(gateway => {
      const config = gateway.getGatewayConfig();
      return {
        id: config.gatewayName,
        name: config.displayName,
        displayName: config.displayName,
        supportedCurrencies: config.supportedCurrencies,
        supportedPaymentMethods: config.supportedPaymentMethods,
        isConfigured: config.isConfigured
      };
    });

    console.log('✅ Available payment gateways:', gatewayInfo.map(g => g.name));

    return res.status(200).json({
      success: true,
      data: gatewayInfo
    });

  } catch (error) {
    console.error('❌ Error getting payment gateways:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get available payment gateways'
    });
  }
};

/**
 * Create escrow transaction
 */
exports.createEscrowTransaction = async (req, res) => {
  try {
    console.log('🚀 Escrow create request started');
    console.log('📋 Request body:', JSON.stringify(req.body, null, 2));
    console.log('👤 User:', req.user ? req.user._id : 'No user');
    console.log('🔍 Starting escrow transaction creation...');

    const {
      productId,
      offerId,
      paymentGateway,
      shippingAddress,
      shippingCost: requestShippingCost,
      gatewayFeePaidBy = 'buyer',
      currency = 'USD',
      paymentSummary
    } = req.body;

    const buyerId = req.user._id;

    console.log('Extracted data:', {
      productId,
      offerId,
      paymentGateway,
      shippingAddress,
      gatewayFeePaidBy,
      currency,
      buyerId,
      paymentSummary
    });

    // Validate required fields
    console.log('✅ Step 1: Validating required fields...');
    if (!productId || !paymentGateway) {
      console.log('❌ Validation failed - missing productId or paymentGateway');
      return errorResponse(res, 'Product ID and payment gateway are required', 400);
    }
    console.log('✅ Required fields validation passed');

    // Validate currency
    console.log('✅ Step 2: Validating currency...');
    if (!currencyService.isCurrencySupported(currency)) {
      console.log('❌ Currency not supported:', currency);
      return errorResponse(res, 'Currency not supported', 400);
    }
    console.log('✅ Currency validation passed:', currency);

    // Get product details
    console.log('✅ Step 3: Fetching product details...');
    const product = await Product.findById(productId).populate('user', 'firstName lastName email');
    if (!product) {
      console.log('❌ Product not found:', productId);
      return errorResponse(res, 'Product not found', 404);
    }
    console.log('✅ Product found:', { id: product._id, title: product.title, price: product.price, status: product.status });

    // Prevent purchasing non-active products
    if (product.status && product.status !== 'active') {
      return errorResponse(res, `Product is not available for purchase (status: ${product.status})`, 400);
    }

    const sellerId = product.user._id;

    // Check if buyer is not the seller
    if (buyerId.toString() === sellerId.toString()) {
      return errorResponse(res, 'Cannot purchase your own product', 400);
    }

    let finalPrice = product.price;
    let offerDoc = null;
    let chatDoc = null;

    // If offer is provided, validate and get offer details
    if (offerId) {
      offerDoc = await Offer.findById(offerId).populate('chat');
      if (!offerDoc) {
        return errorResponse(res, 'Offer not found', 404);
      }

      if (offerDoc.status !== 'accepted') {
        return errorResponse(res, 'Offer must be accepted before creating escrow transaction', 400);
      }

      if (offerDoc.buyer.toString() !== buyerId.toString()) {
        return errorResponse(res, 'Unauthorized to use this offer', 403);
      }

      finalPrice = offerDoc.offerAmount;
      chatDoc = offerDoc.chat;
    } else {
      // For direct purchase, find or create chat
      const existingChat = await Chat.findOne({
        product: productId,
        buyer: buyerId,
        seller: sellerId
      });

      if (existingChat) {
        chatDoc = existingChat;
      }
    }

    // Get platform fee configuration
    const platformFeeConfig = await PlatformFee.getActiveFeeStructure();
    if (!platformFeeConfig) {
      return errorResponse(res, 'Platform fee configuration not found', 500);
    }

    // Auto-update currency rates
    await currencyService.autoUpdate();

    // Convert price to requested currency if needed
    let convertedPrice = finalPrice;
    let originalCurrency = null;
    let exchangeRate = 1.0;
    let exchangeRateDate = new Date();

    if (currency !== 'USD') {
      const conversion = currencyService.convertCurrency(finalPrice, 'USD', currency);
      if (conversion.success) {
        originalCurrency = 'USD';
        convertedPrice = conversion.convertedAmount;
        exchangeRate = conversion.exchangeRate;
        exchangeRateDate = conversion.lastUpdated;
      } else {
        return errorResponse(res, 'Currency conversion failed', 400);
      }
    }

    // Calculate fees in the requested currency
    console.log('Platform fee calculation inputs:', {
      convertedPrice,
      currency,
      productCategory: product.category,
      sellerId
    });

    const feeCalculation = platformFeeConfig.calculateFee(
      convertedPrice,
      currency,
      product.category,
      sellerId
    );

    console.log('Platform fee calculation result:', feeCalculation);

    // Use shipping cost from request (selected by user) or fallback to product default
    const shippingCost = requestShippingCost !== undefined ? requestShippingCost : (product.shipping_cost || 0);
    console.log('Shipping cost calculation:', {
      requestShippingCost,
      productShippingCost: product.shipping_cost,
      finalShippingCost: shippingCost
    });

    // Compute buyer subtotal based on Payment Summary: product + platform fee + shipping + sales tax
    const salesTaxAmount = Number(paymentSummary?.salesTax) || 0;
    const buyerSubtotal = convertedPrice + feeCalculation.feeAmount + shippingCost + salesTaxAmount;
    
    // Use the frontend payment summary total if provided and valid, otherwise use server calculation
    let totalAmount = buyerSubtotal;
    if (paymentSummary?.totalAmount && typeof paymentSummary.totalAmount === 'number' && paymentSummary.totalAmount > 0) {
      // Validate that the frontend total is reasonable (within 10% of server calculation)
      const serverTotal = buyerSubtotal;
      const frontendTotal = Number(paymentSummary.totalAmount);
      const difference = Math.abs(frontendTotal - serverTotal);
      const percentageDiff = (difference / serverTotal) * 100;
      
      if (percentageDiff <= 10) {
        console.log('✅ Using frontend payment summary total:', frontendTotal);
        totalAmount = frontendTotal;
      } else {
        console.warn('⚠️ Frontend total differs significantly from server calculation, using server total');
        console.warn('Server total:', serverTotal, 'Frontend total:', frontendTotal, 'Difference:', percentageDiff.toFixed(2) + '%');
      }
    }

    // Get payment gateway and calculate gateway fee
    console.log('🔍 Checking payment gateway:', paymentGateway);
    console.log('🔍 Available gateways:', paymentGatewayFactory.getAllGateways().map(g => g.getGatewayConfig().gatewayName));

    const gateway = paymentGatewayFactory.getGateway(paymentGateway);
    if (!gateway) {
      console.error('❌ Payment gateway not available:', paymentGateway);
      const availableGateways = paymentGatewayFactory.getAllGateways().map(g => g.getGatewayConfig().gatewayName);
      return errorResponse(res, `Payment gateway '${paymentGateway}' is not available. Available gateways: ${availableGateways.join(', ')}`, 400);
    }

    console.log('✅ Payment gateway found:', gateway.getGatewayConfig().displayName);

    // Check if gateway supports the currency (with special handling for PayTabs)
    const gatewayConfig = gateway.getGatewayConfig();
    const supportsCurrency = gateway.isCurrencySupported(currency);

    if (!supportsCurrency) {
      if (paymentGateway === 'paytabs' && currency === 'USD') {
        console.log('⚠️ PayTabs doesn\'t support USD, but will convert to AED during payment initialization');
      } else {
        console.error(`❌ Gateway ${paymentGateway} doesn't support currency ${currency}`);
        console.error(`Supported currencies:`, gatewayConfig.supportedCurrencies);
        return errorResponse(res, `Payment gateway ${paymentGateway} does not support ${currency}. Supported currencies: ${gatewayConfig.supportedCurrencies.join(', ')}`, 400);
      }
    }

    const gatewayFeeAmount = gateway.calculateGatewayFee(totalAmount, currency);

    // Calculate seller payout
    let sellerPayout = convertedPrice - feeCalculation.feeAmount;
    if (gatewayFeePaidBy === 'seller') {
      sellerPayout -= gatewayFeeAmount;
    }
    sellerPayout = Math.max(0, sellerPayout); // Ensure not negative

    console.log('Escrow calculation details:', {
      convertedPrice,
      platformFeeAmount: feeCalculation.feeAmount,
      gatewayFeeAmount,
      gatewayFeePaidBy,
      sellerPayout
    });

    // Map and validate shipping address
    console.log('✅ Step 7: Processing shipping address...');
    console.log('Raw shipping address:', shippingAddress);

    if (!shippingAddress || !shippingAddress.fullName || !shippingAddress.street1 ||
        !shippingAddress.city || !shippingAddress.country) {
      console.log('❌ Shipping address validation failed');
      return errorResponse(res, 'Complete shipping address is required', 400);
    }

    // Ensure proper field mapping for the escrow transaction
    const mappedShippingAddress = {
      fullName: shippingAddress.fullName,
      street1: shippingAddress.street1,
      street2: shippingAddress.street2 || '',
      city: shippingAddress.city,
      state: shippingAddress.state || '',
      zipCode: shippingAddress.zipCode,
      country: shippingAddress.country,
      phoneNumber: shippingAddress.phoneNumber || ''
    };

    console.log('✅ Mapped shipping address:', mappedShippingAddress);

    // Create escrow transaction
    const escrowTransaction = new EscrowTransaction({
      buyer: buyerId,
      seller: sellerId,
      product: productId,
      offer: offerId || null,
      chat: chatDoc?._id || null,
      productPrice: convertedPrice,
      shippingCost: shippingCost,
      // Always use server-computed total; never trust client total
      totalAmount: totalAmount,
      platformFeePercentage: feeCalculation.feePercentage,
      platformFeeAmount: feeCalculation.feeAmount,
      gatewayFeeAmount: gatewayFeeAmount,
      gatewayFeePaidBy: gatewayFeePaidBy,
      sellerPayout: sellerPayout,
      paymentGateway: paymentGateway,
      currency: currency,
      originalCurrency: originalCurrency,
      originalAmount: originalCurrency ? finalPrice : null,
      exchangeRate: exchangeRate,
      exchangeRateDate: exchangeRateDate,
      shippingAddress: mappedShippingAddress,
      // Store payment summary for display purposes (sanitized)
      paymentSummary: {
        productPrice: paymentSummary?.productPrice ?? convertedPrice,
        platformFee: paymentSummary?.platformFee ?? feeCalculation.feeAmount,
        shippingCost: paymentSummary?.shippingCost ?? shippingCost,
        salesTax: paymentSummary?.salesTax ?? 0,
        // If seller pays, show 0 processing fee to buyer
          processingFee: gatewayFeePaidBy === 'buyer' ? Math.round((paymentSummary?.processingFee ?? gatewayFeeAmount) * 100) / 100 : 0,
        // processingFee: gatewayFeePaidBy === 'buyer' ? (paymentSummary?.processingFee ?? gatewayFeeAmount) : 0,
        // Always reflect the server-computed total (buyer amount before any gateway fee added by buyer)
        totalAmount: totalAmount,
        currency: paymentSummary?.currency ?? currency,
        exchangeRate: paymentSummary?.exchangeRate ?? (exchangeRate || 1)
      }
    });

    console.log('Escrow transaction before save:', {
      buyer: escrowTransaction.buyer,
      seller: escrowTransaction.seller,
      product: escrowTransaction.product,
      productPrice: escrowTransaction.productPrice,
      totalAmount: escrowTransaction.totalAmount,
      platformFeeAmount: escrowTransaction.platformFeeAmount,
      sellerPayout: escrowTransaction.sellerPayout,
      paymentGateway: escrowTransaction.paymentGateway,
      currency: escrowTransaction.currency,
      shippingAddress: escrowTransaction.shippingAddress
    });

    await escrowTransaction.save();
    console.log('Escrow transaction saved successfully with ID:', escrowTransaction._id);

    // Populate the response
    await escrowTransaction.populate([
      { path: 'buyer', select: 'firstName lastName email' },
      { path: 'seller', select: 'firstName lastName email' },
      { path: 'product', select: 'title price product_photos' }
    ]);

    return successResponse(res, 'Escrow transaction created successfully', {
      escrowTransaction,
      nextStep: 'initialize_payment',
      status: "Done"
    }, 201);

  } catch (error) {
    console.error('❌ Create escrow transaction error:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Request body:', req.body);
    console.error('❌ User ID:', req.user?._id);
    return errorResponse(res, 'Failed to create escrow transaction', 500);
  }
};

/**
 * Initialize payment for escrow transaction
 */
exports.initializePayment = async (req, res) => {
  try {
    console.log('🔄 Initialize payment request received');
    const { escrowTransactionId } = req.params;
    const { returnUrl, cancelUrl } = req.body;

    console.log('Payment initialization params:', {
      escrowTransactionId,
      returnUrl,
      cancelUrl,
      userId: req.user._id
    });

    const buyerId = req.user._id;

    // Get escrow transaction
    const escrowTransaction = await EscrowTransaction.findById(escrowTransactionId)
      .populate('buyer', 'firstName lastName email phone')
      .populate('seller', 'firstName lastName email')
      .populate('product', 'title description');

    if (!escrowTransaction) {
      console.error('❌ Escrow transaction not found:', escrowTransactionId);
      return errorResponse(res, 'Escrow transaction not found', 404);
    }

    console.log('✅ Escrow transaction found:', {
      id: escrowTransaction._id,
      status: escrowTransaction.status,
      paymentGateway: escrowTransaction.paymentGateway,
      totalAmount: escrowTransaction.totalAmount,
      currency: escrowTransaction.currency
    });

    // Verify buyer
    if (escrowTransaction.buyer._id.toString() !== buyerId.toString()) {
      return errorResponse(res, 'Unauthorized access to this transaction', 403);
    }

    // Check transaction status
    if (escrowTransaction.status !== 'pending_payment') {
      return errorResponse(res, 'Transaction is not in pending payment status', 400);
    }

    // Get payment gateway
    console.log('Getting payment gateway:', escrowTransaction.paymentGateway);
    const gateway = paymentGatewayFactory.getGateway(escrowTransaction.paymentGateway);
    if (!gateway) {
      console.error('❌ Payment gateway not available:', escrowTransaction.paymentGateway);
      return errorResponse(res, 'Payment gateway not available', 400);
    }
    console.log('✅ Payment gateway found:', escrowTransaction.paymentGateway);

    // Calculate final amount for payment
    // Note: escrowTransaction.totalAmount should already include gateway fee if buyer pays it
    // Check if the stored total already includes gateway fee by comparing with base amount
    const baseAmount = escrowTransaction.productPrice + escrowTransaction.platformFeeAmount + 
                      escrowTransaction.shippingCost + (escrowTransaction.paymentSummary?.salesTax || 0);
    
    let paymentAmount = escrowTransaction.totalAmount;
    
    // If the stored total doesn't include gateway fee but buyer should pay it, add it
    if (escrowTransaction.gatewayFeePaidBy === 'buyer') {
      const expectedTotalWithFee = baseAmount + escrowTransaction.gatewayFeeAmount;
      const tolerance = 0.01; // 1 cent tolerance for rounding
      
      if (Math.abs(escrowTransaction.totalAmount - baseAmount) < tolerance) {
        // Total doesn't include gateway fee, add it
        paymentAmount += escrowTransaction.gatewayFeeAmount;
        console.log('💰 Adding gateway fee to payment amount:', escrowTransaction.gatewayFeeAmount);
      } else if (Math.abs(escrowTransaction.totalAmount - expectedTotalWithFee) < tolerance) {
        // Total already includes gateway fee, use as is
        console.log('✅ Payment amount already includes gateway fee');
      } else {
        console.warn('⚠️ Unexpected total amount, using stored value:', escrowTransaction.totalAmount);
      }
    }
    
    console.log('💰 Final payment calculation:', {
      baseAmount: baseAmount,
      storedTotal: escrowTransaction.totalAmount,
      gatewayFee: escrowTransaction.gatewayFeeAmount,
      gatewayFeePaidBy: escrowTransaction.gatewayFeePaidBy,
      finalPaymentAmount: paymentAmount
    });

    // Handle currency conversion for PayTabs
    let finalCurrency = escrowTransaction.currency;
    let finalAmount = paymentAmount;

    console.log('🔍 Payment gateway check:', {
      paymentGateway: escrowTransaction.paymentGateway,
      paymentGatewayType: typeof escrowTransaction.paymentGateway,
      originalCurrency: escrowTransaction.currency,
      originalAmount: paymentAmount,
      comparison: escrowTransaction.paymentGateway === 'paytabs'
    });

    if (escrowTransaction.paymentGateway === 'paytabs') {
      console.log('🔄 PayTabs detected - checking server status and currency support');

      // Check PayTabs server status first (temporarily disabled)
      // const serverStatus = await gateway.checkServerHealth();
      // console.log('🔍 PayTabs server status:', serverStatus);

      // if (!serverStatus.success && serverStatus.isServerError) {
      //   console.error('❌ PayTabs servers are down, cannot process escrow payment');
      //   return errorResponse(res,
      //     'PayTabs payment service is temporarily unavailable. Please try Stripe or PayPal, or try again later.',
      //     503
      //   );
      // }

      console.log('⚠️ PayTabs health check disabled - attempting payment with retry logic');

      const gatewayConfig = gateway.getGatewayConfig();
      console.log('🔍 PayTabs supported currencies:', gatewayConfig.supportedCurrencies);
      console.log('🔍 Transaction currency:', escrowTransaction.currency);

      if (!gatewayConfig.supportedCurrencies.includes(escrowTransaction.currency)) {
        console.log(`⚠️ PayTabs doesn't support ${escrowTransaction.currency}, converting to SAR`);

        // Auto-update currency rates
        await currencyService.autoUpdate();

        // Convert to SAR for PayTabs using currency service
        const conversion = currencyService.convertCurrency(
          paymentAmount,
          escrowTransaction.currency,
          'SAR'
        );

        console.log('💱 Currency conversion result:', conversion);

        if (conversion.success) {
          finalCurrency = 'SAR';
          finalAmount = conversion.convertedAmount;

          console.log('✅ Currency conversion successful:', {
            originalCurrency: escrowTransaction.currency,
            originalAmount: paymentAmount,
            finalCurrency: finalCurrency,
            finalAmount: finalAmount,
            exchangeRate: conversion.exchangeRate,
            lastUpdated: conversion.lastUpdated
          });
        } else {
          console.error('❌ Currency conversion failed:', conversion.error);
          return errorResponse(res, `Currency conversion failed: ${conversion.error}`, 400);
        }
      } else {
        console.log('✅ PayTabs supports the currency:', escrowTransaction.currency);
      }
    } else {
      console.log('ℹ️ Not PayTabs gateway, no currency conversion needed');
    }

    // Prepare payment data
    const paymentData = {
      amount: finalAmount,
      currency: finalCurrency,
      orderId: escrowTransaction.transactionId,
      description: `Purchase of ${escrowTransaction.product.title}`,
      customerName: `${escrowTransaction.buyer.firstName} ${escrowTransaction.buyer.lastName}`,
      customerEmail: escrowTransaction.buyer.email,
      customerPhone: escrowTransaction.buyer.phone,
      returnUrl: returnUrl,
      cancelUrl: cancelUrl,
      callbackUrl: `${process.env.BASE_URL}/api/user/escrow/webhook/${escrowTransaction.paymentGateway}`,
      escrowTransactionId: escrowTransaction._id.toString(),
      buyerId: escrowTransaction.buyer._id.toString(),
      sellerId: escrowTransaction.seller._id.toString(),
      productId: escrowTransaction.product._id.toString(),
      originalCurrency: escrowTransaction.currency,
      originalAmount: paymentAmount
    };

    // Initialize payment
    console.log('🔄 Initializing payment with gateway:', escrowTransaction.paymentGateway);
    console.log('Payment data:', paymentData);

    const paymentResult = await gateway.initializePayment(paymentData);
    console.log('Payment gateway result:', paymentResult);

    if (paymentResult.success) {
      console.log('✅ Payment initialization successful');

      // Update escrow transaction
      escrowTransaction.status = 'payment_processing';
      escrowTransaction.gatewayTransactionId = paymentResult.transactionId;
      escrowTransaction.gatewayResponse = paymentResult.gatewayResponse;
      await escrowTransaction.save();

      // Create transaction record for payment tracking
      console.log('💾 Creating transaction record...');

      // Generate unique transaction ID
      const transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      const transactionRecord = new Transaction({
        transactionId: transactionId,
        gatewayTransactionId: paymentResult.transactionId,
        escrowTransaction: escrowTransaction._id,
        buyer: escrowTransaction.buyer._id,
        seller: escrowTransaction.seller._id,
        product: escrowTransaction.product._id,
        amount: paymentAmount,
        currency: escrowTransaction.currency,
        paymentGateway: escrowTransaction.paymentGateway,
        status: 'pending',
        fees: {
          platformFee: escrowTransaction.platformFeeAmount,
          gatewayFee: escrowTransaction.gatewayFeeAmount,
          totalFees: escrowTransaction.platformFeeAmount + escrowTransaction.gatewayFeeAmount
        },
        gatewayResponse: paymentResult.gatewayResponse,
        metadata: {
          clientSecret: paymentResult.clientSecret,
          paymentIntentId: paymentResult.transactionId,
          publishableKey: paymentResult.publishableKey,
          returnUrl: returnUrl,
          cancelUrl: cancelUrl,
          mockMode: paymentResult.mockMode || false
        }
      });

      try {
        await transactionRecord.save();
        console.log('✅ Transaction record created:', transactionRecord.transactionId);

        // Add note to transaction
        await transactionRecord.addNote(
          'payment_initialized',
          `Payment initialized via ${escrowTransaction.paymentGateway} gateway`,
          buyerId
        );
      } catch (transactionError) {
        console.error('❌ Failed to save transaction record:', transactionError);
        console.error('Transaction data:', {
          transactionId: transactionRecord.transactionId,
          gatewayTransactionId: transactionRecord.gatewayTransactionId,
          amount: transactionRecord.amount,
          currency: transactionRecord.currency
        });
        // Continue with the response even if transaction record fails
      }

      return successResponse(res, 'Payment initialized successfully', {
        paymentUrl: paymentResult.paymentUrl,
        transactionId: paymentResult.transactionId,
        clientSecret: paymentResult.clientSecret, // For Stripe
        publishableKey: paymentResult.publishableKey, // For Stripe
        transactionRecordId: transactionRecord.transactionId, // Our internal transaction ID
        status: "Done"
      });
    } else {
      console.error('❌ Payment initialization failed:', paymentResult);

      // Update transaction status to failed
      escrowTransaction.status = 'payment_failed';
      escrowTransaction.gatewayResponse = paymentResult.gatewayResponse || { error: paymentResult.error };
      await escrowTransaction.save();

      // Create transaction record for failed payment tracking
      console.log('💾 Creating failed transaction record...');

      // Generate unique transaction ID for failed transaction
      const failedTransactionId = `TXN_FAILED_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      const failedTransactionRecord = new Transaction({
        transactionId: failedTransactionId,
        gatewayTransactionId: paymentResult.transactionId || `failed_${Date.now()}`,
        escrowTransaction: escrowTransaction._id,
        buyer: escrowTransaction.buyer._id,
        seller: escrowTransaction.seller._id,
        product: escrowTransaction.product._id,
        amount: paymentAmount,
        currency: escrowTransaction.currency,
        paymentGateway: escrowTransaction.paymentGateway,
        status: 'failed',
        fees: {
          platformFee: escrowTransaction.platformFeeAmount,
          gatewayFee: escrowTransaction.gatewayFeeAmount,
          totalFees: escrowTransaction.platformFeeAmount + escrowTransaction.gatewayFeeAmount
        },
        gatewayResponse: paymentResult.gatewayResponse || {},
        errorDetails: {
          code: paymentResult.code || 'PAYMENT_INIT_FAILED',
          message: paymentResult.error || 'Payment initialization failed',
          details: paymentResult.details || paymentResult
        },
        metadata: {
          returnUrl: returnUrl,
          cancelUrl: cancelUrl,
          mockMode: paymentResult.mockMode || false
        }
      });

      try {
        await failedTransactionRecord.save();
        console.log('✅ Failed transaction record created:', failedTransactionRecord.transactionId);

        // Add note to failed transaction
        await failedTransactionRecord.addNote(
          'payment_failed',
          `Payment initialization failed: ${paymentResult.error}`,
          buyerId
        );
      } catch (transactionError) {
        console.error('❌ Failed to save failed transaction record:', transactionError);
        // Continue with the error response
      }

      return errorResponse(res, paymentResult.error || 'Payment initialization failed', 400);
    }

  } catch (error) {
    console.error('❌ Initialize payment error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack
    });
    return errorResponse(res, 'Failed to initialize payment', 500);
  }
};

/**
 * Get escrow transaction details
 */
exports.getEscrowTransaction = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const userId = req.user._id;

    // Find escrow transaction by ID or custom transaction ID
    let escrowTransaction;

    // Check if it's a MongoDB ObjectId format
    if (transactionId.match(/^[0-9a-fA-F]{24}$/)) {
      escrowTransaction = await EscrowTransaction.findById(transactionId)
        .populate('buyer', 'firstName lastName email profile')
        .populate('seller', 'firstName lastName email profile')
        .populate('product', 'title price product_photos description')
        .populate('offer', 'offerAmount originalPrice status');
    } else {
      // Search by custom transaction ID (e.g., ESC-1753340352345-PW3I5IE51)
      escrowTransaction = await EscrowTransaction.findOne({ transactionId: transactionId })
        .populate('buyer', 'firstName lastName email profile')
        .populate('seller', 'firstName lastName email profile')
        .populate('product', 'title price product_photos description')
        .populate('offer', 'offerAmount originalPrice status');
    }

    if (!escrowTransaction) {
      return errorResponse(res, 'Escrow transaction not found', 404);
    }

    // Check if user is buyer or seller
    const isBuyer = escrowTransaction.buyer._id.toString() === userId.toString();
    const isSeller = escrowTransaction.seller._id.toString() === userId.toString();

    if (!isBuyer && !isSeller) {
      return errorResponse(res, 'Unauthorized access to this transaction', 403);
    }

    return successResponse(res, 'Escrow transaction retrieved successfully', {
      escrowTransaction,
      userRole: isBuyer ? 'buyer' : 'seller'
    });

  } catch (error) {
    console.error('Get escrow transaction error:', error);
    return errorResponse(res, 'Failed to retrieve escrow transaction', 500);
  }
};

/**
 * Get escrow transaction status only
 */
exports.getEscrowTransactionStatus = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const userId = req.user._id;

    console.log('🔍 Getting escrow transaction status for:', transactionId, 'user:', userId);

    // Find escrow transaction by ID or custom transaction ID
    let escrowTransaction;

    // Check if it's a MongoDB ObjectId format
    if (transactionId.match(/^[0-9a-fA-F]{24}$/)) {
      escrowTransaction = await EscrowTransaction.findById(transactionId)
        .populate('buyer', 'firstName lastName email')
        .populate('seller', 'firstName lastName email')
        .populate('product', 'title price');
    } else {
      // Search by custom transaction ID (e.g., ESC-1753340352345-PW3I5IE51)
      escrowTransaction = await EscrowTransaction.findOne({ transactionId: transactionId })
        .populate('buyer', 'firstName lastName email')
        .populate('seller', 'firstName lastName email')
        .populate('product', 'title price');
    }

    if (!escrowTransaction) {
      console.log('❌ Escrow transaction not found:', transactionId);
      return errorResponse(res, 'Escrow transaction not found', 404);
    }

    console.log('✅ Escrow transaction found:', escrowTransaction._id);

    // Check if user is buyer or seller
    const isBuyer = escrowTransaction.buyer._id.toString() === userId.toString();
    const isSeller = escrowTransaction.seller._id.toString() === userId.toString();

    if (!isBuyer && !isSeller) {
      console.log('❌ Access denied:', { 
        buyerId: escrowTransaction.buyer._id.toString(), 
        sellerId: escrowTransaction.seller._id.toString(), 
        userId: userId.toString() 
      });
      return errorResponse(res, 'Unauthorized access to this transaction', 403);
    }

    console.log('✅ Escrow transaction status retrieved:', {
      transactionId: escrowTransaction._id,
      customTransactionId: escrowTransaction.transactionId,
      status: escrowTransaction.status,
      userRole: isBuyer ? 'buyer' : 'seller'
    });

    return successResponse(res, 'Escrow transaction status retrieved successfully', {
      transactionId: escrowTransaction._id,
      orderNumber: escrowTransaction.transactionId,
      type: 'escrow',
      status: escrowTransaction.status,
      paymentStatus: escrowTransaction.status,
      lastUpdated: escrowTransaction.updatedAt,
      statusHistory: escrowTransaction.statusHistory || [],
      userRole: isBuyer ? 'buyer' : 'seller',
      source: 'EscrowTransaction'
    });

  } catch (error) {
    console.error('❌ Get escrow transaction status error:', error);
    return errorResponse(res, 'Failed to retrieve escrow transaction status', 500);
  }
};

/**
 * Get user's escrow transactions
 */
exports.getUserEscrowTransactions = async (req, res) => {
  try {
    const userId = req.user._id;
    const { role = 'all', status, page = 1, limit = 10 } = req.query;

    const skip = (page - 1) * limit;
    let query = {};

    // Filter by role
    if (role === 'buyer') {
      query.buyer = userId;
    } else if (role === 'seller') {
      query.seller = userId;
    } else {
      query.$or = [{ buyer: userId }, { seller: userId }];
    }

    // Filter by status
    if (status) {
      query.status = status;
    }

    const transactions = await EscrowTransaction.find(query)
      .populate('buyer', 'firstName lastName email profile')
      .populate('seller', 'firstName lastName email profile')
      .populate('product', 'title price product_photos')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await EscrowTransaction.countDocuments(query);

    return successResponse(res, 'Escrow transactions retrieved successfully', {
      transactions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalTransactions: total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Get user escrow transactions error:', error);
    return errorResponse(res, 'Failed to retrieve escrow transactions', 500);
  }
};

/**
 * Mark item as shipped (seller only)
 */
exports.markAsShipped = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { trackingNumber, carrier, estimatedDelivery } = req.body;
    const sellerId = req.user._id;

    // Find escrow transaction by ID or custom transaction ID
    let escrowTransaction;

    // Check if it's a MongoDB ObjectId format
    if (transactionId.match(/^[0-9a-fA-F]{24}$/)) {
      escrowTransaction = await EscrowTransaction.findById(transactionId);
    } else {
      // Search by custom transaction ID (e.g., ESC-1753340352345-PW3I5IE51)
      escrowTransaction = await EscrowTransaction.findOne({ transactionId: transactionId });
    }

    if (!escrowTransaction) {
      return errorResponse(res, 'Escrow transaction not found', 404);
    }

    // Verify seller
    if (escrowTransaction.seller.toString() !== sellerId.toString()) {
      return errorResponse(res, 'Only the seller can mark items as shipped', 403);
    }

    // Check transaction status
    if (escrowTransaction.status !== 'funds_held') {
      return errorResponse(res, 'Transaction must be in funds_held status to mark as shipped', 400);
    }

    // Update delivery details
    escrowTransaction.deliveryDetails.trackingNumber = trackingNumber;
    escrowTransaction.deliveryDetails.carrier = carrier;
    escrowTransaction.deliveryDetails.shippedAt = new Date();
    
    if (estimatedDelivery) {
      escrowTransaction.deliveryDetails.estimatedDelivery = new Date(estimatedDelivery);
    }

    await escrowTransaction.markAsShipped(trackingNumber, carrier);

    return successResponse(res, 'Item marked as shipped successfully', {
      transactionId: escrowTransaction.transactionId,
      trackingNumber,
      carrier,
      shippedAt: escrowTransaction.deliveryDetails.shippedAt
    });

  } catch (error) {
    console.error('Mark as shipped error:', error);
    return errorResponse(res, 'Failed to mark item as shipped', 500);
  }
};

/**
 * Confirm delivery (buyer only)
 */
exports.confirmDelivery = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const buyerId = req.user._id;

    // Find escrow transaction by ID or custom transaction ID
    let escrowTransaction;

    // Check if it's a MongoDB ObjectId format
    if (transactionId.match(/^[0-9a-fA-F]{24}$/)) {
      escrowTransaction = await EscrowTransaction.findById(transactionId);
    } else {
      // Search by custom transaction ID (e.g., ESC-1753340352345-PW3I5IE51)
      escrowTransaction = await EscrowTransaction.findOne({ transactionId: transactionId });
    }

    if (!escrowTransaction) {
      return errorResponse(res, 'Escrow transaction not found', 404);
    }

    // Verify buyer
    if (escrowTransaction.buyer.toString() !== buyerId.toString()) {
      return errorResponse(res, 'Only the buyer can confirm delivery', 403);
    }

    // Check transaction status
    if (escrowTransaction.status !== 'shipped') {
      return errorResponse(res, 'Transaction must be in shipped status to confirm delivery', 400);
    }

    await escrowTransaction.confirmDelivery(buyerId);

    // Credit seller's wallet with the product price (minus platform fee)
    try {
      const sellerAmount = escrowTransaction.productPrice - (escrowTransaction.platformFeeAmount || 0);

      if (sellerAmount > 0) {
        const walletResult = await creditWalletInternal(
          escrowTransaction.seller,
          sellerAmount,
          escrowTransaction.currency,
          `Payment for product: ${escrowTransaction.product?.title || 'Product'}`,
          {
            relatedEscrowTransaction: escrowTransaction._id,
            relatedProduct: escrowTransaction.product,
            metadata: {
              transactionId: escrowTransaction.transactionId,
              originalAmount: escrowTransaction.productPrice,
              platformFee: escrowTransaction.platformFeeAmount,
              netAmount: sellerAmount
            }
          }
        );

        if (walletResult.success) {
          console.log(`✅ Seller wallet credited: ${escrowTransaction.currency} ${sellerAmount}`);
        } else {
          console.error('❌ Failed to credit seller wallet:', walletResult.error);
        }
      }
    } catch (walletError) {
      console.error('❌ Error crediting seller wallet:', walletError);
      // Don't fail the delivery confirmation if wallet credit fails
    }

    return successResponse(res, 'Delivery confirmed successfully', {
      transactionId: escrowTransaction.transactionId,
      deliveredAt: escrowTransaction.deliveryDetails.deliveredAt,
      status: escrowTransaction.status
    });

  } catch (error) {
    console.error('Confirm delivery error:', error);
    return errorResponse(res, 'Failed to confirm delivery', 500);
  }
};

/**
 * Get transaction details by transaction ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getTransactionDetails = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const userId = req.user._id;

    console.log('🔍 Getting transaction details:', { transactionId, userId });

    // Find transaction by either our internal ID or gateway transaction ID
    let transaction = await Transaction.findOne({
      $or: [
        { transactionId: transactionId },
        { gatewayTransactionId: transactionId }
      ]
    })
    .populate('escrowTransaction')
    .populate('buyer', 'firstName lastName email')
    .populate('seller', 'firstName lastName email')
    .populate('product', 'title price product_photos');

    if (!transaction) {
      return errorResponse(res, 'Transaction not found', 404);
    }

    // Verify user has access to this transaction
    const isBuyer = transaction.buyer._id.toString() === userId.toString();
    const isSeller = transaction.seller._id.toString() === userId.toString();

    if (!isBuyer && !isSeller) {
      return errorResponse(res, 'Unauthorized access to this transaction', 403);
    }

    return successResponse(res, 'Transaction details retrieved successfully', {
      transaction: {
        id: transaction.transactionId,
        gatewayTransactionId: transaction.gatewayTransactionId,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        paymentGateway: transaction.paymentGateway,
        paymentMethod: transaction.paymentMethod,
        fees: transaction.fees,
        metadata: transaction.metadata,
        timestamps: transaction.timestamps,
        errorDetails: transaction.errorDetails,
        buyer: transaction.buyer,
        seller: transaction.seller,
        product: transaction.product,
        escrowTransaction: transaction.escrowTransaction,
        notes: transaction.notes,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt
      }
    });

  } catch (error) {
    console.error('Get transaction details error:', error);
    return errorResponse(res, 'Failed to get transaction details', 500);
  }
};

/**
 * Get user's transaction history
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getUserTransactions = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20, status, paymentGateway } = req.query;

    console.log('📋 Getting user transactions:', { userId, page, limit, status, paymentGateway });

    // Build query
    const query = {
      $or: [
        { buyer: userId },
        { seller: userId }
      ]
    };

    if (status) {
      query.status = status;
    }

    if (paymentGateway) {
      query.paymentGateway = paymentGateway;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get transactions with pagination
    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .populate('buyer', 'firstName lastName email')
        .populate('seller', 'firstName lastName email')
        .populate('product', 'title price product_photos')
        .populate('escrowTransaction', 'status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Transaction.countDocuments(query)
    ]);

    return successResponse(res, 'User transactions retrieved successfully', {
      transactions: transactions.map(transaction => ({
        id: transaction.transactionId,
        gatewayTransactionId: transaction.gatewayTransactionId,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        paymentGateway: transaction.paymentGateway,
        paymentMethod: transaction.paymentMethod,
        fees: transaction.fees,
        buyer: transaction.buyer,
        seller: transaction.seller,
        product: transaction.product,
        escrowTransaction: transaction.escrowTransaction,
        userRole: transaction.buyer._id.toString() === userId.toString() ? 'buyer' : 'seller',
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalTransactions: total,
        hasNextPage: skip + transactions.length < total,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get user transactions error:', error);
    return errorResponse(res, 'Failed to get user transactions', 500);
  }
};

/**
 * Complete payment after successful gateway confirmation
 */
exports.completePayment = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const userId = req.user._id;
    const { paymentIntentId, amount, currency } = req.body;

    console.log('💳 Complete payment request:', { transactionId, userId, paymentIntentId });

    // Find escrow transaction by ID or custom transaction ID
    let escrowTransaction;

    // Check if it's a MongoDB ObjectId format
    if (transactionId.match(/^[0-9a-fA-F]{24}$/)) {
      escrowTransaction = await EscrowTransaction.findById(transactionId)
        .populate('buyer', 'firstName lastName email')
        .populate('seller', 'firstName lastName email')
        .populate('product', 'title price product_photos');
    } else {
      // Search by custom transaction ID (e.g., ESC-1753340352345-PW3I5IE51)
      escrowTransaction = await EscrowTransaction.findOne({ transactionId: transactionId })
        .populate('buyer', 'firstName lastName email')
        .populate('seller', 'firstName lastName email')
        .populate('product', 'title price product_photos');
    }

    if (!escrowTransaction) {
      return errorResponse(res, 'Escrow transaction not found', 404);
    }

    // Check if user is buyer (only buyer can complete payment)
    const isBuyer = escrowTransaction.buyer._id.toString() === userId.toString();
    if (!isBuyer) {
      return errorResponse(res, 'Only buyer can complete payment', 403);
    }

    // Check if payment is still processing
    if (escrowTransaction.status !== 'payment_processing') {
      return successResponse(res, 'Payment already processed', {
        escrowTransaction,
        alreadyCompleted: true
      });
    }

    // Update escrow transaction status to funds_held
    escrowTransaction.status = 'funds_held';
    escrowTransaction.gatewayResponse = {
      ...escrowTransaction.gatewayResponse,
      completedAt: new Date(),
      finalAmount: amount || escrowTransaction.totalAmount,
      finalCurrency: currency || escrowTransaction.currency,
      gatewayTransactionId: paymentIntentId || escrowTransaction.gatewayTransactionId
    };

    // Add status history entry
    escrowTransaction.statusHistory.push({
      status: 'funds_held',
      timestamp: new Date(),
      note: 'Payment completed successfully'
    });

    await escrowTransaction.save();

    console.log(`✅ Payment completed for escrow transaction: ${escrowTransaction.transactionId}`);

    // Update corresponding Transaction record status
    try {
      console.log('🔄 Updating corresponding Transaction record status...');
      const Transaction = require('../../../db/models/transactionModel');
      
      const transactionRecord = await Transaction.findOne({ 
        escrowTransaction: escrowTransaction._id 
      });
      
      if (transactionRecord) {
        transactionRecord.status = 'completed';
        transactionRecord.orderStatus = 'paid'; // Set order status for proper mapping
        await transactionRecord.save();
        console.log(`✅ Transaction record updated to completed: ${transactionRecord.transactionId}`);
      } else {
        console.log('⚠️ No corresponding Transaction record found for escrow transaction');
      }
    } catch (transactionUpdateError) {
      console.error('❌ Error updating Transaction record:', transactionUpdateError);
      // Don't fail the escrow completion if transaction update fails
    }

    // Create order when escrow payment is completed (funds held)
    try {
      console.log('📦 Creating order for escrow payment completion...');
      const OrderCreationService = require('../../../services/order/OrderCreationService');

      // Populate escrow transaction for order creation
      await escrowTransaction.populate([
        { path: 'buyer', select: 'firstName lastName email phoneNumber' },
        { path: 'seller', select: 'firstName lastName email phoneNumber' },
        { path: 'product', select: 'title price product_photos' }
      ]);

      const orderResult = await OrderCreationService.createOrderFromEscrowPayment(escrowTransaction);

      if (orderResult.success) {
        if (orderResult.alreadyExists) {
          console.log('ℹ️ Order already exists for this escrow payment');
        } else {
          console.log('✅ Order created successfully:', orderResult.order.orderNumber);
        }
      } else {
        console.error('❌ Failed to create order:', orderResult.error);
        // Don't fail the payment completion if order creation fails
      }
    } catch (orderError) {
      console.error('❌ Error creating order for escrow payment:', orderError);
      // Don't fail the payment completion if order creation fails
    }

    return successResponse(res, 'Payment completed successfully', {
      escrowTransaction,
      statusChanged: true
    });

  } catch (error) {
    console.error('❌ Complete payment error:', error);
    return errorResponse(res, 'Failed to complete payment', 500);
  }
};

/**
 * Test endpoint to manually complete payment (for testing purposes)
 */
exports.testCompletePayment = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const userId = req.user._id;

    console.log('🧪 Test complete payment request:', { transactionId, userId });

    // Find escrow transaction by ID or custom transaction ID
    let escrowTransaction;

    // Check if it's a MongoDB ObjectId format
    if (transactionId.match(/^[0-9a-fA-F]{24}$/)) {
      escrowTransaction = await EscrowTransaction.findById(transactionId);
    } else {
      // Search by custom transaction ID (e.g., ESC-1753340352345-PW3I5IE51)
      escrowTransaction = await EscrowTransaction.findOne({ transactionId: transactionId });
    }

    if (!escrowTransaction) {
      return errorResponse(res, 'Escrow transaction not found', 404);
    }

    // Check if user is buyer or seller
    if (escrowTransaction.buyer.toString() !== userId.toString() &&
        escrowTransaction.seller.toString() !== userId.toString()) {
      return errorResponse(res, 'Access denied', 403);
    }

    // Check if payment is in processing state
    if (escrowTransaction.status !== 'payment_processing') {
      return errorResponse(res, `Cannot complete payment. Current status: ${escrowTransaction.status}`, 400);
    }

    // Simulate payment completion
    escrowTransaction.status = 'funds_held';
    escrowTransaction.gatewayResponse = {
      ...escrowTransaction.gatewayResponse,
      completedAt: new Date(),
      testCompleted: true,
      completedBy: userId.toString()
    };

    // Add status history
    escrowTransaction.statusHistory.push({
      status: 'funds_held',
      timestamp: new Date(),
      note: 'Payment completed via test endpoint'
    });

    await escrowTransaction.save();

    console.log('✅ Test payment completion successful');
    
    // Update corresponding Transaction record status
    try {
      console.log('🔄 Updating corresponding Transaction record status...');
      const Transaction = require('../../../db/models/transactionModel');
      
      const transactionRecord = await Transaction.findOne({ 
        escrowTransaction: escrowTransaction._id 
      });
      
      if (transactionRecord) {
        transactionRecord.status = 'completed';
        transactionRecord.orderStatus = 'paid'; // Set order status for proper mapping
        await transactionRecord.save();
        console.log(`✅ Transaction record updated to completed: ${transactionRecord.transactionId}`);
      } else {
        console.log('⚠️ No corresponding Transaction record found for escrow transaction');
      }
    } catch (transactionUpdateError) {
      console.error('❌ Error updating Transaction record:', transactionUpdateError);
      // Don't fail the test completion if transaction update fails
    }

    return successResponse(res, 'Payment completed successfully (test mode)', {
      transactionId: escrowTransaction.transactionId,
      status: escrowTransaction.status,
      message: 'Payment has been marked as completed for testing purposes'
    });

  } catch (error) {
    console.error('❌ Test complete payment error:', error);
    return errorResponse(res, 'Failed to complete payment', 500);
  }
};

/**
 * Check and update payment status from gateway
 */
exports.checkPaymentStatus = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const userId = req.user._id;

    console.log('🔍 Checking payment status for transaction:', transactionId);

    // Find escrow transaction by ID or custom transaction ID
    let escrowTransaction;

    // Check if it's a MongoDB ObjectId format
    if (transactionId.match(/^[0-9a-fA-F]{24}$/)) {
      escrowTransaction = await EscrowTransaction.findById(transactionId)
        .populate('buyer', 'firstName lastName email')
        .populate('seller', 'firstName lastName email')
        .populate('product', 'title price product_photos');
    } else {
      // Search by custom transaction ID (e.g., ESC-1753340352345-PW3I5IE51)
      escrowTransaction = await EscrowTransaction.findOne({ transactionId: transactionId })
        .populate('buyer', 'firstName lastName email')
        .populate('seller', 'firstName lastName email')
        .populate('product', 'title price product_photos');
    }

    if (!escrowTransaction) {
      return errorResponse(res, 'Escrow transaction not found', 404);
    }

    // Check if user is buyer or seller
    const isBuyer = escrowTransaction.buyer._id.toString() === userId.toString();
    const isSeller = escrowTransaction.seller._id.toString() === userId.toString();

    if (!isBuyer && !isSeller) {
      return errorResponse(res, 'Unauthorized access to this transaction', 403);
    }

    // Only check if payment is still processing
    if (escrowTransaction.status !== 'payment_processing') {
      return successResponse(res, 'Payment status retrieved', {
        escrowTransaction,
        userRole: isBuyer ? 'buyer' : 'seller',
        statusChanged: false
      });
    }

    // Get payment gateway service
    const gatewayService = paymentGatewayFactory.getGateway(escrowTransaction.paymentGateway);
    if (!gatewayService) {
      return errorResponse(res, 'Payment gateway not available', 400);
    }

    // Check payment status with gateway
    const paymentStatus = await gatewayService.checkPaymentStatus(escrowTransaction.gatewayTransactionId);
    console.log('💳 Gateway payment status:', paymentStatus);

    let statusChanged = false;

    // Update status based on gateway response
    if (paymentStatus.success) {
      if (paymentStatus.status === 'completed' || paymentStatus.status === 'succeeded') {
        // Payment is completed, update to funds_held
        escrowTransaction.status = 'funds_held';
        escrowTransaction.gatewayResponse = {
          ...escrowTransaction.gatewayResponse,
          completedAt: new Date(),
          finalAmount: paymentStatus.amount,
          finalCurrency: paymentStatus.currency,
          statusCheckedAt: new Date()
        };

        // Add status history
        escrowTransaction.statusHistory.push({
          status: 'funds_held',
          timestamp: new Date(),
          note: 'Payment confirmed via status check'
        });

        await escrowTransaction.save();
        statusChanged = true;

        console.log('✅ Payment status updated to funds_held:', escrowTransaction.transactionId);
        
        // Update corresponding Transaction record status
        try {
          console.log('🔄 Updating corresponding Transaction record status...');
          const Transaction = require('../../../db/models/transactionModel');
          
          const transactionRecord = await Transaction.findOne({ 
            escrowTransaction: escrowTransaction._id 
          });
          
          if (transactionRecord) {
            transactionRecord.status = 'completed';
            transactionRecord.orderStatus = 'paid'; // Set order status for proper mapping
            await transactionRecord.save();
            console.log(`✅ Transaction record updated to completed: ${transactionRecord.transactionId}`);
          } else {
            console.log('⚠️ No corresponding Transaction record found for escrow transaction');
          }
        } catch (transactionUpdateError) {
          console.error('❌ Error updating Transaction record:', transactionUpdateError);
          // Don't fail the status update if transaction update fails
        }
      } else if (paymentStatus.status === 'failed' || paymentStatus.status === 'canceled') {
        // Payment failed, update status
        escrowTransaction.status = 'payment_failed';
        escrowTransaction.gatewayResponse = {
          ...escrowTransaction.gatewayResponse,
          failedAt: new Date(),
          error: paymentStatus.error || 'Payment failed',
          statusCheckedAt: new Date()
        };

        await escrowTransaction.save();
        statusChanged = true;

        console.log('❌ Payment status updated to failed:', escrowTransaction.transactionId);
      }
    }

    return successResponse(res, 'Payment status checked successfully', {
      escrowTransaction,
      userRole: isBuyer ? 'buyer' : 'seller',
      statusChanged,
      gatewayStatus: paymentStatus
    });

  } catch (error) {
    console.error('Check payment status error:', error);
    return errorResponse(res, 'Failed to check payment status', 500);
  }
};

module.exports = exports;
