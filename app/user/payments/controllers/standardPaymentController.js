const StandardPayment = require('../../../../db/models/standardPaymentModel');
const Product = require('../../../../db/models/productModel');
const User = require('../../../../db/models/userModel');
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');
const paymentGatewayFactory = require('../../../../services/payment/PaymentGatewayFactory');
const { creditWalletInternal } = require('../../wallet/controllers/walletController');
const PaymentCompletionService = require('../../../../services/payment/PaymentCompletionService');
const currencyService = require('../../../../services/currency/CurrencyService');

/**
 * Test endpoint for standard payments
 */
exports.testStandardPayment = async (req, res) => {
  try {
    console.log('🧪 Standard payment test endpoint called');
    return successResponse(res, 'Standard payment API is working', {
      timestamp: new Date().toISOString(),
      user: req.user ? req.user._id : 'No user'
    });
  } catch (error) {
    console.error('❌ Test endpoint error:', error);
    return errorResponse(res, 'Test endpoint failed', 500);
  }
};

/**
 * Public: return PayPal client id for loading JS SDK
 */
exports.getPayPalClientId = async (req, res) => {
  try {
    // Payment gateway factory is already required at top
    const gateway = paymentGatewayFactory.getGateway('paypal');
    if (!gateway) {
      return successResponse(res, 'PayPal gateway not configured', { clientId: null, environment: 'sandbox' });
    }

    // Client ID is stored in service instance created from DB configuration
    const clientId = process.env.PAYPAL_CLIENT_ID || gateway.clientId || null;
    const environment = gateway.environment || 'sandbox';

    return successResponse(res, 'PayPal client id', { clientId, environment });
  } catch (err) {
    console.error('❌ getPayPalClientId error:', err);
    return successResponse(res, 'PayPal client id', { clientId: null, environment: 'sandbox' });
  }
};

/**
 * Public: generate PayPal client token for Hosted/Card Fields
 */
exports.getPayPalClientToken = async (req, res) => {
  try {
    const gateway = paymentGatewayFactory.getGateway('paypal');
    if (!gateway || !gateway.generateClientToken) {
      return successResponse(res, 'PayPal gateway not configured', { clientToken: null });
    }
    const result = await gateway.generateClientToken();
    if (!result.success) {
      return successResponse(res, 'Failed to generate token', { clientToken: null, error: result.error });
    }
    return successResponse(res, 'PayPal client token', { clientToken: result.clientToken });
  } catch (err) {
    console.error('❌ getPayPalClientToken error:', err);
    return successResponse(res, 'PayPal client token', { clientToken: null });
  }
};



/**
 * Create a standard payment transaction
 */
