const crypto = require('crypto');
const WithdrawalTransaction = require('../../../db/models/withdrawalTransactionModel');
const Wallet = require('../../../db/models/walletModel');
const { successResponse, errorResponse } = require('../../../utils/responseHandler');

/**
 * Handle PayPal webhook events
 * POST /webhooks/paypal
 */
exports.handlePayPalWebhook = async (req, res) => {
  try {
    console.log('🔔 PayPal webhook received:', {
      eventType: req.body.event_type,
      resourceType: req.body.resource_type,
      summary: req.body.summary
    });

    // Verify webhook signature (if configured)
    if (process.env.PAYPAL_WEBHOOK_ID) {
      const isValid = await verifyPayPalWebhookSignature(req);
      if (!isValid) {
        console.error('❌ Invalid PayPal webhook signature');
        return errorResponse(res, 'Invalid webhook signature', 401);
      }
    }

    const { event_type, resource } = req.body;

    // Handle different PayPal webhook events
    switch (event_type) {
      case 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED':
        await handlePayoutItemSucceeded(resource);
        break;
      
      case 'PAYMENT.PAYOUTS-ITEM.FAILED':
        await handlePayoutItemFailed(resource);
        break;
      
      case 'PAYMENT.PAYOUTS-ITEM.BLOCKED':
        await handlePayoutItemBlocked(resource);
        break;
      
      case 'PAYMENT.PAYOUTS-ITEM.RETURNED':
        await handlePayoutItemReturned(resource);
        break;
      
      case 'PAYMENT.PAYOUTS-ITEM.REFUNDED':
        await handlePayoutItemRefunded(resource);
        break;
      
      default:
        console.log('ℹ️ Unhandled PayPal webhook event:', event_type);
    }

    return successResponse(res, 'Webhook processed successfully');

  } catch (error) {
    console.error('❌ PayPal webhook error:', error);
    return errorResponse(res, 'Webhook processing failed', 500);
  }
};

/**
 * Handle successful payout item
 */
const handlePayoutItemSucceeded = async (resource) => {
  try {
    console.log('✅ Processing payout item succeeded:', resource.payout_item_id);

    // Find withdrawal transaction by payout item ID
    const withdrawalTransaction = await WithdrawalTransaction.findOne({
      providerItemId: resource.payout_item_id
    });

    if (!withdrawalTransaction) {
      console.error('❌ Withdrawal transaction not found for payout item:', resource.payout_item_id);
      return;
    }

    // Update transaction status
    await withdrawalTransaction.updateStatus('completed', 'Payout completed successfully', 'webhook');
    
    // Update provider transaction ID
    withdrawalTransaction.providerTransactionId = resource.transaction_id;
    withdrawalTransaction.completedAt = new Date();
    withdrawalTransaction.metadata.webhookData = resource;
    await withdrawalTransaction.save();

    console.log('✅ Withdrawal transaction marked as completed:', withdrawalTransaction.transactionId);

  } catch (error) {
    console.error('❌ Error handling payout item succeeded:', error);
  }
};

/**
 * Handle failed payout item
 */
const handlePayoutItemFailed = async (resource) => {
  try {
    console.log('❌ Processing payout item failed:', resource.payout_item_id);

    // Find withdrawal transaction by payout item ID
    const withdrawalTransaction = await WithdrawalTransaction.findOne({
      providerItemId: resource.payout_item_id
    });

    if (!withdrawalTransaction) {
      console.error('❌ Withdrawal transaction not found for payout item:', resource.payout_item_id);
      return;
    }

    // Set error information
    const errorMessage = resource.errors?.[0]?.message || 'Payout failed';
    const errorCode = resource.errors?.[0]?.name || 'PAYOUT_FAILED';
    
    await withdrawalTransaction.setError(errorCode, errorMessage, resource);

    // Refund the amount back to user's wallet
    const wallet = await Wallet.findOne({ user: withdrawalTransaction.user });
    if (wallet) {
      await wallet.creditAmount(withdrawalTransaction.netAmount, withdrawalTransaction.currency, {
        type: 'withdrawal_refund',
        description: `Refund for failed PayPal payout: ${errorMessage}`,
        metadata: {
          originalTransactionId: withdrawalTransaction.transactionId,
          refundReason: errorMessage,
          paypalPayoutItemId: resource.payout_item_id
        }
      });

      console.log('💰 Refunded amount to wallet:', {
        userId: withdrawalTransaction.user,
        amount: withdrawalTransaction.netAmount,
        currency: withdrawalTransaction.currency
      });
    }

    console.log('❌ Withdrawal transaction marked as failed:', withdrawalTransaction.transactionId);

  } catch (error) {
    console.error('❌ Error handling payout item failed:', error);
  }
};

/**
 * Handle blocked payout item
 */
