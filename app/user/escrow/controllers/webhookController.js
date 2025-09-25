const EscrowTransaction = require('../../../../db/models/escrowTransactionModel');
const PaymentGateway = require('../../../../db/models/paymentGatewayModel');
const paymentGatewayFactory = require('../../../../services/payment/PaymentGatewayFactory');
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');
const { creditWalletInternal } = require('../../wallet/controllers/walletController');

/**
 * Handle payment gateway webhooks
 */
exports.handlePaymentWebhook = async (req, res) => {
  try {
    const { gateway } = req.params;
    const webhookData = req.body;
    const signature = req.headers['x-signature'] || req.headers['stripe-signature'] || req.headers['paypal-transmission-sig'];

    console.log(`📥 Webhook received from ${gateway}:`, {
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

    console.log(`✅ Webhook processed successfully for ${gateway}:`, webhookResult);

    // Handle different webhook events
    switch (webhookResult.eventType) {
      case 'payment_completed':
        await handlePaymentCompleted(webhookResult);
        break;
      case 'payment_failed':
        await handlePaymentFailed(webhookResult);
        break;
      case 'payment_cancelled':
        await handlePaymentCancelled(webhookResult);
        break;
      case 'dispute_created':
        await handleDisputeCreated(webhookResult);
        break;
      default:
        console.log(`ℹ️ Unhandled webhook event: ${webhookResult.eventType}`);
    }

    // Update gateway statistics
    await updateGatewayStatistics(gateway, webhookResult);

    return successResponse(res, 'Webhook processed successfully', {
      eventType: webhookResult.eventType,
      transactionId: webhookResult.transactionId
    });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return errorResponse(res, 'Webhook processing failed', 500);
  }
};

/**
 * Handle successful payment webhook
 */
async function handlePaymentCompleted(webhookResult) {
  try {
    const { transactionId, amount, currency, gatewayTransactionId, metadata } = webhookResult;

    // Find escrow transaction by gateway transaction ID or metadata
    let escrowTransaction;
    
    if (metadata?.escrow_transaction_id) {
      escrowTransaction = await EscrowTransaction.findById(metadata.escrow_transaction_id);
    } else {
      escrowTransaction = await EscrowTransaction.findOne({
        gatewayTransactionId: transactionId
      });
    }

    if (!escrowTransaction) {
      console.error(`❌ Escrow transaction not found for payment: ${transactionId}`);
      return;
    }

    // Update escrow transaction status
    if (escrowTransaction.status === 'payment_processing') {
      escrowTransaction.status = 'funds_held';
      escrowTransaction.gatewayResponse = {
        ...escrowTransaction.gatewayResponse,
        completedAt: new Date(),
        finalAmount: amount,
        finalCurrency: currency,
        gatewayTransactionId: gatewayTransactionId
      };

      await escrowTransaction.save();

      console.log(`✅ Payment completed for escrow transaction: ${escrowTransaction.transactionId}`);

      // Mark product as sold
      try {
        const Product = require('../../../../db/models/productModel');
        const productDoc = await Product.findById(escrowTransaction.product?._id || escrowTransaction.product);
        if (productDoc && productDoc.status !== 'sold') {
          await productDoc.updateStatus('sold', escrowTransaction.seller, 'Marked as sold after escrow payment (webhook)');
          console.log('🛍️ Product marked as sold (webhook-escrow):', productDoc._id.toString());
        }
      } catch (prodErr) {
        console.warn('⚠️ Failed to mark product as sold (webhook-escrow):', prodErr?.message);
      }

      // TODO: Send notifications to buyer and seller
    }

  } catch (error) {
    console.error('Handle payment completed error:', error);
  }
}

/**
 * Handle failed payment webhook
 */
async function handlePaymentFailed(webhookResult) {
  try {
    const { transactionId, error: paymentError, metadata } = webhookResult;

    // Find escrow transaction
    let escrowTransaction;
    
    if (metadata?.escrow_transaction_id) {
      escrowTransaction = await EscrowTransaction.findById(metadata.escrow_transaction_id);
    } else {
      escrowTransaction = await EscrowTransaction.findOne({
        gatewayTransactionId: transactionId
      });
    }

    if (!escrowTransaction) {
      console.error(`❌ Escrow transaction not found for failed payment: ${transactionId}`);
      return;
    }

    // Update escrow transaction status
    if (escrowTransaction.status === 'payment_processing') {
      escrowTransaction.status = 'payment_failed';
      escrowTransaction.gatewayResponse = {
        ...escrowTransaction.gatewayResponse,
        failedAt: new Date(),
        error: paymentError
      };

      await escrowTransaction.save();

      console.log(`❌ Payment failed for escrow transaction: ${escrowTransaction.transactionId}`);

      // TODO: Send notification to buyer about payment failure
    }

  } catch (error) {
    console.error('Handle payment failed error:', error);
  }
}

/**
 * Handle cancelled payment webhook
 */
async function handlePaymentCancelled(webhookResult) {
  try {
    const { transactionId, metadata } = webhookResult;

    // Find escrow transaction
    let escrowTransaction;
    
    if (metadata?.escrow_transaction_id) {
      escrowTransaction = await EscrowTransaction.findById(metadata.escrow_transaction_id);
    } else {
      escrowTransaction = await EscrowTransaction.findOne({
        gatewayTransactionId: transactionId
      });
    }

    if (!escrowTransaction) {
      console.error(`❌ Escrow transaction not found for cancelled payment: ${transactionId}`);
      return;
    }

    // Update escrow transaction status
    if (escrowTransaction.status === 'payment_processing') {
      escrowTransaction.status = 'cancelled';
      escrowTransaction.gatewayResponse = {
        ...escrowTransaction.gatewayResponse,
        cancelledAt: new Date()
      };

      await escrowTransaction.save();

      console.log(`🚫 Payment cancelled for escrow transaction: ${escrowTransaction.transactionId}`);

      // TODO: Send notification to buyer about payment cancellation
    }

  } catch (error) {
    console.error('Handle payment cancelled error:', error);
  }
}

/**
 * Handle dispute created webhook
 */
async function handleDisputeCreated(webhookResult) {
  try {
    const { transactionId, disputeReason, metadata } = webhookResult;

    // Find escrow transaction
    let escrowTransaction;
    
    if (metadata?.escrow_transaction_id) {
      escrowTransaction = await EscrowTransaction.findById(metadata.escrow_transaction_id);
    } else {
      escrowTransaction = await EscrowTransaction.findOne({
        gatewayTransactionId: transactionId
      });
    }

    if (!escrowTransaction) {
      console.error(`❌ Escrow transaction not found for dispute: ${transactionId}`);
      return;
    }

    // Update escrow transaction status
    escrowTransaction.status = 'disputed';
    escrowTransaction.disputeDetails.disputeReason = disputeReason;
    escrowTransaction.disputeDetails.disputeRaisedAt = new Date();
    escrowTransaction.gatewayResponse = {
      ...escrowTransaction.gatewayResponse,
      disputeCreatedAt: new Date(),
      disputeReason: disputeReason
    };

    await escrowTransaction.save();

    console.log(`⚠️ Dispute created for escrow transaction: ${escrowTransaction.transactionId}`);

    // TODO: Send notifications to both buyer and seller
    // TODO: Trigger dispute resolution process

  } catch (error) {
    console.error('Handle dispute created error:', error);
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

/**
 * Verify payment status manually
 */
exports.verifyPaymentStatus = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const userId = req.user._id;

    const escrowTransaction = await EscrowTransaction.findById(transactionId);
    if (!escrowTransaction) {
      return errorResponse(res, 'Escrow transaction not found', 404);
    }

    // Check if user is buyer or seller
    const isBuyer = escrowTransaction.buyer.toString() === userId.toString();
    const isSeller = escrowTransaction.seller.toString() === userId.toString();

    if (!isBuyer && !isSeller) {
      return errorResponse(res, 'Unauthorized access to this transaction', 403);
    }

    // Get payment gateway service
    const gatewayService = paymentGatewayFactory.getGateway(escrowTransaction.paymentGateway);
    if (!gatewayService) {
      return errorResponse(res, 'Payment gateway not available', 400);
    }

    // Verify payment with gateway
    const verificationResult = await gatewayService.verifyPayment(escrowTransaction.gatewayTransactionId);

    if (verificationResult.success) {
      // Update escrow transaction if status changed
      if (verificationResult.status !== escrowTransaction.status) {
        const statusMap = {
          'completed': 'funds_held',
          'failed': 'payment_failed',
          'cancelled': 'cancelled',
          'processing': 'payment_processing'
        };

        const newStatus = statusMap[verificationResult.status] || escrowTransaction.status;
        
        if (newStatus !== escrowTransaction.status) {
          await escrowTransaction.updateStatus(newStatus, 'Status updated via manual verification');
        }
      }

      return successResponse(res, 'Payment status verified successfully', {
        transactionId: escrowTransaction.transactionId,
        status: escrowTransaction.status,
        gatewayStatus: verificationResult.status,
        verificationResult
      });
    } else {
      return errorResponse(res, verificationResult.error || 'Payment verification failed', 400);
    }

  } catch (error) {
    console.error('Verify payment status error:', error);
    return errorResponse(res, 'Failed to verify payment status', 500);
  }
};

module.exports = exports;
