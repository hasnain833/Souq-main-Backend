const stripe = require('stripe');
const Wallet = require('../../../../db/models/walletModel');
const PaymentGateway = require('../../../../db/models/paymentGatewayModel');
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');

/**
 * Handle Stripe payout webhooks
 */
exports.handleStripePayoutWebhook = async (req, res) => {
  try {
    console.log('🔔 Stripe payout webhook received');

    // Get Stripe configuration
    const stripeGateway = await PaymentGateway.findOne({ 
      gatewayName: 'stripe', 
      isActive: true 
    });

    if (!stripeGateway) {
      console.error('❌ Stripe gateway configuration not found');
      return res.status(400).send('Stripe configuration not found');
    }

    const webhookSecret = stripeGateway.configuration?.stripe?.webhookSecret;
    if (!webhookSecret) {
      console.error('❌ Stripe webhook secret not configured');
      return res.status(400).send('Webhook secret not configured');
    }

    const sig = req.headers['stripe-signature'];
    let event;

    try {
      // Initialize Stripe with secret key
      const stripeInstance = stripe(stripeGateway.configuration.stripe.secretKey);
      
      // Verify webhook signature
      event = stripeInstance.webhooks.constructEvent(req.body, sig, webhookSecret);
      console.log('✅ Webhook signature verified:', event.type);
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case 'payout.paid':
        await handlePayoutPaid(event.data.object);
        break;
      case 'payout.failed':
        await handlePayoutFailed(event.data.object);
        break;
      case 'payout.pending':
        await handlePayoutPending(event.data.object);
        break;
      case 'payout.in_transit':
        await handlePayoutInTransit(event.data.object);
        break;
      case 'payout.canceled':
        await handlePayoutCanceled(event.data.object);
        break;
      default:
        console.log(`🔔 Unhandled payout event type: ${event.type}`);
    }

    res.json({ received: true });

  } catch (error) {
    console.error('❌ Stripe payout webhook error:', error);
    res.status(500).send('Webhook processing failed');
  }
};

/**
 * Handle payout paid event
 */
async function handlePayoutPaid(payout) {
  try {
    console.log('✅ Processing payout.paid event:', payout.id);

    const userId = payout.metadata?.user_id;
    const walletTransactionId = payout.metadata?.wallet_transaction_id;

    if (!userId || !walletTransactionId) {
      console.error('❌ Missing metadata in payout:', { userId, walletTransactionId });
      return;
    }

    // Find wallet and transaction
    const wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      console.error('❌ Wallet not found for user:', userId);
      return;
    }

    const transaction = wallet.transactions.find(t => 
      t.transactionId === walletTransactionId || 
      t.metadata?.stripePayoutId === payout.id
    );

    if (!transaction) {
      console.error('❌ Transaction not found:', walletTransactionId);
      return;
    }

    // Update transaction status
    transaction.metadata.payoutStatus = 'paid';
    transaction.metadata.status = 'completed';
    transaction.metadata.completedAt = new Date();
    transaction.metadata.arrivalDate = payout.arrival_date ? new Date(payout.arrival_date * 1000) : new Date();

    await wallet.save();

    console.log('✅ Payout marked as paid:', {
      payoutId: payout.id,
      transactionId: walletTransactionId,
      amount: payout.amount / 100,
      currency: payout.currency
    });

  } catch (error) {
    console.error('❌ Error handling payout.paid:', error);
  }
}

/**
 * Handle payout failed event
 */
async function handlePayoutFailed(payout) {
  try {
    console.log('❌ Processing payout.failed event:', payout.id);

    const userId = payout.metadata?.user_id;
    const walletTransactionId = payout.metadata?.wallet_transaction_id;

    if (!userId || !walletTransactionId) {
      console.error('❌ Missing metadata in payout:', { userId, walletTransactionId });
      return;
    }

    // Find wallet and transaction
    const wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      console.error('❌ Wallet not found for user:', userId);
      return;
    }

    const transaction = wallet.transactions.find(t => 
      t.transactionId === walletTransactionId || 
      t.metadata?.stripePayoutId === payout.id
    );

    if (!transaction) {
      console.error('❌ Transaction not found:', walletTransactionId);
      return;
    }

    // Update transaction status
    transaction.metadata.payoutStatus = 'failed';
    transaction.metadata.status = 'failed';
    transaction.metadata.failedAt = new Date();
    transaction.metadata.failureCode = payout.failure_code;
    transaction.metadata.failureMessage = payout.failure_message;

    // Credit back the amount to wallet (reverse the withdrawal)
    const currency = transaction.currency;
    const amount = transaction.amount;
    const currentBalance = wallet.balances[currency] || 0;
    wallet.balances[currency] = currentBalance + amount;

    // Reverse withdrawal tracking
    wallet.withdrawalTracking.dailyWithdrawn -= amount;
    wallet.withdrawalTracking.monthlyWithdrawn -= amount;

    await wallet.save();

    console.log('✅ Payout marked as failed and amount credited back:', {
      payoutId: payout.id,
      transactionId: walletTransactionId,
      amount: amount,
      currency: currency,
      failureCode: payout.failure_code,
      failureMessage: payout.failure_message
    });

  } catch (error) {
    console.error('❌ Error handling payout.failed:', error);
  }
}

