const StandardPayment = require('../../../../db/models/standardPaymentModel');
const PaymentGateway = require('../../../../db/models/paymentGatewayModel');
const paymentGatewayFactory = require('../../../../services/payment/PaymentGatewayFactory');
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');
const { creditWalletInternal } = require('../../wallet/controllers/walletController');

/**
 * Handle payment gateway webhooks for standard payments
 */
exports.handleStandardPaymentWebhook = async (req, res) => {
  try {
    const { gateway } = req.params;
    const webhookData = req.body;
    const signature = req.headers['x-signature'] || req.headers['stripe-signature'] || req.headers['paypal-transmission-sig'];

    console.log(`📥 Standard payment webhook received from ${gateway}:`, {
      headers: req.headers,
      body: webhookData
    });

    // Get payment gateway service
    const gatewayService = paymentGatewayFactory.getGateway(gateway);
    if (!gatewayService) {
      console.error(`❌ Gateway ${gateway} not found`);
      return errorResponse(res, 'Gateway not found', 404);
    }

    // Process webhook
    const webhookResult = await gatewayService.handleWebhook(webhookData, signature);
    
    if (!webhookResult.success) {
      console.error(`❌ Webhook processing failed for ${gateway}:`, webhookResult.error);
      return errorResponse(res, 'Webhook processing failed', 400);
    }

    console.log(`✅ Standard payment webhook processed successfully for ${gateway}:`, webhookResult);

    // Handle different webhook events
    switch (webhookResult.eventType) {
      case 'payment_completed':
        await handleStandardPaymentCompleted(webhookResult);
        break;
      case 'payment_failed':
        await handleStandardPaymentFailed(webhookResult);
        break;
      case 'payment_cancelled':
        await handleStandardPaymentCancelled(webhookResult);
        break;
      case 'dispute_created':
        await handleStandardPaymentDispute(webhookResult);
        break;
      default:
        console.log(`ℹ️ Unhandled standard payment webhook event: ${webhookResult.eventType}`);
    }

    // Update gateway statistics
    await updateGatewayStatistics(gateway, webhookResult);

    return successResponse(res, 'Webhook processed successfully', {
      eventType: webhookResult.eventType,
      transactionId: webhookResult.transactionId
    });

  } catch (error) {
    console.error('Standard payment webhook error:', error);
    return errorResponse(res, 'Webhook processing failed', 500);
  }
};

/**
 * Handle successful standard payment webhook
 */