exports.createStandardPayment = async (req, res) => {
  try {
    console.log('🔄 Create standard payment request received');
    const buyerId = req.user._id;
    const {
      productId,
      offerId,
      paymentGateway,
      currency = 'USD',
      shippingAddress,
      // Selected shipping cost from checkout page (USD or display currency). If not provided, fallback to product default.
      shippingCost: requestShippingCost,
      gatewayFeePaidBy = 'buyer',
      cardDetails,
      paymentSummary
    } = req.body;

    console.log('Standard payment creation params:', {
      buyerId,
      productId,
      offerId,
      paymentGateway,
      currency,
      gatewayFeePaidBy,
      paymentSummary
    });

    // Validate required fields
    if (!productId || !paymentGateway || !shippingAddress) {
      console.error('❌ Missing required fields:', { productId, paymentGateway, shippingAddress });
      return errorResponse(res, 'Missing required fields: productId, paymentGateway, shippingAddress', 400);
    }

    // Validate shipping address structure
    const requiredAddressFields = ['fullName', 'street1', 'city', 'country'];
    const missingFields = requiredAddressFields.filter(field => !shippingAddress[field]);

    // Check for zip/zipCode field (accept either)
    if (!shippingAddress.zip && !shippingAddress.zipCode) {
      missingFields.push('zip/zipCode');
    }

    if (missingFields.length > 0) {
      console.error('❌ Missing shipping address fields:', missingFields);
      return errorResponse(res, `Missing shipping address fields: ${missingFields.join(', ')}`, 400);
    }

    // Get product details
    console.log('🔍 Fetching product with ID:', productId);
    const product = await Product.findById(productId).populate('user', 'firstName lastName email');
    if (!product) {
      console.error('❌ Product not found:', productId);
      return errorResponse(res, 'Product not found', 404);
    }
    console.log('✅ Product found:', product.title, 'Status:', product.status);

    // Prevent purchasing non-active products
    if (product.status && product.status !== 'active') {
      return errorResponse(res, `Product is not available for purchase (status: ${product.status})`, 400);
    }

    const sellerId = product.user._id;
    console.log('🔍 Seller ID:', sellerId);

    // Check if buyer is not the seller
    if (buyerId.toString() === sellerId.toString()) {
      console.error('❌ Buyer cannot purchase own product');
      return errorResponse(res, 'Cannot purchase your own product', 400);
    }

    // Calculate amounts
    let productPrice = product.price;

    // If offer is provided, use offer amount
    if (offerId) {
      // TODO: Validate offer and get offer amount
      // For now, assume offer amount is passed or use product price
    }

    // Use shipping cost provided by frontend (selected option) if present; otherwise fallback to product default
    const shippingCost = (requestShippingCost !== undefined && requestShippingCost !== null)
      ? Number(requestShippingCost)
      : (product.shipping_cost || 0);
    const salesTax = 0.72; // Fixed sales tax
    const platformFeeAmount = productPrice * 0.05; // 5% platform fee for standard payments

    // Buyer should NOT be charged the platform fee. It is deducted from seller payout.
    const buyerSubtotal = productPrice + shippingCost + salesTax;

    // Calculate base amount for gateway fee calculation (what the gateway actually processes)
    const baseAmount = buyerSubtotal;
    console.log('🔍 Buyer subtotal (excludes platform fee):', buyerSubtotal);

    // Get payment gateway and calculate gateway fee
    console.log('🔍 Getting payment gateway:', paymentGateway);

    let gatewayFeeAmount = 0;
    try {
      const gateway = paymentGatewayFactory.getGateway(paymentGateway);
      if (!gateway) {
        console.warn('⚠️ Payment gateway not available, using mock calculation:', paymentGateway);
        // Mock gateway fee calculation (2.9% + $0.30)
        gatewayFeeAmount = (baseAmount * 0.029) + 0.30;
      } else {
        console.log('✅ Payment gateway found:', gateway.gatewayName);

        // Check if gateway supports the currency (with special handling for PayTabs)
        const gatewayConfig = gateway.getGatewayConfig();
        const supportsCurrency = gateway.isCurrencySupported(currency);

        if (!supportsCurrency) {
          if (paymentGateway === 'paytabs' && (currency === 'USD' || currency === 'AED')) {
            console.log(`⚠️ PayTabs doesn't support ${currency}, but will convert to SAR during payment initialization`);
          } else {
            console.error(`❌ Gateway ${paymentGateway} doesn't support currency ${currency}`);
            console.error(`Supported currencies:`, gatewayConfig.supportedCurrencies);
            return errorResponse(res, `Payment gateway ${paymentGateway} does not support ${currency}. Supported currencies: ${gatewayConfig.supportedCurrencies.join(', ')}`, 400);
          }
        }

        console.log('🔍 Calculating gateway fee for amount:', baseAmount, currency);
        gatewayFeeAmount = gateway.calculateGatewayFee(baseAmount, currency);
      }
    } catch (gatewayError) {
      console.warn('⚠️ Gateway factory error, using mock calculation:', gatewayError.message);
      // Mock gateway fee calculation (2.9% + $0.30)
      gatewayFeeAmount = (baseAmount * 0.029) + 0.30;
    }

    console.log('✅ Gateway fee calculated:', gatewayFeeAmount);

    // Always compute total amount on server; never trust client-provided totals.
    const totalAmount = buyerSubtotal + (gatewayFeePaidBy === 'buyer' ? gatewayFeeAmount : 0);

    // Generate transaction ID
    const transactionId = `PAY_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    console.log('🔍 Generated transaction ID:', transactionId);

    // Transform shipping address to match model schema
    const transformedShippingAddress = {
      fullName: shippingAddress.fullName,
      street1: shippingAddress.street1,
      street2: shippingAddress.street2 || '',
      city: shippingAddress.city,
      state: shippingAddress.state || '',
      zip: shippingAddress.zip || shippingAddress.zipCode, // Map zipCode to zip
      country: shippingAddress.country
    };

    console.log('Transformed shipping address:', transformedShippingAddress);

    // Create standard payment record
    console.log('🔍 Creating standard payment with data:', {
      transactionId,
      buyer: buyerId,
      seller: sellerId,
      product: productId,
      offer: offerId || null,
      productPrice,
      shippingCost,
      salesTax,
      platformFeeAmount,
      gatewayFeeAmount,
      totalAmount,
      currency,
      paymentGateway,
      shippingAddress: transformedShippingAddress,
      gatewayFeePaidBy,
      cardDetails: cardDetails || null,
      status: 'pending'
    });

    const standardPayment = new StandardPayment({
      transactionId,
      buyer: buyerId,
      seller: sellerId,
      product: productId,
      offer: offerId || null,
      productPrice,
      shippingCost,
      salesTax,
      platformFeeAmount,
      gatewayFeeAmount,
      totalAmount,
      currency,
      paymentGateway,
      shippingAddress: transformedShippingAddress,
      gatewayFeePaidBy,
      cardDetails: cardDetails || null,
      status: 'pending',
      // Store payment summary for display purposes (sanitized)
      paymentSummary: {
        productPrice: paymentSummary?.productPrice ?? productPrice,
        platformFee: paymentSummary?.platformFee ?? platformFeeAmount,
        shippingCost: paymentSummary?.shippingCost ?? shippingCost,
        salesTax: paymentSummary?.salesTax ?? salesTax,
        // If seller pays the processing fee, show 0 to the buyer
        processingFee: gatewayFeePaidBy === 'buyer' ? Math.round((paymentSummary?.processingFee ?? gatewayFeeAmount) * 100) / 100 : 0,
        // Always reflect the server-computed total
        totalAmount: totalAmount,
        currency: paymentSummary?.currency ?? currency,
        exchangeRate: paymentSummary?.exchangeRate ?? 1
      }
    });

    console.log('🔍 Saving standard payment...');
    const savedPayment = await standardPayment.save();
    console.log('✅ Standard payment created:', savedPayment.transactionId);

    return successResponse(res, 'Standard payment created successfully', {
      paymentId: savedPayment._id,
      transactionId: savedPayment.transactionId,
      totalAmount: savedPayment.totalAmount,
      currency: savedPayment.currency,
      status: "Done"
    });

  } catch (error) {
    console.error('❌ Error creating standard payment:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code
    });
    return errorResponse(res, `Failed to create standard payment: ${error.message}`, 500);
  }
};

/**
 * Initialize payment with gateway
 */
exports.initializeStandardPayment = async (req, res) => {
  try {
    console.log('🔄 Initialize standard payment request received');
    const { paymentId } = req.params;
    const { returnUrl, cancelUrl } = req.body;
    const buyerId = req.user._id;

    console.log('Payment initialization params:', {
      paymentId,
      returnUrl,
      cancelUrl,
      buyerId
    });

    // Get payment details
    console.log('🔍 Fetching payment with ID:', paymentId);
    const payment = await StandardPayment.findById(paymentId)
      .populate('buyer', 'firstName lastName email phone profile')
      .populate('seller', 'firstName lastName email profile')
      .populate('product', 'title description');

    if (!payment) {
      console.error('❌ Payment not found:', paymentId);
      return errorResponse(res, 'Payment not found', 404);
    }

    console.log('✅ Payment found:', {
      transactionId: payment.transactionId,
      status: payment.status,
      buyer: payment.buyer?.email,
      product: payment.product?.title
    });

    // Verify buyer
    if (payment.buyer._id.toString() !== buyerId.toString()) {
      return errorResponse(res, 'Unauthorized access to payment', 403);
    }

    // Check payment status
    if (payment.status !== 'pending') {
      return errorResponse(res, `Payment is already ${payment.status}`, 400);
    }

    // Get payment gateway with fallback
    console.log('🔍 Getting payment gateway for initialization:', payment.paymentGateway);
    let gateway;
    let paymentResult;

    try {
      gateway = paymentGatewayFactory.getGateway(payment.paymentGateway);
    } catch (gatewayError) {
      console.warn('⚠️ Payment gateway factory error:', gatewayError.message);
      gateway = null;
    }

    if (!gateway) {
      console.warn('⚠️ Payment gateway not available, using mock initialization:', payment.paymentGateway);

      // Mock payment initialization for testing
      paymentResult = {
        success: true,
        transactionId: `mock_${payment.transactionId}`,
        paymentUrl: null, // Will trigger success page redirect
        clientSecret: null,
        publishableKey: null,
        gatewayResponse: {
          gateway: payment.paymentGateway,
          status: 'mock_initialized',
          timestamp: new Date().toISOString()
        }
      };

      // For mock payments, immediately complete the payment and credit wallet
      console.log('💰 Mock payment - completing payment and crediting seller wallet');
      try {
        const completionResult = await PaymentCompletionService.processStandardPaymentCompletion(payment._id);

        if (completionResult.success) {
          console.log(`✅ Mock payment completed and wallet credited: ${completionResult.currency} ${completionResult.sellerAmount}`);
        } else {
          console.error('❌ Mock payment - Failed to complete payment:', completionResult.error);
        }
      } catch (completionError) {
        console.error('❌ Mock payment - Error completing payment:', completionError);
      }
    } else {
      // Handle currency conversion for PayTabs
      let finalCurrency = payment.currency;
      let finalAmount = payment.totalAmount;

      console.log('🔍 Standard payment gateway check:', {
        paymentGateway: payment.paymentGateway,
        originalCurrency: payment.currency,
        originalAmount: payment.totalAmount
      });

      if (payment.paymentGateway === 'paytabs') {
        console.log('🔄 PayTabs detected for standard payment - checking server status and currency support');

        // Check PayTabs server status first (temporarily disabled)
        // const serverStatus = await gateway.checkServerHealth();
        // console.log('🔍 PayTabs server status:', serverStatus);

        // if (!serverStatus.success && serverStatus.isServerError) {
        //   console.error('❌ PayTabs servers are down, cannot process payment');
        //   return errorResponse(res,
        //     'PayTabs payment service is temporarily unavailable. Please try Stripe or PayPal, or try again later.',
        //     503
        //   );
        // }

        console.log('⚠️ PayTabs health check disabled - attempting payment with retry logic');

        const gatewayConfig = gateway.getGatewayConfig();
        console.log('🔍 PayTabs supported currencies:', gatewayConfig.supportedCurrencies);
        console.log('🔍 Payment currency:', payment.currency);

        if (!gatewayConfig.supportedCurrencies.includes(payment.currency)) {
          console.log(`⚠️ PayTabs doesn't support ${payment.currency}, converting to SAR`);

          // Auto-update currency rates
          await currencyService.autoUpdate();

          // Convert to SAR for PayTabs using currency service
          const conversion = currencyService.convertCurrency(
            payment.totalAmount,
            payment.currency,
            'SAR'
          );

          console.log('💱 Standard payment currency conversion result:', conversion);

          if (conversion.success) {
            finalCurrency = 'SAR';
            finalAmount = conversion.convertedAmount;

            console.log('✅ Standard payment currency conversion successful:', {
              originalCurrency: payment.currency,
              originalAmount: payment.totalAmount,
              finalCurrency: finalCurrency,
              finalAmount: finalAmount,
              exchangeRate: conversion.exchangeRate,
              lastUpdated: conversion.lastUpdated
            });
          } else {
            console.error('❌ Standard payment currency conversion failed:', conversion.error);
            return errorResponse(res, `Currency conversion failed: ${conversion.error}`, 400);
          }
        } else {
          console.log('✅ PayTabs supports the currency for standard payment:', payment.currency);
        }
      } else {
        console.log('ℹ️ Not PayTabs gateway for standard payment, no currency conversion needed');
      }

      // Prepare payment data
      const paymentData = {
        amount: finalAmount,
        currency: finalCurrency,
        orderId: payment.transactionId,
        description: `Purchase of ${payment.product.title}`,
        customerName: `${payment.buyer.firstName} ${payment.buyer.lastName}`,
        customerEmail: payment.buyer.email,
        customerPhone: payment.buyer.phone,
        returnUrl: returnUrl,
        cancelUrl: cancelUrl,
        callbackUrl: `${process.env.BASE_URL}/api/user/payments/webhook/${payment.paymentGateway}`,
        buyerId: payment.buyer._id.toString(),
        sellerId: payment.seller._id.toString(),
        productId: payment.product._id.toString(),
        paymentId: payment._id.toString(),
        originalCurrency: payment.currency,
        originalAmount: payment.totalAmount
      };

      console.log('Initializing payment with gateway:', payment.paymentGateway);
      console.log('Payment data:', paymentData);
      paymentResult = await gateway.initializePayment(paymentData);
    }

    console.log('Payment gateway response:', paymentResult);

    if (paymentResult.success) {
      console.log('✅ Payment initialization successful');

      // Update payment status
      payment.status = 'processing';
      payment.gatewayTransactionId = paymentResult.transactionId;
      payment.gatewayResponse = paymentResult.gatewayResponse;
      await payment.save();

      console.log('💾 Standard payment updated with gateway details');

      return successResponse(res, 'Payment initialized successfully', {
        paymentUrl: paymentResult.paymentUrl,
        transactionId: paymentResult.transactionId,
        clientSecret: paymentResult.clientSecret,
        publishableKey: paymentResult.publishableKey,
        standardPaymentId: payment._id,
        standardTransactionId: payment.transactionId,
        status: "Done"
      });

    } else {
      console.error('❌ Payment initialization failed:', paymentResult);
      return errorResponse(res, paymentResult.error || 'Failed to initialize payment', 400);
    }

  } catch (error) {
    console.error('❌ Error initializing standard payment:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code
    });
    return errorResponse(res, `Failed to initialize payment: ${error.message}`, 500);
  }
};