const handlePayoutItemBlocked = async (resource) => {
  try {
    console.log('🚫 Processing payout item blocked:', resource.payout_item_id);

    const withdrawalTransaction = await WithdrawalTransaction.findOne({
      providerItemId: resource.payout_item_id
    });

    if (!withdrawalTransaction) {
      console.error('❌ Withdrawal transaction not found for payout item:', resource.payout_item_id);
      return;
    }

    const errorMessage = 'Payout blocked by PayPal';
    await withdrawalTransaction.setError('PAYOUT_BLOCKED', errorMessage, resource);

    // Refund the amount back to user's wallet
    const wallet = await Wallet.findOne({ user: withdrawalTransaction.user });
    if (wallet) {
      await wallet.creditAmount(withdrawalTransaction.netAmount, withdrawalTransaction.currency, {
        type: 'withdrawal_refund',
        description: `Refund for blocked PayPal payout`,
        metadata: {
          originalTransactionId: withdrawalTransaction.transactionId,
          refundReason: errorMessage,
          paypalPayoutItemId: resource.payout_item_id
        }
      });
    }

    console.log('🚫 Withdrawal transaction marked as blocked:', withdrawalTransaction.transactionId);

  } catch (error) {
    console.error('❌ Error handling payout item blocked:', error);
  }
};

/**
 * Handle returned payout item
 */
const handlePayoutItemReturned = async (resource) => {
  try {
    console.log('↩️ Processing payout item returned:', resource.payout_item_id);

    const withdrawalTransaction = await WithdrawalTransaction.findOne({
      providerItemId: resource.payout_item_id
    });

    if (!withdrawalTransaction) {
      console.error('❌ Withdrawal transaction not found for payout item:', resource.payout_item_id);
      return;
    }

    const errorMessage = 'Payout returned by PayPal';
    await withdrawalTransaction.setError('PAYOUT_RETURNED', errorMessage, resource);

    // Refund the amount back to user's wallet
    const wallet = await Wallet.findOne({ user: withdrawalTransaction.user });
    if (wallet) {
      await wallet.creditAmount(withdrawalTransaction.netAmount, withdrawalTransaction.currency, {
        type: 'withdrawal_refund',
        description: `Refund for returned PayPal payout`,
        metadata: {
          originalTransactionId: withdrawalTransaction.transactionId,
          refundReason: errorMessage,
          paypalPayoutItemId: resource.payout_item_id
        }
      });
    }

    console.log('↩️ Withdrawal transaction marked as returned:', withdrawalTransaction.transactionId);

  } catch (error) {
    console.error('❌ Error handling payout item returned:', error);
  }
};

/**
 * Handle refunded payout item
 */
const handlePayoutItemRefunded = async (resource) => {
  try {
    console.log('🔄 Processing payout item refunded:', resource.payout_item_id);

    const withdrawalTransaction = await WithdrawalTransaction.findOne({
      providerItemId: resource.payout_item_id
    });

    if (!withdrawalTransaction) {
      console.error('❌ Withdrawal transaction not found for payout item:', resource.payout_item_id);
      return;
    }

    await withdrawalTransaction.updateStatus('refunded', 'Payout refunded by PayPal', 'webhook');
    withdrawalTransaction.metadata.webhookData = resource;
    await withdrawalTransaction.save();

    // Refund the amount back to user's wallet
    const wallet = await Wallet.findOne({ user: withdrawalTransaction.user });
    if (wallet) {
      await wallet.creditAmount(withdrawalTransaction.netAmount, withdrawalTransaction.currency, {
        type: 'withdrawal_refund',
        description: `Refund for PayPal payout refund`,
        metadata: {
          originalTransactionId: withdrawalTransaction.transactionId,
          refundReason: 'PayPal payout refunded',
          paypalPayoutItemId: resource.payout_item_id
        }
      });
    }

    console.log('🔄 Withdrawal transaction marked as refunded:', withdrawalTransaction.transactionId);

  } catch (error) {
    console.error('❌ Error handling payout item refunded:', error);
  }
};

/**
 * Verify PayPal webhook signature
 */
const verifyPayPalWebhookSignature = async (req) => {
  try {
    // This is a simplified version - in production, you should use PayPal's SDK
    // to properly verify webhook signatures
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    const signature = req.headers['paypal-transmission-sig'];
    const certId = req.headers['paypal-cert-id'];
    const timestamp = req.headers['paypal-transmission-time'];
    
    if (!signature || !certId || !timestamp) {
      return false;
    }

    // For now, we'll skip signature verification in development
    // In production, implement proper PayPal webhook signature verification
    if (process.env.NODE_ENV === 'development') {
      return true;
    }

    // TODO: Implement proper PayPal webhook signature verification
    // using PayPal SDK or manual verification process
    return true;

  } catch (error) {
    console.error('❌ Error verifying PayPal webhook signature:', error);
    return false;
  }
};

/**
 * Get webhook events (for debugging)
 * GET /webhooks/paypal/events
 */
exports.getWebhookEvents = async (req, res) => {
  try {
    // This could be used to list recent webhook events for debugging
    // You might want to store webhook events in a separate collection
    
    return successResponse(res, 'Webhook events endpoint', {
      message: 'This endpoint can be used to retrieve webhook event history'
    });

  } catch (error) {
    console.error('❌ Get webhook events error:', error);
    return errorResponse(res, 'Failed to get webhook events', 500);
  }
};