async function handleStandardPaymentCompleted(webhookResult) {
  try {
    const { transactionId, amount, currency, gatewayTransactionId, metadata } = webhookResult;

    // Find standard payment by gateway transaction ID or metadata
    let standardPayment;
    
    if (metadata?.paymentId) {
      standardPayment = await StandardPayment.findById(metadata.paymentId)
        .populate('buyer', 'firstName lastName email')
        .populate('seller', 'firstName lastName email')
        .populate('product', 'title');
    } else {
      standardPayment = await StandardPayment.findOne({
        gatewayTransactionId: transactionId
      })
      .populate('buyer', 'firstName lastName email')
      .populate('seller', 'firstName lastName email')
      .populate('product', 'title');
    }

    if (!standardPayment) {
      console.error(`❌ Standard payment not found for payment: ${transactionId}`);
      return;
    }

    // Update standard payment status
    if (standardPayment.status === 'processing') {
      standardPayment.status = 'completed';
      standardPayment.gatewayResponse = {
        ...standardPayment.gatewayResponse,
        completedAt: new Date(),
        finalAmount: amount,
        finalCurrency: currency,
        gatewayTransactionId: gatewayTransactionId
      };

      await standardPayment.save();

      console.log(`✅ Standard payment completed: ${standardPayment.transactionId}`);

      // Credit seller's wallet immediately for standard payments
      try {
        const sellerAmount = standardPayment.productPrice - (standardPayment.platformFeeAmount || 0);

        if (sellerAmount > 0) {
          const walletResult = await creditWalletInternal(
            standardPayment.seller._id,
            sellerAmount,
            standardPayment.currency,
            `Payment for product: ${standardPayment.product?.title || 'Product'}`,
            {
              relatedTransaction: standardPayment._id,
              relatedProduct: standardPayment.product,
              metadata: {
                transactionId: standardPayment.transactionId,
                originalAmount: standardPayment.productPrice,
                platformFee: standardPayment.platformFeeAmount,
                netAmount: sellerAmount,
                paymentType: 'standard'
              }
            }
          );

          if (walletResult.success) {
            console.log(`✅ Seller wallet credited for standard payment: ${standardPayment.currency} ${sellerAmount}`);

            // Mark product as sold
            try {
              const Product = require('../../../../db/models/productModel');
              const productDoc = await Product.findById(standardPayment.product?._id || standardPayment.product);
              if (productDoc && productDoc.status !== 'sold') {
                await productDoc.updateStatus('sold', standardPayment.seller._id, 'Marked as sold after standard payment (webhook)');
                console.log('🛍️ Product marked as sold (webhook-standard):', productDoc._id.toString());
              }
            } catch (prodErr) {
              console.warn('⚠️ Failed to mark product as sold (webhook-standard):', prodErr?.message);
            }

            // Create order for completed standard payment
            try {
              console.log('📦 Creating order for webhook-completed standard payment...');
              const OrderCreationService = require('../../../services/order/OrderCreationService');

              // Populate standard payment for order creation
              await standardPayment.populate([
                { path: 'buyer', select: 'firstName lastName email phoneNumber' },
                { path: 'seller', select: 'firstName lastName email phoneNumber' },
                { path: 'product', select: 'title price product_photos' }
              ]);

              const orderResult = await OrderCreationService.createOrderFromStandardPayment(standardPayment);

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
          } else {
            console.error('❌ Failed to credit seller wallet for standard payment:', walletResult.error);
          }
        }
      } catch (walletError) {
        console.error('❌ Error crediting seller wallet for standard payment:', walletError);
      }

      // TODO: Send notifications to buyer and seller
    }

  } catch (error) {
    console.error('Handle standard payment completed error:', error);
  }
}

/**
 * Handle failed standard payment webhook
 */
async function handleStandardPaymentFailed(webhookResult) {
  try {
    const { transactionId, error: paymentError, metadata } = webhookResult;

    // Find standard payment
    let standardPayment;
    
    if (metadata?.paymentId) {
      standardPayment = await StandardPayment.findById(metadata.paymentId);
    } else {
      standardPayment = await StandardPayment.findOne({
        gatewayTransactionId: transactionId
      });
    }

    if (!standardPayment) {
      console.error(`❌ Standard payment not found for failed payment: ${transactionId}`);
      return;
    }

    // Update standard payment status
    if (standardPayment.status === 'processing') {
      standardPayment.status = 'failed';
      standardPayment.gatewayResponse = {
        ...standardPayment.gatewayResponse,
        failedAt: new Date(),
        error: paymentError
      };

      await standardPayment.save();

      console.log(`❌ Standard payment failed: ${standardPayment.transactionId}`);

      // TODO: Send notification to buyer about payment failure
    }

  } catch (error) {
    console.error('Handle standard payment failed error:', error);
  }
}

/**
 * Handle cancelled standard payment webhook
 */
async function handleStandardPaymentCancelled(webhookResult) {
  try {
    const { transactionId, metadata } = webhookResult;

    // Find standard payment
    let standardPayment;
    
    if (metadata?.paymentId) {
      standardPayment = await StandardPayment.findById(metadata.paymentId);
    } else {
      standardPayment = await StandardPayment.findOne({
        gatewayTransactionId: transactionId
      });
    }

    if (!standardPayment) {
      console.error(`❌ Standard payment not found for cancelled payment: ${transactionId}`);
      return;
    }

    // Update standard payment status
    if (standardPayment.status === 'processing') {
      standardPayment.status = 'cancelled';
      standardPayment.gatewayResponse = {
        ...standardPayment.gatewayResponse,
        cancelledAt: new Date()
      };

      await standardPayment.save();

      console.log(`🚫 Standard payment cancelled: ${standardPayment.transactionId}`);

      // TODO: Send notification to buyer about payment cancellation
    }

  } catch (error) {
    console.error('Handle standard payment cancelled error:', error);
  }
}

/**
 * Handle dispute created for standard payment
 */
async function handleStandardPaymentDispute(webhookResult) {
  try {
    const { transactionId, disputeReason, metadata } = webhookResult;

    // Find standard payment
    let standardPayment;
    
    if (metadata?.paymentId) {
      standardPayment = await StandardPayment.findById(metadata.paymentId);
    } else {
      standardPayment = await StandardPayment.findOne({
        gatewayTransactionId: transactionId
      });
    }

    if (!standardPayment) {
      console.error(`❌ Standard payment not found for dispute: ${transactionId}`);
      return;
    }

    // Update standard payment status
    standardPayment.status = 'disputed';
    standardPayment.gatewayResponse = {
      ...standardPayment.gatewayResponse,
      disputedAt: new Date(),
      disputeReason: disputeReason
    };

    await standardPayment.save();

    console.log(`⚠️ Standard payment disputed: ${standardPayment.transactionId}`);

    // TODO: Handle dispute process
    // TODO: Send notifications to relevant parties

  } catch (error) {
    console.error('Handle standard payment dispute error:', error);
  }
}

/**
 * Update payment gateway statistics
 */
async function updateGatewayStatistics(gatewayName, webhookResult) {
  try {
    const gateway = await PaymentGateway.findOne({ gatewayName });
    if (!gateway) return;

    const isSuccess = webhookResult.eventType === 'payment_completed';
    const amount = webhookResult.amount || 0;

    await gateway.updateStatistics(isSuccess, amount);

  } catch (error) {
    console.error('Update gateway statistics error:', error);
  }
}