/**
 * Get standard payment details
 */
exports.getStandardPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user._id;

    // Validate ObjectId format
    if (!paymentId.match(/^[0-9a-fA-F]{24}$/)) {
      console.log('❌ Invalid payment ID format:', paymentId);
      return errorResponse(res, 'Invalid payment ID format', 400);
    }

    const payment = await StandardPayment.findById(paymentId)
      .populate('buyer', 'firstName lastName email profile')
      .populate('seller', 'firstName lastName email profile')
      .populate('product', 'title description price product_photos');

    if (!payment) {
      return errorResponse(res, 'Payment not found', 404);
    }

    // Check if user is buyer or seller
    const isBuyer = payment.buyer._id.toString() === userId.toString();
    const isSeller = payment.seller._id.toString() === userId.toString();

    if (!isBuyer && !isSeller) {
      return errorResponse(res, 'Unauthorized access to payment', 403);
    }

    return successResponse(res, 'Payment details retrieved successfully', {
      payment
    });

  } catch (error) {
    console.error('❌ Error getting standard payment:', error);
    return errorResponse(res, 'Failed to get payment details', 500);
  }
};

/**
 * Check and update payment status from gateway for standard payments
 */
exports.checkStandardPaymentStatus = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user._id;

    console.log('🔍 Checking standard payment status for payment:', paymentId);

    // Validate ObjectId format
    if (!paymentId.match(/^[0-9a-fA-F]{24}$/)) {
      console.log('❌ Invalid payment ID format:', paymentId);
      return errorResponse(res, 'Invalid payment ID format', 400);
    }

    // Find standard payment
    const payment = await StandardPayment.findById(paymentId)
      .populate('buyer', 'firstName lastName email')
      .populate('seller', 'firstName lastName email')
      .populate('product', 'title price product_photos');

    if (!payment) {
      return errorResponse(res, 'Standard payment not found', 404);
    }

    // Check if user is buyer or seller
    const isBuyer = payment.buyer._id.toString() === userId.toString();
    const isSeller = payment.seller._id.toString() === userId.toString();

    if (!isBuyer && !isSeller) {
      return errorResponse(res, 'Unauthorized access to this payment', 403);
    }

    // Only check if payment is still processing
    if (payment.status !== 'payment_processing') {
      return successResponse(res, 'Payment status retrieved', {
        payment,
        userRole: isBuyer ? 'buyer' : 'seller',
        statusChanged: false
      });
    }

    // Get payment gateway service
    const gatewayService = paymentGatewayFactory.getGateway(payment.paymentGateway);
    if (!gatewayService) {
      return errorResponse(res, 'Payment gateway not available', 400);
    }

    let statusChanged = false;
    let paymentStatus = null;

    try {
      // Check payment status with gateway
      if (payment.gatewayTransactionId) {
        console.log('🔍 Checking payment status with gateway:', payment.paymentGateway);
        paymentStatus = await gatewayService.checkPaymentStatus(payment.gatewayTransactionId);
        console.log('📊 Gateway payment status:', paymentStatus);

        // Update payment status based on gateway response
        if (paymentStatus === 'succeeded' || paymentStatus === 'completed') {
          console.log('✅ Payment confirmed by gateway - updating to completed');
          payment.status = 'completed';
          payment.completedAt = new Date();
          await payment.save();
          statusChanged = true;

          // Credit seller wallet with proper calculation
          try {
            console.log('💰 Crediting seller wallet for standard payment:', {
              sellerId: payment.seller._id,
              productPrice: payment.productPrice,
              platformFee: payment.platformFeeAmount,
              currency: payment.currency
            });

            // Calculate seller amount (product price minus platform fee)
            const sellerAmount = payment.productPrice - (payment.platformFeeAmount || 0);

            if (sellerAmount > 0) {
              const walletResult = await creditWalletInternal(
                payment.seller._id,
                sellerAmount,
                payment.currency,
                `Standard payment for product: ${payment.product?.title || 'Product'}`,
                {
                  relatedStandardPayment: payment._id,
                  relatedProduct: payment.product,
                  metadata: {
                    transactionId: payment.transactionId,
                    originalAmount: payment.productPrice,
                    platformFee: payment.platformFeeAmount,
                    netAmount: sellerAmount,
                    paymentType: 'standard',
                    buyerName: `${payment.buyer?.firstName} ${payment.buyer?.lastName}`,
                    buyerEmail: payment.buyer?.email,
                    completedAt: new Date().toISOString()
                  }
                }
              );

              console.log('💰 Seller wallet credited successfully:', {
                amount: sellerAmount,
                currency: payment.currency,
                walletResult: walletResult.success
              });

              // Create order for completed standard payment
              try {
                console.log('📦 Creating order for completed standard payment...');
                const OrderCreationService = require('../../../services/order/OrderCreationService');

                const orderResult = await OrderCreationService.createOrderFromStandardPayment(payment);

                if (orderResult.success) {
                  if (orderResult.alreadyExists) {
                    console.log('ℹ️ Order already exists for this standard payment');
                  } else {
                    console.log('✅ Order created successfully:', orderResult.order.orderNumber);
                  }
                } else {
                  console.error('❌ Failed to create order:', orderResult.error);
                  // Don't fail the payment completion if order creation fails
                }
              } catch (orderError) {
                console.error('❌ Error creating order for standard payment:', orderError);
                // Don't fail the payment completion if order creation fails
              }

              // Mark product as sold after successful standard payment status update
              try {
                const Product = require('../../../../db/models/productModel');
                const productDoc = await Product.findById(payment.product?._id || payment.product);
                if (productDoc && productDoc.status !== 'sold') {
                  await productDoc.updateStatus('sold', payment.seller._id, 'Marked as sold after standard payment status check');
                  console.log('🛍️ Product marked as sold (status-check):', productDoc._id.toString());
                }
              } catch (prodErr) {
                console.warn('⚠️ Failed to mark product as sold (status-check):', prodErr?.message);
              }
            } else {
              console.log('⚠️ No amount to credit (sellerAmount <= 0)');
            }
          } catch (walletError) {
            console.error('❌ Error crediting seller wallet:', walletError);
          }

        } else if (paymentStatus === 'failed' || paymentStatus === 'canceled') {
          console.log('❌ Payment failed/canceled by gateway');
          payment.status = 'payment_failed';
          payment.failedAt = new Date();
          await payment.save();
          statusChanged = true;
        }
      }
    } catch (gatewayError) {
      console.error('❌ Error checking payment status with gateway:', gatewayError);
      // Don't return error, just log it and continue
    }

    return successResponse(res, 'Payment status checked successfully', {
      payment,
      userRole: isBuyer ? 'buyer' : 'seller',
      statusChanged,
      gatewayStatus: paymentStatus
    });

  } catch (error) {
    console.error('Check standard payment status error:', error);
    return errorResponse(res, 'Failed to check payment status', 500);
  }
};