/**
 * Handle payout pending event
 */
async function handlePayoutPending(payout) {
  try {
    console.log('⏳ Processing payout.pending event:', payout.id);

    const userId = payout.metadata?.user_id;
    const walletTransactionId = payout.metadata?.wallet_transaction_id;

    if (!userId || !walletTransactionId) {
      console.error('❌ Missing metadata in payout:', { userId, walletTransactionId });
      return;
    }

    // Find wallet and transaction
    const wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      console.error('❌ Wallet not found for user:', userId);
      return;
    }

    const transaction = wallet.transactions.find(t => 
      t.transactionId === walletTransactionId || 
      t.metadata?.stripePayoutId === payout.id
    );

    if (!transaction) {
      console.error('❌ Transaction not found:', walletTransactionId);
      return;
    }

    // Update transaction status
    transaction.metadata.payoutStatus = 'pending';
    transaction.metadata.status = 'pending';
    transaction.metadata.estimatedArrival = payout.arrival_date ? new Date(payout.arrival_date * 1000) : null;

    await wallet.save();

    console.log('✅ Payout status updated to pending:', {
      payoutId: payout.id,
      transactionId: walletTransactionId,
      estimatedArrival: transaction.metadata.estimatedArrival
    });

  } catch (error) {
    console.error('❌ Error handling payout.pending:', error);
  }
}

/**
 * Handle payout in transit event
 */
async function handlePayoutInTransit(payout) {
  try {
    console.log('🚚 Processing payout.in_transit event:', payout.id);

    const userId = payout.metadata?.user_id;
    const walletTransactionId = payout.metadata?.wallet_transaction_id;

    if (!userId || !walletTransactionId) {
      console.error('❌ Missing metadata in payout:', { userId, walletTransactionId });
      return;
    }

    // Find wallet and transaction
    const wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      console.error('❌ Wallet not found for user:', userId);
      return;
    }

    const transaction = wallet.transactions.find(t => 
      t.transactionId === walletTransactionId || 
      t.metadata?.stripePayoutId === payout.id
    );

    if (!transaction) {
      console.error('❌ Transaction not found:', walletTransactionId);
      return;
    }

    // Update transaction status
    transaction.metadata.payoutStatus = 'in_transit';
    transaction.metadata.status = 'in_transit';

    await wallet.save();

    console.log('✅ Payout status updated to in_transit:', {
      payoutId: payout.id,
      transactionId: walletTransactionId
    });

  } catch (error) {
    console.error('❌ Error handling payout.in_transit:', error);
  }
}

/**
 * Handle payout canceled event
 */
async function handlePayoutCanceled(payout) {
  try {
    console.log('❌ Processing payout.canceled event:', payout.id);

    const userId = payout.metadata?.user_id;
    const walletTransactionId = payout.metadata?.wallet_transaction_id;

    if (!userId || !walletTransactionId) {
      console.error('❌ Missing metadata in payout:', { userId, walletTransactionId });
      return;
    }

    // Find wallet and transaction
    const wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      console.error('❌ Wallet not found for user:', userId);
      return;
    }

    const transaction = wallet.transactions.find(t => 
      t.transactionId === walletTransactionId || 
      t.metadata?.stripePayoutId === payout.id
    );

    if (!transaction) {
      console.error('❌ Transaction not found:', walletTransactionId);
      return;
    }

    // Update transaction status
    transaction.metadata.payoutStatus = 'canceled';
    transaction.metadata.status = 'canceled';
    transaction.metadata.canceledAt = new Date();

    // Credit back the amount to wallet (reverse the withdrawal)
    const currency = transaction.currency;
    const amount = transaction.amount;
    const currentBalance = wallet.balances[currency] || 0;
    wallet.balances[currency] = currentBalance + amount;

    // Reverse withdrawal tracking
    wallet.withdrawalTracking.dailyWithdrawn -= amount;
    wallet.withdrawalTracking.monthlyWithdrawn -= amount;

    await wallet.save();

    console.log('✅ Payout marked as canceled and amount credited back:', {
      payoutId: payout.id,
      transactionId: walletTransactionId,
      amount: amount,
      currency: currency
    });

  } catch (error) {
    console.error('❌ Error handling payout.canceled:', error);
  }
}
