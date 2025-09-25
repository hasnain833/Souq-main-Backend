const Wallet = require('../../../../db/models/walletModel');
const BankAccount = require('../../../../db/models/bankAccountModel');
const PaypalAccount = require('../../../../db/models/paypalAccountModel');
const PaymentGateway = require('../../../../db/models/paymentGatewayModel');
const StripePayoutService = require('../../../../services/payout/StripePayoutService');
const PayPalPayoutService = require('../../../../services/payout/PayPalPayoutService');
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');
const currencyService = require('../../../../services/currency/CurrencyService');
// const PaymentCompletionService = require('../../../../services/payment/PaymentCompletionService'); // Removed to avoid circular dependency
const { findEscrowTransaction, findStandardPayment, findTransaction } = require('../../../../utils/transactionUtils');
const { creditWalletExternal } = require('../../../../utils/walletUtils');

/**
 * Comprehensive transaction finder that searches across all possible locations
 */
const findTransactionComprehensive = async (identifier) => {
  try {
    console.log(`🔍 Comprehensive search for identifier: ${identifier}`);
    console.log(`🔍 Identifier type: ${typeof identifier}, length: ${identifier?.length}`);

    // Check if it's a valid ObjectId
    const mongoose = require('mongoose');
    const isValidObjectId = mongoose.Types.ObjectId.isValid(identifier) && /^[0-9a-fA-F]{24}$/.test(identifier);
    console.log(`🔍 Is valid ObjectId: ${isValidObjectId}`);

    // Import models
    const Order = require('../../../../db/models/orderModel');
    const EscrowTransaction = require('../../../../db/models/escrowTransactionModel');
    const StandardPayment = require('../../../../db/models/standardPaymentModel');

    // Method 1: Direct search in escrow transactions using utility function
    console.log('🔍 Method 1: Direct escrow transaction search');
    let escrowTransaction = await findEscrowTransaction(identifier);

    if (escrowTransaction) {
      console.log(`✅ Found escrow transaction directly: ${escrowTransaction._id}`);
      return {
        transaction: escrowTransaction,
        type: 'escrow',
        source: 'escrowtransactions_direct'
      };
    }

    // Method 2: Find by order and then find corresponding escrow transaction
    console.log('🔍 Method 2: Find order and corresponding escrow transaction');
    let order = null;

    // Try to find order by various identifiers
    if (isValidObjectId) { // Only search by _id if it's a valid ObjectId
      order = await Order.findById(identifier).populate('buyer seller product');
    }

    if (!order) {
      order = await Order.findOne({
        $or: [
          { orderNumber: identifier },
          { 'payment.transactionId': identifier }
        ]
      }).populate('buyer seller product');
    }

    if (order && order.type === 'escrow') {
      console.log(`✅ Found escrow order: ${order._id}, orderNumber: ${order.orderNumber}`);

      // Now find the corresponding escrow transaction
      escrowTransaction = await EscrowTransaction.findOne({
        $or: [
          { transactionId: order.orderNumber },
          { transactionId: order.payment?.transactionId },
          { gatewayTransactionId: order.payment?.transactionId },
          // Try to match by buyer, seller, and product
          {
            buyer: order.buyer._id,
            seller: order.seller._id,
            product: order.product._id
          }
        ]
      }).populate('buyer seller product');

      if (escrowTransaction) {
        console.log(`✅ Found corresponding escrow transaction: ${escrowTransaction._id}`);
        return {
          transaction: escrowTransaction,
          type: 'escrow',
          source: 'escrowtransactions_via_order'
        };
      } else {
        console.log(`⚠️ Order found but no corresponding escrow transaction`);
        console.log(`⚠️ Order details: buyer=${order.buyer._id}, seller=${order.seller._id}, product=${order.product._id}`);

        // Create a virtual escrow transaction from order data for processing
        const virtualEscrowTransaction = {
          _id: order._id,
          transactionId: order.orderNumber,
          gatewayTransactionId: order.payment?.transactionId,
          buyer: order.buyer,
          seller: order.seller,
          product: order.product,
          productPrice: order.orderDetails?.productPrice || order.product?.price,
          currency: order.orderDetails?.currency || 'USD',
          status: order.payment?.status === 'completed' ? 'completed' : 'payment_processing',
          createdAt: order.createdAt,
          updatedAt: order.updatedAt
        };

        console.log(`✅ Created virtual escrow transaction from order data`);
        return {
          transaction: virtualEscrowTransaction,
          type: 'escrow',
          source: 'virtual_from_order'
        };
      }
    }

    // Method 3: Search in standard payments using utility function
    console.log('🔍 Method 3: Standard payment search');
    const standardPayment = await findStandardPayment(identifier);

    if (standardPayment) {
      console.log(`✅ Found standard payment: ${standardPayment._id}`);
      return {
        transaction: standardPayment,
        type: 'standard',
        source: 'standardpayments'
      };
    }

    // Method 4: Search in main transactions table using utility function
    console.log('🔍 Method 4: Main transactions table search');
    const mainTransaction = await findTransaction(identifier);

    if (mainTransaction) {
      console.log(`✅ Found main transaction: ${mainTransaction._id}`);
      const type = mainTransaction.escrowTransaction ? 'escrow' : 'standard';
      return {
        transaction: mainTransaction,
        type: type,
        source: 'transactions'
      };
    }

    // Method 5: Direct ObjectId search in all collections
    if (isValidObjectId) {
      console.log('🔍 Method 5: Direct ObjectId search in all collections');

      try {
        // Try EscrowTransaction by _id
        console.log('🔍 Searching EscrowTransaction by _id...');
        const escrowById = await EscrowTransaction.findById(identifier)
          .populate('buyer', 'firstName lastName email')
          .populate('seller', 'firstName lastName email')
          .populate('product', 'title price product_photos');

        if (escrowById) {
          console.log(`✅ Found EscrowTransaction by _id: ${escrowById._id}`);
          return {
            transaction: escrowById,
            type: 'escrow',
            source: 'escrowtransactions_by_id'
          };
        }

        // Try StandardPayment by _id
        console.log('🔍 Searching StandardPayment by _id...');
        const standardById = await StandardPayment.findById(identifier)
          .populate('buyer', 'firstName lastName email')
          .populate('seller', 'firstName lastName email')
          .populate('product', 'title price product_photos');

        if (standardById) {
          console.log(`✅ Found StandardPayment by _id: ${standardById._id}`);
          return {
            transaction: standardById,
            type: 'standard',
            source: 'standardpayments_by_id'
          };
        }

        // Try Order by _id (only if valid ObjectId)
        let orderById = null;
        if (isValidObjectId) {
          console.log('🔍 Searching Order by _id...');
          orderById = await Order.findById(identifier)
            .populate('buyer', 'firstName lastName email')
            .populate('seller', 'firstName lastName email')
            .populate('product', 'title price product_photos');
        } else {
          console.log('🔍 Skipping Order _id search (invalid ObjectId format)');
        }

        if (orderById) {
          console.log(`✅ Found Order by _id: ${orderById._id}`);
          return {
            transaction: orderById,
            type: orderById.type || 'order',
            source: 'orders_by_id'
          };
        }

      } catch (objectIdError) {
        console.error('❌ Error in ObjectId search:', objectIdError.message);
      }
    }

    // Method 6: Debug - Check what exists in the database
    console.log('🔍 Method 6: Debug - Checking database contents...');
    try {
      const escrowCount = await EscrowTransaction.countDocuments();
      const standardCount = await StandardPayment.countDocuments();
      const orderCount = await Order.countDocuments();

      console.log(`📊 Database stats: EscrowTransactions: ${escrowCount}, StandardPayments: ${standardCount}, Orders: ${orderCount}`);

      // If it's a valid ObjectId, let's see if there are any documents with similar IDs
      if (isValidObjectId) {
        console.log('🔍 Checking for similar ObjectIds...');

        // Get a few recent transactions for comparison
        const recentEscrows = await EscrowTransaction.find().limit(3).select('_id transactionId gatewayTransactionId');
        const recentStandards = await StandardPayment.find().limit(3).select('_id transactionId gatewayTransactionId');
        const recentOrders = await Order.find().limit(3).select('_id orderNumber payment.transactionId');

        console.log('📋 Recent EscrowTransactions:', recentEscrows.map(t => ({
          _id: t._id.toString(),
          transactionId: t.transactionId,
          gatewayTransactionId: t.gatewayTransactionId
        })));

        console.log('📋 Recent StandardPayments:', recentStandards.map(t => ({
          _id: t._id.toString(),
          transactionId: t.transactionId,
          gatewayTransactionId: t.gatewayTransactionId
        })));

        console.log('📋 Recent Orders:', recentOrders.map(o => ({
          _id: o._id.toString(),
          orderNumber: o.orderNumber,
          paymentTransactionId: o.payment?.transactionId
        })));
      }

    } catch (debugError) {
      console.error('❌ Error in debug method:', debugError.message);
    }

    console.log(`❌ Transaction not found with identifier: ${identifier}`);
    console.log(`❌ Searched in: EscrowTransactions, StandardPayments, Orders, and main Transactions table`);
    return null;

  } catch (error) {
    console.error('❌ Error in comprehensive transaction search:', error);
    throw error;
  }
};

/**
 * Get user's wallet details
 */
exports.getWallet = async (req, res) => {
  try {
    console.log('💰 Getting wallet for user:', req.user._id);
    console.log('👤 User details:', {
      id: req.user._id,
      email: req.user.email,
      firstName: req.user.firstName,
      lastName: req.user.lastName
    });
    const userId = req.user._id;

    if (!userId) {
      console.error('❌ No user ID provided');
      return errorResponse(res, 'User ID is required', 400);
    }

    console.log('🔍 Finding or creating wallet for user:', userId);

    // Try to find existing wallet first
    let wallet = await Wallet.findOne({ user: userId });

    if (!wallet) {
      console.log('📝 Creating new wallet for user:', userId);
      try {
        wallet = await Wallet.findOrCreateWallet(userId);
        console.log('✅ New wallet created:', wallet._id);
      } catch (createError) {
        console.error('❌ Error creating wallet:', createError);
        // If creation fails due to duplicate key, try to find existing wallet again
        if (createError.message.includes('E11000')) {
          console.log('🔄 Duplicate key error, trying to find existing wallet...');
          wallet = await Wallet.findOne({ user: userId });
          if (wallet) {
            console.log('✅ Found existing wallet after duplicate error:', wallet._id);
          } else {
            throw new Error('Failed to create or find wallet after duplicate key error');
          }
        } else {
          throw createError;
        }
      }
    } else {
      console.log('✅ Existing wallet found:', wallet._id);
    }

    const walletData = {
      id: wallet._id,
      balances: wallet.balances,
      primaryCurrency: wallet.primaryCurrency,
      totalBalance: wallet.totalBalance,
      isActive: wallet.isActive,
      isBlocked: wallet.isBlocked,
      withdrawalLimit: wallet.withdrawalLimit,
      statistics: wallet.statistics,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt
    };

    console.log('📊 Returning wallet data:', walletData);

    return successResponse(res, 'Wallet retrieved successfully', {
      wallet: walletData
    });

  } catch (error) {
    console.error('❌ Get wallet error:', error);
    console.error('Error stack:', error.stack);
    return errorResponse(res, 'Failed to retrieve wallet: ' + error.message, 500);
  }
};

/**
 * Get wallet transaction history
 */
exports.getTransactionHistory = async (req, res) => {
  try {
    console.log('📋 Getting transaction history for user:', req.user._id);
    console.log('👤 User details:', {
      id: req.user._id,
      email: req.user.email,
      firstName: req.user.firstName,
      lastName: req.user.lastName
    });
    const userId = req.user._id;
    const { page = 1, limit = 20, type, currency } = req.query;

    // Try to find wallet without complex population first to avoid errors
    let wallet = await Wallet.findOne({ user: userId });

    if (!wallet) {
      console.log('⚠️ Wallet not found for user:', userId);
      try {
        // Create wallet if it doesn't exist
        wallet = await Wallet.findOrCreateWallet(userId);
        console.log('✅ Created new wallet:', wallet._id);
      } catch (createError) {
        console.error('❌ Error creating wallet for transaction history:', createError);
        if (createError.message.includes('E11000')) {
          // Try to find existing wallet again
          wallet = await Wallet.findOne({ user: userId });
          if (!wallet) {
            return errorResponse(res, 'Failed to create or find wallet', 500);
          }
        } else {
          return errorResponse(res, 'Failed to create wallet: ' + createError.message, 500);
        }
      }

      return successResponse(res, 'Transaction history retrieved successfully', {
        transactions: [],
        pagination: {
          currentPage: parseInt(page),
          totalPages: 0,
          totalTransactions: 0,
          hasNext: false,
          hasPrev: false
        }
      });
    }

    // Now populate the wallet data safely
    try {
      wallet = await Wallet.findOne({ user: userId })
        .populate('user', 'firstName lastName email')
        .populate('transactions.relatedProduct', 'title price product_photos')
        .populate({
          path: 'transactions.relatedTransaction',
          populate: {
            path: 'buyer seller product',
            select: 'firstName lastName email title price product_photos'
          }
        })
        .populate({
          path: 'transactions.relatedEscrowTransaction',
          populate: {
            path: 'buyer seller product',
            select: 'firstName lastName email title price product_photos'
          }
        });
    } catch (populateError) {
      console.error('❌ Error populating wallet data:', populateError);
      // If population fails, continue with basic wallet data
      console.log('⚠️ Continuing with basic wallet data without population');
    }

    let transactions = wallet.transactions || [];
    console.log(`📊 Found ${transactions.length} transactions`);

    // Filter by type if specified
    if (type) {
      transactions = transactions.filter(tx => tx.type === type);
      console.log(`🔍 Filtered by type '${type}': ${transactions.length} transactions`);
    }

    // Filter by currency if specified
    if (currency) {
      transactions = transactions.filter(tx => tx.currency === currency);
      console.log(`🔍 Filtered by currency '${currency}': ${transactions.length} transactions`);
    }

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedTransactions = transactions.slice(startIndex, endIndex);

    console.log(`📄 Returning page ${page} with ${paginatedTransactions.length} transactions`);

    return successResponse(res, 'Transaction history retrieved successfully', {
      transactions: paginatedTransactions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(transactions.length / limit),
        totalTransactions: transactions.length,
        hasNext: endIndex < transactions.length,
        hasPrev: startIndex > 0
      }
    });

  } catch (error) {
    console.error('❌ Get transaction history error:', error);
    console.error('Error stack:', error.stack);
    return errorResponse(res, 'Failed to retrieve transaction history: ' + error.message, 500);
  }
};

/**
 * Withdraw money from wallet with Stripe payout integration
 */
exports.withdrawMoney = async (req, res) => {
  try {
    console.log('💰 Withdrawal request received:', req.body);
    const userId = req.user._id;
    const { amount, currency = 'USD', withdrawalMethod, bankAccountId, description } = req.body;

    // Validation
    if (!amount || amount <= 0) {
      return errorResponse(res, 'Invalid withdrawal amount', 400);
    }

    if (!withdrawalMethod || !['bank_transfer', 'paypal'].includes(withdrawalMethod)) {
      return errorResponse(res, 'Invalid withdrawal method. Supported methods: bank_transfer, paypal', 400);
    }

    // Validate account selection based on withdrawal method
    if (withdrawalMethod === 'bank_transfer' && !req.body.bankAccountId) {
      return errorResponse(res, 'Bank account selection is required for bank transfer withdrawal', 400);
    }

    if (withdrawalMethod === 'paypal' && !req.body.paypalAccountId) {
      return errorResponse(res, 'PayPal account selection is required for PayPal withdrawal', 400);
    }

    const wallet = await Wallet.findOne({ user: userId });

    if (!wallet) {
      return errorResponse(res, 'Wallet not found', 404);
    }

    // Check if wallet is blocked
    if (wallet.isBlocked) {
      return errorResponse(res, 'Wallet is blocked. Please contact support.', 403);
    }
    // Check withdrawal eligibility
    const canWithdraw = wallet.canWithdraw(amount, currency);
    if (!canWithdraw.canWithdraw) {
      return errorResponse(res, canWithdraw.reason, 400);
    }

    let withdrawalAccount = null;
    let accountDisplayName = '';

    if (withdrawalMethod === 'bank_transfer') {
      // Verify bank account exists and belongs to user
      const bankAccount = await BankAccount.findOne({
        _id: req.body.bankAccountId,
        user: userId,
        isActive: true
      });

      if (!bankAccount) {
        return errorResponse(res, 'Bank account not found or not accessible', 404);
      }

      withdrawalAccount = bankAccount;
      accountDisplayName = `${bankAccount.bankName} ****${bankAccount.lastFourDigits}`;

      console.log('✅ Bank account verified:', {
        accountId: bankAccount._id,
        bankName: bankAccount.bankName,
        lastFour: bankAccount.lastFourDigits
      });
    } else if (withdrawalMethod === 'paypal') {
      // Verify PayPal account exists and belongs to user
      const paypalAccount = await PaypalAccount.findOne({
        _id: req.body.paypalAccountId,
        user: userId,
        isActive: true
      });

      if (!paypalAccount) {
        return errorResponse(res, 'PayPal account not found or not accessible', 404);
      }

      if (!paypalAccount.isVerified) {
        return errorResponse(res, 'PayPal account is not verified. Please verify your PayPal account first.', 400);
      }

      withdrawalAccount = paypalAccount;
      accountDisplayName = paypalAccount.email;

      console.log('✅ PayPal account verified:', {
        accountId: paypalAccount._id,
        email: paypalAccount.email,
        isVerified: paypalAccount.isVerified
      });
    }

    // Get Stripe payment gateway configuration
    const stripeGateway = await PaymentGateway.findOne({
      gatewayName: 'stripe',
      isActive: true
    });

    if (!stripeGateway) {
      return errorResponse(res, 'Payment gateway not available', 503);
    }

    // Initialize Stripe Payout Service
    const stripePayoutService = new StripePayoutService(stripeGateway);

    // Create wallet transaction first (pending status)
    const transactionData = {
      type: 'withdrawal',
      amount,
      currency,
      description: description || `Withdrawal to ${accountDisplayName}`,
      metadata: {
        withdrawalMethod,
        accountId: withdrawalMethod === 'bank_transfer' ? req.body.bankAccountId : req.body.paypalAccountId,
        accountDisplayName: accountDisplayName,
        ...(withdrawalMethod === 'bank_transfer' && {
          bankAccountId: req.body.bankAccountId,
          bankName: withdrawalAccount.bankName,
          lastFourDigits: withdrawalAccount.lastFourDigits,
        }),
        ...(withdrawalMethod === 'paypal' && {
          paypalAccountId: req.body.paypalAccountId,
          paypalEmail: withdrawalAccount.email,
        }),
        status: 'pending',
        payoutProvider: 'stripe'
      }
    };

    await wallet.addTransaction(transactionData);
    const walletTransaction = wallet.transactions[0]; // Most recent transaction

    console.log('✅ Wallet transaction created:', walletTransaction.transactionId);

    // Prepare payout data based on withdrawal method
    const payoutData = {
      amount: amount,
      currency: currency,
      userId: userId.toString(),
      withdrawalMethod: withdrawalMethod,
      walletTransactionId: walletTransaction.transactionId,
      withdrawalRequestId: walletTransaction._id.toString(),
      description: transactionData.description,
      ...(withdrawalMethod === 'bank_transfer' && {
        bankAccountId: req.body.bankAccountId,
      }),
      ...(withdrawalMethod === 'paypal' && {
        paypalAccountId: req.body.paypalAccountId,
        paypalEmail: withdrawalAccount.email,
      })
    };

    // Create payout based on withdrawal method
    let payoutResult;
    
    if (withdrawalMethod === 'bank_transfer') {
      console.log('🔄 Creating Stripe bank payout...');
      payoutResult = await stripePayoutService.createPayout(payoutData);
    } else if (withdrawalMethod === 'paypal') {
      console.log('🔄 Creating PayPal payout...');
      // TODO: Implement PayPal payout service
      // For now, simulate PayPal payout
      payoutResult = {
        success: true,
        payoutId: `paypal_payout_${Date.now()}`,
        status: 'pending',
        estimatedArrival: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days
      };
    }

    if (payoutResult.success) {
      // Update wallet transaction with payout details
      walletTransaction.metadata.stripePayoutId = payoutResult.payoutId;
      walletTransaction.metadata.payoutStatus = payoutResult.status;
      walletTransaction.metadata.estimatedArrival = payoutResult.estimatedArrival;

      // Update withdrawal tracking
      wallet.withdrawalTracking.dailyWithdrawn += amount;
      wallet.withdrawalTracking.monthlyWithdrawn += amount;
      await wallet.save();

      console.log('✅ Stripe payout created successfully:', payoutResult.payoutId);

      const responseData = {
        transactionId: walletTransaction.transactionId,
        payoutId: payoutResult.payoutId,
        amount,
        currency,
        status: payoutResult.status,
        estimatedArrival: payoutResult.estimatedArrival,
        withdrawalMethod: withdrawalMethod,
        accountDisplayName: accountDisplayName
      };

      // Add method-specific account info
      if (withdrawalMethod === 'bank_transfer') {
        responseData.bankAccount = {
          bankName: withdrawalAccount.bankName,
          lastFourDigits: withdrawalAccount.lastFourDigits
        };
        responseData.processingMessage = 'Your withdrawal is being processed. You will receive the funds in your bank account within 1-3 business days.';
      } else if (withdrawalMethod === 'paypal') {
        responseData.paypalAccount = {
          email: withdrawalAccount.email
        };
        responseData.processingMessage = 'Your withdrawal is being processed. You will receive the funds in your PayPal account within 1-2 business days.';
      }

      return successResponse(res, 'Withdrawal request submitted successfully', responseData);

    } else {
      // Payout creation failed - update transaction status
      walletTransaction.metadata.status = 'failed';
      walletTransaction.metadata.failureReason = payoutResult.error;
      walletTransaction.metadata.failureCode = payoutResult.code;

      // Reverse the withdrawal from tracking (since payout failed)
      wallet.withdrawalTracking.dailyWithdrawn -= amount;
      wallet.withdrawalTracking.monthlyWithdrawn -= amount;

      // Credit back the amount to wallet (reverse the debit)
      const currentBalance = wallet.balances[currency] || 0;
      wallet.balances[currency] = currentBalance + amount;

      await wallet.save();

      console.error('❌ Stripe payout creation failed:', payoutResult.error);

      return errorResponse(res, `Withdrawal failed: ${payoutResult.error}`, 400);
    }

  } catch (error) {
    console.error('❌ Withdraw money error:', error);
    return errorResponse(res, error.message || 'Failed to process withdrawal', 500);
  }
};

/**
 * Check withdrawal status and update transaction
 */
exports.checkWithdrawalStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    const { transactionId } = req.params;

    console.log('🔍 Checking withdrawal status:', { userId, transactionId });

    const wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      return errorResponse(res, 'Wallet not found', 404);
    }

    // Find the transaction
    const transaction = wallet.transactions.find(t =>
      t.transactionId === transactionId || t._id.toString() === transactionId
    );

    if (!transaction) {
      return errorResponse(res, 'Transaction not found', 404);
    }

    if (transaction.type !== 'withdrawal') {
      return errorResponse(res, 'Transaction is not a withdrawal', 400);
    }

    const stripePayoutId = transaction.metadata?.stripePayoutId;
    if (!stripePayoutId) {
      return successResponse(res, 'Withdrawal status retrieved', {
        transactionId: transaction.transactionId,
        status: transaction.metadata?.status || 'pending',
        amount: transaction.amount,
        currency: transaction.currency,
        description: transaction.description,
        createdAt: transaction.createdAt,
        message: 'Withdrawal is being processed'
      });
    }

    // Get Stripe payment gateway configuration
    const stripeGateway = await PaymentGateway.findOne({
      gatewayName: 'stripe',
      isActive: true
    });

    if (!stripeGateway) {
      return errorResponse(res, 'Payment gateway not available', 503);
    }

    // Initialize Stripe Payout Service and check status
    const stripePayoutService = new StripePayoutService(stripeGateway);
    const payoutResult = await stripePayoutService.retrievePayout(stripePayoutId);

    if (payoutResult.success) {
      // Update transaction status if it has changed
      const currentStatus = transaction.metadata?.payoutStatus;
      const newStatus = payoutResult.status;

      if (currentStatus !== newStatus) {
        console.log(`🔄 Updating withdrawal status from ${currentStatus} to ${newStatus}`);

        transaction.metadata.payoutStatus = newStatus;
        transaction.metadata.status = newStatus;

        if (newStatus === 'paid') {
          transaction.metadata.completedAt = new Date();
          transaction.metadata.arrivalDate = payoutResult.arrivalDate;
        } else if (newStatus === 'failed') {
          transaction.metadata.failureCode = payoutResult.failureCode;
          transaction.metadata.failureMessage = payoutResult.failureMessage;
          transaction.metadata.failedAt = new Date();
        }

        await wallet.save();
        console.log('✅ Transaction status updated successfully');
      }

      return successResponse(res, 'Withdrawal status retrieved', {
        transactionId: transaction.transactionId,
        payoutId: stripePayoutId,
        status: newStatus,
        amount: transaction.amount,
        currency: transaction.currency,
        description: transaction.description,
        createdAt: transaction.createdAt,
        estimatedArrival: payoutResult.arrivalDate,
        failureCode: payoutResult.failureCode,
        failureMessage: payoutResult.failureMessage,
        message: getStatusMessage(newStatus)
      });

    } else {
      console.error('❌ Failed to retrieve payout status:', payoutResult.error);
      return errorResponse(res, 'Failed to check withdrawal status', 500);
    }

  } catch (error) {
    console.error('❌ Check withdrawal status error:', error);
    return errorResponse(res, error.message || 'Failed to check withdrawal status', 500);
  }
};

/**
 * Get user's withdrawal history
 */
exports.getWithdrawalHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10, status } = req.query;

    console.log('📋 Getting withdrawal history:', { userId, page, limit, status });

    const wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      return errorResponse(res, 'Wallet not found', 404);
    }

    // Filter withdrawal transactions
    let withdrawalTransactions = wallet.transactions.filter(t => t.type === 'withdrawal');

    // Filter by status if provided
    if (status) {
      withdrawalTransactions = withdrawalTransactions.filter(t =>
        t.metadata?.status === status || t.metadata?.payoutStatus === status
      );
    }

    // Sort by creation date (newest first)
    withdrawalTransactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedTransactions = withdrawalTransactions.slice(startIndex, endIndex);

    // Format transactions for response
    const formattedTransactions = paginatedTransactions.map(transaction => ({
      transactionId: transaction.transactionId,
      payoutId: transaction.metadata?.stripePayoutId,
      amount: transaction.amount,
      currency: transaction.currency,
      status: transaction.metadata?.payoutStatus || transaction.metadata?.status || 'pending',
      description: transaction.description,
      bankAccount: {
        bankName: transaction.metadata?.bankName,
        lastFourDigits: transaction.metadata?.lastFourDigits
      },
      createdAt: transaction.createdAt,
      estimatedArrival: transaction.metadata?.estimatedArrival,
      completedAt: transaction.metadata?.completedAt,
      failureCode: transaction.metadata?.failureCode,
      failureMessage: transaction.metadata?.failureMessage,
      message: getStatusMessage(transaction.metadata?.payoutStatus || transaction.metadata?.status || 'pending')
    }));

    const totalTransactions = withdrawalTransactions.length;
    const totalPages = Math.ceil(totalTransactions / limit);

    return successResponse(res, 'Withdrawal history retrieved successfully', {
      transactions: formattedTransactions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: totalPages,
        totalTransactions: totalTransactions,
        hasNext: endIndex < totalTransactions,
        hasPrev: startIndex > 0
      }
    });

  } catch (error) {
    console.error('❌ Get withdrawal history error:', error);
    return errorResponse(res, error.message || 'Failed to get withdrawal history', 500);
  }
};

/**
 * Helper function to get status message
 */
function getStatusMessage(status) {
  switch (status) {
    case 'pending':
      return 'Your withdrawal is being processed. Funds will arrive in 1-3 business days.';
    case 'paid':
      return 'Withdrawal completed successfully. Funds have been transferred to your bank account.';
    case 'failed':
      return 'Withdrawal failed. Please contact support or try again with a different bank account.';
    case 'in_transit':
      return 'Your withdrawal is on its way to your bank account.';
    default:
      return 'Withdrawal status is being updated.';
  }
}

/**
 * Get wallet balance in specific currency
 */
exports.getBalance = async (req, res) => {
  try {
    const userId = req.user._id;
    const { currency = 'USD' } = req.query;
    
    const wallet = await Wallet.findOrCreateWallet(userId);
    
    const balance = wallet.balances[currency] || 0;
    
    return successResponse(res, 'Balance retrieved successfully', {
      balance,
      currency,
      formattedBalance: `${currency} ${balance.toFixed(2)}`
    });
    
  } catch (error) {
    console.error('Get balance error:', error);
    return errorResponse(res, 'Failed to retrieve balance', 500);
  }
};

/**
 * Update wallet settings
 */
exports.updateWalletSettings = async (req, res) => {
  try {
    const userId = req.user._id;
    const { primaryCurrency, withdrawalLimit } = req.body;
    
    const wallet = await Wallet.findOne({ user: userId });
    
    if (!wallet) {
      return errorResponse(res, 'Wallet not found', 404);
    }
    
    // Update primary currency if provided
    if (primaryCurrency && ['USD', 'AED', 'EUR', 'GBP'].includes(primaryCurrency)) {
      wallet.primaryCurrency = primaryCurrency;
    }
    
    // Update withdrawal limits if provided
    if (withdrawalLimit) {
      if (withdrawalLimit.daily && withdrawalLimit.daily > 0) {
        wallet.withdrawalLimit.daily = withdrawalLimit.daily;
      }
      if (withdrawalLimit.monthly && withdrawalLimit.monthly > 0) {
        wallet.withdrawalLimit.monthly = withdrawalLimit.monthly;
      }
    }
    
    await wallet.save();
    
    return successResponse(res, 'Wallet settings updated successfully', {
      primaryCurrency: wallet.primaryCurrency,
      withdrawalLimit: wallet.withdrawalLimit
    });
    
  } catch (error) {
    console.error('Update wallet settings error:', error);
    return errorResponse(res, 'Failed to update wallet settings', 500);
  }
};

/**
 * Credit wallet (internal use - called when seller receives payment)
 */
exports.creditWalletInternal = require('../../../../utils/walletUtils').creditWalletExternal;









/**
 * Complete payment and credit wallet
 */
exports.completePayment = async (req, res) => {
  try {
    console.log('💰 Complete payment and credit wallet request - START');
    console.log('📋 Request body:', JSON.stringify(req.body, null, 2));
    console.log('👤 User:', req.user ? req.user._id : 'No user');

    // Validate request
    if (!req.user || !req.user._id) {
      console.error('❌ No authenticated user found');
      return errorResponse(res, 'Authentication required', 401);
    }

    let { transactionId, transactionType = 'standard' } = req.body;

    if (!transactionId) {
      console.error('❌ Missing transaction ID in request');
      return errorResponse(res, 'Transaction ID is required', 400);
    }

    console.log('✅ Initial validation passed');

    console.log('🔍 Transaction details:');
    console.log(`🔍   - Transaction ID: ${transactionId}`);
    console.log(`🔍   - Transaction Type: ${transactionType}`);
    console.log(`🔍   - ID Length: ${transactionId.length}`);
    console.log(`🔍   - ID Pattern: ${transactionId.startsWith('TXN_') ? 'Internal TXN_' : transactionId.startsWith('pi_') ? 'Stripe PI_' : transactionId.startsWith('ESC-') ? 'Escrow ESC-' : 'Unknown'}`);
    console.log(`🔍   - User ID: ${req.user._id}`);
    console.log('🔍 ==========================================');

    // Auto-detect transaction type and find the transaction
    if (!transactionType || transactionType === 'auto') {
      console.log('🔍 Auto-detecting transaction type...');
      console.log(`🔍 Searching for transaction with ID: ${transactionId}`);

      try {
        // Try to find the transaction using comprehensive search
        const foundTransaction = await findTransactionComprehensive(transactionId);
        console.log('🔍 Found my transaction:======', foundTransaction);

        if (foundTransaction) {
          transactionType = foundTransaction.type;
          console.log(`✅ Found transaction: ${foundTransaction.transaction._id}`);
          console.log(`✅ Transaction type: ${foundTransaction.type}`);
          console.log(`✅ Found in: ${foundTransaction.source}`);
        } else {
          console.error('❌ Transaction not found in any table');
          console.error(`❌ Searched for transaction ID: ${transactionId}`);
          console.error('❌ Check if the transaction ID is correct');
          return errorResponse(res, `Transaction not found: ${transactionId}`, 404);
        }
      } catch (searchError) {
        console.error('❌ Error during transaction search:', searchError);
        return errorResponse(res, `Error searching for transaction: ${searchError.message}`, 500);
      }
    }

    console.log(`💰 Completing ${transactionType} payment: ${transactionId}`);

    // Find the actual transaction using our comprehensive finder
    let foundTransaction;
    try {
      console.log('🔍 Starting comprehensive transaction search...');
      foundTransaction = await findTransactionComprehensive(transactionId);
      console.log('🔍 Comprehensive search completed');
    } catch (findError) {
      console.error('❌ Error during comprehensive transaction search:', findError);
      return errorResponse(res, `Error finding transaction: ${findError.message}`, 500);
    }

    if (!foundTransaction) {
      console.error('❌ Transaction not found by comprehensive search');
      return errorResponse(res, `Transaction not found: ${transactionId}`, 404);
    }

    console.log(`✅ Found transaction via ${foundTransaction.source}`);
    console.log(`✅ Transaction type: ${foundTransaction.type}`);
    console.log(`✅ Transaction ID: ${foundTransaction.transaction._id}`);

    let result;

    if (foundTransaction.source === 'virtual_from_order') {
      // For virtual transactions, handle directly without PaymentCompletionService
      console.log('🔄 Processing virtual escrow transaction from order data');

      const orderData = foundTransaction.transaction;

      // Calculate seller amount (product price minus platform fee)
      const productPrice = orderData.productPrice || 0;
      const platformFeeAmount = productPrice * 0.1; // 10% platform fee
      const sellerAmount = productPrice - platformFeeAmount;

      // Credit the seller's wallet directly
      console.log('🔄 Calling creditWalletInternal with:', {
        sellerId: orderData.seller._id,
        sellerAmount,
        currency: orderData.currency,
        transactionId: orderData.transactionId
      });

      let creditResult;
      try {
        creditResult = await creditWalletExternal(
          orderData.seller._id,
          sellerAmount,
          orderData.currency,
          `Sale of ${orderData.product?.title || 'Product'}`,
          {
            relatedTransaction: orderData.transactionId,
            metadata: {
              transactionType: 'escrow',
              originalTransactionId: orderData.transactionId
            }
          }
        );
      } catch (creditError) {
        console.error('❌ Error calling creditWalletInternal:', creditError);
        return errorResponse(res, `Failed to credit wallet: ${creditError.message}`, 500);
      }

      console.log('🔄 creditWalletInternal result:', creditResult);

      if (creditResult && creditResult.success) {
        result = {
          success: true,
          walletCredited: true,
          sellerAmount,
          currency: orderData.currency,
          newBalance: creditResult.newBalance,
          productTitle: orderData.product?.title
        };
      } else {
        const errorMessage = creditResult?.error || 'Failed to credit wallet - creditResult is undefined or failed';
        console.error('❌ Failed to credit wallet for virtual transaction:', errorMessage);
        console.error('❌ creditResult details:', creditResult);
        return errorResponse(res, errorMessage, 500);
      }
    } else {
      // For real transactions, handle payment completion directly
      const actualTransactionId = foundTransaction.transaction._id;
      const transaction = foundTransaction.transaction;

      console.log(`🔄 Processing real transaction with ID: ${actualTransactionId}`);
      console.log(`🔄 Transaction type: ${foundTransaction.type}`);

      if (foundTransaction.type === 'escrow') {
        // Handle escrow transaction completion
        console.log('🛡️ Processing escrow transaction completion');

        // Check if already completed
        console.log(`🔍 Transaction status: ${transaction.status}`);
        console.log(`🔍 Transaction productPrice: ${transaction.productPrice}`);
        console.log(`🔍 Transaction platformFeeAmount: ${transaction.platformFeeAmount}`);
        console.log(`🔍 Transaction seller: ${transaction.seller?._id || transaction.seller}`);

        if (transaction.status === 'completed') {
          console.log('⚠️ Escrow already completed - setting walletCredited: false');
          result = {
            success: true,
            alreadyCompleted: true,
            walletCredited: false,
            message: 'Transaction already completed'
          };
        } else {
          // Credit seller's wallet
          const sellerAmount = transaction.productPrice - (transaction.platformFeeAmount || 0);
          console.log(`💰 Calculated seller amount: ${sellerAmount} (${transaction.productPrice} - ${transaction.platformFeeAmount || 0})`);

          if (sellerAmount > 0) {
            console.log(`🔄 Calling creditWalletExternal with:`);
            console.log(`   - Seller ID: ${transaction.seller._id || transaction.seller}`);
            console.log(`   - Amount: ${sellerAmount}`);
            console.log(`   - Currency: ${transaction.currency}`);

            const walletResult = await creditWalletExternal(
              transaction.seller._id || transaction.seller,
              sellerAmount,
              transaction.currency,
              `Escrow payment for product: ${transaction.product?.title || 'Product'}`,
              {
                relatedEscrowTransaction: transaction._id,
                metadata: {
                  transactionType: 'escrow',
                  originalTransactionId: transaction.transactionId
                }
              }
            );

            console.log(`💰 creditWalletExternal result:`, JSON.stringify(walletResult, null, 2));

            if (walletResult.success) {
              console.log(`✅ Escrow completed and wallet credited: ${transaction.currency} ${sellerAmount}`);
              result = {
                success: true,
                walletCredited: true,
                sellerAmount,
                currency: transaction.currency
              };
            } else {
              console.error('❌ Failed to credit wallet for escrow:', walletResult.error);
              result = {
                success: false,
                error: 'Failed to credit seller wallet',
                walletCredited: false
              };
            }
          } else {
            console.log(`⚠️ No wallet credit needed - seller amount is ${sellerAmount} (not positive)`);
            console.log(`⚠️ Product price: ${transaction.productPrice}, Platform fee: ${transaction.platformFeeAmount || 0}`);
            result = {
              success: true,
              walletCredited: false,
              message: 'Escrow completed but no wallet credit needed',
              sellerAmount,
              reason: 'Seller amount is not positive'
            };
          }
        }
      } else if (foundTransaction.type === 'standard') {
        // Handle standard payment completion
        console.log('💳 Processing standard payment completion');

        // Check if already completed
        if (transaction.status === 'completed') {
          console.log('⚠️ Standard payment already completed');
          result = { success: true, alreadyCompleted: true };
        } else {
          // Credit seller's wallet
          const sellerAmount = transaction.productPrice - (transaction.platformFeeAmount || 0);

          if (sellerAmount > 0) {
            const walletResult = await creditWalletExternal(
              transaction.seller._id,
              sellerAmount,
              transaction.currency,
              `Standard payment for product: ${transaction.product?.title || 'Product'}`,
              {
                relatedTransaction: transaction._id,
                metadata: {
                  transactionType: 'standard',
                  originalTransactionId: transaction.transactionId
                }
              }
            );

            if (walletResult.success) {
              console.log(`✅ Standard payment completed and wallet credited: ${transaction.currency} ${sellerAmount}`);
              result = {
                success: true,
                walletCredited: true,
                sellerAmount,
                currency: transaction.currency
              };
            } else {
              console.error('❌ Failed to credit wallet for standard payment:', walletResult.error);
              result = {
                success: false,
                error: 'Failed to credit seller wallet'
              };
            }
          } else {
            result = {
              success: true,
              walletCredited: false,
              message: 'Standard payment completed but no wallet credit needed'
            };
          }
        }
      } else {
        console.error('❌ Unknown transaction type:', foundTransaction.type);
        result = {
          success: false,
          error: `Unknown transaction type: ${foundTransaction.type}`
        };
      }
    }

    console.log('📊 Payment completion result:', JSON.stringify(result, null, 2));

    if (result.success) {
      if (result.alreadyCompleted) {
        console.log('ℹ️ Payment was already completed');
        return successResponse(res, 'Payment was already completed', {
          transactionId,
          transactionType,
          alreadyCompleted: true
        });
      }

      console.log('✅ Payment completion successful');
      return successResponse(res, 'Payment completed and wallet credited successfully', {
        transactionId,
        transactionType,
        walletCredited: result.walletCredited,
        sellerAmount: result.sellerAmount,
        currency: result.currency
      });
    } else {
      console.error('❌ Payment completion failed:', result.error);
      return errorResponse(res, result.error || 'Failed to complete payment', 500);
    }

  } catch (error) {
    console.error('❌ Complete payment error:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error details:', {
      message: error.message,
      name: error.name,
      code: error.code
    });
    return errorResponse(res, 'Failed to complete payment: ' + error.message, 500);
  }
};

/**
 * Credit wallet based on transaction completion
 */
exports.creditFromTransaction = async (req, res) => {
  try {
    console.log('💰 Credit wallet from transaction request');
    const { transactionId, transactionType = 'standard' } = req.body;

    if (!transactionId) {
      return errorResponse(res, 'Transaction ID is required', 400);
    }

    console.log(`💰 Processing wallet credit for ${transactionType} transaction: ${transactionId}`);

    let transaction;
    let sellerAmount;
    let currency;
    let productTitle;
    let sellerId;

    if (transactionType === 'standard') {
      // Get standard payment details using utility function
      transaction = await findStandardPayment(transactionId, true);

      if (!transaction) {
        return errorResponse(res, 'Standard payment transaction not found', 404);
      }

      sellerId = transaction.seller._id;
      sellerAmount = transaction.productPrice - (transaction.platformFeeAmount || 0);
      currency = transaction.currency;
      productTitle = transaction.product?.title || 'Product';

    } else if (transactionType === 'escrow') {
      // Get escrow transaction details using utility function
      transaction = await findEscrowTransaction(transactionId, true);

      if (!transaction) {
        return errorResponse(res, 'Escrow transaction not found', 404);
      }

      sellerId = transaction.seller._id;
      sellerAmount = transaction.productPrice - (transaction.platformFeeAmount || 0);
      currency = transaction.currency;
      productTitle = transaction.product?.title || 'Product';
    } else {
      return errorResponse(res, 'Invalid transaction type', 400);
    }

    // Check if wallet has already been credited for this transaction
    const Wallet = require('../../../../db/models/walletModel');
    const existingWallet = await Wallet.findOne({ user: sellerId });

    if (existingWallet) {
      const existingTransaction = existingWallet.transactions.find(t =>
        t.relatedTransaction && t.relatedTransaction.toString() === transaction._id.toString()
      );

      if (existingTransaction) {
        console.log('⚠️ Wallet already credited for this transaction');
        return successResponse(res, 'Wallet already credited for this transaction', {
          alreadyCredited: true,
          existingAmount: existingTransaction.amount,
          currency: existingTransaction.currency
        });
      }
    }

    if (sellerAmount > 0) {
      const walletResult = await creditWalletExternal(
        sellerId,
        sellerAmount,
        currency,
        `Payment for product: ${productTitle}`,
        {
          relatedTransaction: transaction._id,
          relatedProduct: transaction.product,
          metadata: {
            transactionId: transaction.transactionId,
            transactionType: transactionType,
            originalAmount: transaction.productPrice,
            platformFee: transaction.platformFeeAmount,
            netAmount: sellerAmount,
            timestamp: new Date().toISOString()
          }
        }
      );

      if (walletResult.success) {
        console.log(`✅ Wallet credited from ${transactionType} transaction: ${currency} ${sellerAmount}`);
        return successResponse(res, 'Wallet credited successfully', {
          transactionId,
          transactionType,
          sellerAmount,
          currency,
          newBalance: walletResult.newBalance,
          productTitle
        });
      } else {
        console.error('❌ Failed to credit wallet:', walletResult.error);
        return errorResponse(res, walletResult.error || 'Failed to credit wallet', 500);
      }
    } else {
      return errorResponse(res, 'Invalid seller amount', 400);
    }

  } catch (error) {
    console.error('❌ Credit from transaction error:', error);
    return errorResponse(res, 'Failed to credit wallet: ' + error.message, 500);
  }
};

/**
 * Simulate product purchase and wallet credit (for testing)
 */
exports.simulatePurchase = async (req, res) => {
  try {
    console.log('🛒 Simulating product purchase and wallet credit');
    const sellerId = req.user._id;
    const { productPrice = 100, currency = 'USD', productTitle = 'Test Product' } = req.body;

    // Calculate platform fee (10%)
    const platformFee = productPrice * 0.1;
    const sellerAmount = productPrice - platformFee;

    console.log(`🛒 Simulating purchase: Product Price: ${currency} ${productPrice}, Platform Fee: ${currency} ${platformFee}, Seller Gets: ${currency} ${sellerAmount}`);

    const walletResult = await creditWalletExternal(
      sellerId,
      sellerAmount,
      currency,
      `Sale of product: ${productTitle}`,
      {
        metadata: {
          type: 'product_sale',
          originalAmount: productPrice,
          platformFee: platformFee,
          netAmount: sellerAmount,
          timestamp: new Date().toISOString()
        }
      }
    );

    if (walletResult.success) {
      console.log(`✅ Purchase simulation successful. Seller earned: ${currency} ${sellerAmount}`);
      return successResponse(res, 'Purchase simulated successfully', {
        productPrice,
        platformFee,
        sellerAmount,
        currency,
        newBalance: walletResult.newBalance,
        productTitle
      });
    } else {
      console.error('❌ Purchase simulation failed:', walletResult.error);
      return errorResponse(res, walletResult.error || 'Failed to simulate purchase', 500);
    }

  } catch (error) {
    console.error('❌ Simulate purchase error:', error);
    return errorResponse(res, 'Failed to simulate purchase: ' + error.message, 500);
  }
};

/**
 * Get comprehensive transaction data for wallet
 */
exports.getComprehensiveTransactionData = async (req, res) => {
  try {
    console.log('📊 Getting comprehensive transaction data for user:', req.user._id);
    const userId = req.user._id;

    // Get wallet with populated transactions
    const wallet = await Wallet.findOne({ user: userId })
      .populate('user', 'firstName lastName email')
      .populate('transactions.relatedProduct', 'title price product_photos')
      .populate({
        path: 'transactions.relatedTransaction',
        populate: {
          path: 'buyer seller product',
          select: 'firstName lastName email title price product_photos'
        }
      })
      .populate({
        path: 'transactions.relatedEscrowTransaction',
        populate: {
          path: 'buyer seller product',
          select: 'firstName lastName email title price product_photos'
        }
      });

    // Get all standard payments involving this user
    const StandardPayment = require('../../../../db/models/standardPaymentModel');
    const standardPayments = await StandardPayment.find({
      $or: [
        { buyer: userId },
        { seller: userId }
      ]
    })
    .populate('buyer', 'firstName lastName email')
    .populate('seller', 'firstName lastName email')
    .populate('product', 'title price product_photos')
    .sort({ createdAt: -1 });

    // Get all escrow transactions involving this user
    const EscrowTransaction = require('../../../../db/models/escrowTransactionModel');
    const escrowTransactions = await EscrowTransaction.find({
      $or: [
        { buyer: userId },
        { seller: userId }
      ]
    })
    .populate('buyer', 'firstName lastName email')
    .populate('seller', 'firstName lastName email')
    .populate('product', 'title price product_photos')
    .sort({ createdAt: -1 });

    // Format transaction data
    const formattedData = {
      wallet: {
        exists: !!wallet,
        balances: wallet?.balances || {},
        totalTransactions: wallet?.transactions?.length || 0,
        transactions: wallet?.transactions?.map(tx => ({
          id: tx._id,
          type: tx.type,
          amount: tx.amount,
          currency: tx.currency,
          description: tx.description,
          status: tx.status,
          createdAt: tx.createdAt,
          buyer: tx.metadata?.buyerName || 'Unknown',
          buyerEmail: tx.metadata?.buyerEmail || '',
          product: tx.relatedProduct?.title || 'Unknown Product',
          productPrice: tx.relatedProduct?.price || 0,
          originalAmount: tx.metadata?.originalAmount || tx.amount,
          platformFee: tx.metadata?.platformFee || 0,
          netAmount: tx.metadata?.netAmount || tx.amount,
          paymentType: tx.metadata?.paymentType || 'unknown'
        })) || []
      },
      standardPayments: standardPayments.map(payment => ({
        id: payment._id,
        transactionId: payment.transactionId,
        status: payment.status,
        amount: payment.totalAmount,
        productPrice: payment.productPrice,
        platformFee: payment.platformFeeAmount,
        currency: payment.currency,
        buyer: {
          id: payment.buyer?._id,
          name: `${payment.buyer?.firstName} ${payment.buyer?.lastName}`,
          email: payment.buyer?.email
        },
        seller: {
          id: payment.seller?._id,
          name: `${payment.seller?.firstName} ${payment.seller?.lastName}`,
          email: payment.seller?.email
        },
        product: {
          id: payment.product?._id,
          title: payment.product?.title,
          price: payment.product?.price,
          image: payment.product?.product_photos?.[0]
        },
        createdAt: payment.createdAt,
        completedAt: payment.completedAt
      })),
      escrowTransactions: escrowTransactions.map(escrow => ({
        id: escrow._id,
        transactionId: escrow.transactionId,
        status: escrow.status,
        amount: escrow.totalAmount,
        productPrice: escrow.productPrice,
        platformFee: escrow.platformFeeAmount,
        currency: escrow.currency,
        buyer: {
          id: escrow.buyer?._id,
          name: `${escrow.buyer?.firstName} ${escrow.buyer?.lastName}`,
          email: escrow.buyer?.email
        },
        seller: {
          id: escrow.seller?._id,
          name: `${escrow.seller?.firstName} ${escrow.seller?.lastName}`,
          email: escrow.seller?.email
        },
        product: {
          id: escrow.product?._id,
          title: escrow.product?.title,
          price: escrow.product?.price,
          image: escrow.product?.product_photos?.[0]
        },
        createdAt: escrow.createdAt,
        completedAt: escrow.completedAt
      }))
    };

    console.log(`📊 Comprehensive data: ${formattedData.wallet.totalTransactions} wallet transactions, ${formattedData.standardPayments.length} standard payments, ${formattedData.escrowTransactions.length} escrow transactions`);

    return successResponse(res, 'Comprehensive transaction data retrieved successfully', formattedData);

  } catch (error) {
    console.error('❌ Get comprehensive transaction data error:', error);
    return errorResponse(res, 'Failed to get transaction data: ' + error.message, 500);
  }
};

/**
 * Debug payment status and wallet integration
 */
exports.debugPaymentStatus = async (req, res) => {
  try {
    console.log('🔍 Debug payment status request');
    const userId = req.user._id;

    // Get recent standard payments
    const StandardPayment = require('../../../../db/models/standardPaymentModel');
    const recentStandardPayments = await StandardPayment.find({
      $or: [
        { buyer: userId },
        { seller: userId }
      ]
    })
    .populate('buyer', 'firstName lastName email')
    .populate('seller', 'firstName lastName email')
    .populate('product', 'title price')
    .sort({ createdAt: -1 })
    .limit(5);

    // Get recent escrow transactions
    const EscrowTransaction = require('../../../../db/models/escrowTransactionModel');
    const recentEscrowTransactions = await EscrowTransaction.find({
      $or: [
        { buyer: userId },
        { seller: userId }
      ]
    })
    .populate('buyer', 'firstName lastName email')
    .populate('seller', 'firstName lastName email')
    .populate('product', 'title price')
    .sort({ createdAt: -1 })
    .limit(5);

    // Get wallet info
    const Wallet = require('../../../../db/models/walletModel');
    const wallet = await Wallet.findOne({ user: userId });

    const debugInfo = {
      userId,
      wallet: {
        exists: !!wallet,
        balances: wallet?.balances || {},
        transactionCount: wallet?.transactions?.length || 0,
        recentTransactions: wallet?.transactions?.slice(-3) || []
      },
      recentPayments: {
        standard: recentStandardPayments.map(p => ({
          id: p._id,
          transactionId: p.transactionId,
          status: p.status,
          amount: p.totalAmount,
          currency: p.currency,
          buyer: p.buyer?.firstName + ' ' + p.buyer?.lastName,
          seller: p.seller?.firstName + ' ' + p.seller?.lastName,
          product: p.product?.title,
          createdAt: p.createdAt
        })),
        escrow: recentEscrowTransactions.map(e => ({
          id: e._id,
          transactionId: e.transactionId,
          status: e.status,
          amount: e.totalAmount,
          currency: e.currency,
          buyer: e.buyer?.firstName + ' ' + e.buyer?.lastName,
          seller: e.seller?.firstName + ' ' + e.seller?.lastName,
          product: e.product?.title,
          createdAt: e.createdAt
        }))
      }
    };

    console.log('🔍 Debug info:', debugInfo);

    return successResponse(res, 'Debug information retrieved', debugInfo);

  } catch (error) {
    console.error('❌ Debug payment status error:', error);
    return errorResponse(res, 'Failed to get debug info: ' + error.message, 500);
  }
};

/**
 * Manual credit wallet (for testing)
 */
exports.manualCreditWallet = async (req, res) => {
  try {
    console.log('💰 Manual wallet credit request');
    const userId = req.user._id;
    const { amount, currency = 'USD', description = 'Manual credit for testing' } = req.body;

    if (!amount || amount <= 0) {
      return errorResponse(res, 'Invalid amount', 400);
    }

    console.log(`💰 Crediting ${currency} ${amount} to user ${userId}`);

    const walletResult = await creditWalletExternal(
      userId,
      parseFloat(amount),
      currency,
      description,
      {
        metadata: {
          type: 'manual_credit',
          timestamp: new Date().toISOString()
        }
      }
    );

    if (walletResult.success) {
      console.log(`✅ Manual credit successful. New balance: ${currency} ${walletResult.newBalance}`);
      return successResponse(res, 'Wallet credited successfully', {
        amount: parseFloat(amount),
        currency,
        newBalance: walletResult.newBalance,
        description
      });
    } else {
      console.error('❌ Manual credit failed:', walletResult.error);
      return errorResponse(res, walletResult.error || 'Failed to credit wallet', 500);
    }

  } catch (error) {
    console.error('❌ Manual credit wallet error:', error);
    return errorResponse(res, 'Failed to credit wallet: ' + error.message, 500);
  }
};

/**
 * Get wallet statistics
 */
exports.getWalletStatistics = async (req, res) => {
  try {
    console.log('📈 Getting wallet statistics for user:', req.user._id);
    console.log('👤 User details:', {
      id: req.user._id,
      email: req.user.email,
      firstName: req.user.firstName,
      lastName: req.user.lastName
    });
    const userId = req.user._id;
    const { period = '30' } = req.query; // days

    const wallet = await Wallet.findOne({ user: userId });

    if (!wallet) {
      console.log('⚠️ Wallet not found for statistics, creating new wallet');
      const newWallet = await Wallet.findOrCreateWallet(userId);

      // Return default statistics for new wallet
      return successResponse(res, 'Wallet statistics retrieved successfully', {
        totalBalance: 0,
        balances: newWallet.balances,
        period: {
          days: parseInt(period),
          totalTransactions: 0,
          totalEarned: 0,
          totalSpent: 0
        },
        overall: newWallet.statistics
      });
    }
    
    // Calculate statistics for the specified period
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - parseInt(period));
    
    const periodTransactions = wallet.transactions.filter(tx => 
      new Date(tx.createdAt) >= periodStart
    );
    
    const statistics = {
      totalBalance: wallet.totalBalance,
      balances: wallet.balances,
      period: {
        days: parseInt(period),
        totalTransactions: periodTransactions.length,
        totalEarned: periodTransactions
          .filter(tx => ['credit', 'refund', 'bonus'].includes(tx.type))
          .reduce((sum, tx) => sum + tx.amount, 0),
        totalSpent: periodTransactions
          .filter(tx => ['debit', 'withdrawal', 'fee'].includes(tx.type))
          .reduce((sum, tx) => sum + tx.amount, 0)
      },
      overall: wallet.statistics
    };
    
    return successResponse(res, 'Wallet statistics retrieved successfully', statistics);
    
  } catch (error) {
    console.error('Get wallet statistics error:', error);
    return errorResponse(res, 'Failed to retrieve wallet statistics', 500);
  }
};

/**
 * Test transaction lookup - for debugging
 */
exports.testTransactionLookup = async (req, res) => {
  try {
    const { transactionId, transactionType = 'escrow' } = req.query;

    if (!transactionId) {
      return errorResponse(res, 'Transaction ID is required', 400);
    }

    console.log(`🧪 Testing transaction lookup: ${transactionId} (type: ${transactionType})`);

    let transaction;
    if (transactionType === 'escrow') {
      transaction = await findEscrowTransaction(transactionId, true);
    } else {
      transaction = await findStandardPayment(transactionId, true);
    }

    if (transaction) {
      return successResponse(res, 'Transaction found', {
        found: true,
        transaction: {
          _id: transaction._id,
          transactionId: transaction.transactionId,
          status: transaction.status,
          productPrice: transaction.productPrice,
          seller: transaction.seller,
          buyer: transaction.buyer,
          product: transaction.product
        }
      });
    } else {
      return successResponse(res, 'Transaction not found', {
        found: false,
        searchedFor: transactionId,
        type: transactionType
      });
    }

  } catch (error) {
    console.error('❌ Error testing transaction lookup:', error);
    return errorResponse(res, 'Test failed: ' + error.message, 500);
  }
};

/**
 * Test user isolation (Development function)
 */
exports.testUserIsolation = async (req, res) => {
  try {
    console.log('🧪 Testing user isolation...');
    console.log('👤 Current user:', {
      id: req.user._id,
      email: req.user.email,
      firstName: req.user.firstName,
      lastName: req.user.lastName
    });

    const userId = req.user._id;

    // Find current user's wallet
    const userWallet = await Wallet.findOne({ user: userId });

    // Find all wallets in the system
    const allWallets = await Wallet.find({}).select('user balances transactions').populate('user', 'firstName lastName email');

    const isolationTest = {
      currentUser: {
        id: userId.toString(),
        email: req.user.email,
        hasWallet: !!userWallet,
        walletId: userWallet?._id,
        balance: userWallet?.balances || {},
        transactionCount: userWallet?.transactions?.length || 0
      },
      allWalletsInSystem: allWallets.map(wallet => ({
        walletId: wallet._id,
        userId: wallet.user._id,
        userEmail: wallet.user.email,
        userName: `${wallet.user.firstName} ${wallet.user.lastName}`,
        balance: wallet.balances,
        transactionCount: wallet.transactions.length,
        isCurrentUser: wallet.user._id.toString() === userId.toString()
      })),
      isolationCheck: {
        totalWallets: allWallets.length,
        currentUserWalletFound: allWallets.some(w => w.user._id.toString() === userId.toString()),
        otherUsersWallets: allWallets.filter(w => w.user._id.toString() !== userId.toString()).length
      }
    };

    return successResponse(res, 'User isolation test completed', isolationTest);

  } catch (error) {
    console.error('❌ Error testing user isolation:', error);
    return errorResponse(res, 'Failed to test user isolation: ' + error.message, 500);
  }
};

/**
 * Check transaction status and details
 */
exports.checkTransaction = async (req, res) => {
  try {
    const { transactionId, transactionType = 'escrow' } = req.query;
    const userId = req.user._id;

    if (!transactionId) {
      return errorResponse(res, 'Transaction ID is required', 400);
    }

    console.log(`🔍 Checking transaction: ${transactionId} (type: ${transactionType}) for user: ${userId}`);
    console.log('🔍 User details:', {
      userId: userId.toString(),
      userType: typeof userId,
      userEmail: req.user.email,
      userName: req.user.firstName + ' ' + req.user.lastName
    });

    let transaction = null;
    let found = false;

    // Try to find the transaction based on type
    if (transactionType === 'escrow') {
      transaction = await findEscrowTransaction(transactionId, true);
      if (transaction) {
        found = true;
        console.log('✅ Found escrow transaction:', transaction._id);
      }
    } else if (transactionType === 'standard') {
      transaction = await findStandardPayment(transactionId, true);
      if (transaction) {
        found = true;
        console.log('✅ Found standard payment transaction:', transaction._id);
      }
    } else {
      // Try both if type is not specified or unknown
      transaction = await findEscrowTransaction(transactionId, true);
      if (transaction) {
        found = true;
        console.log('✅ Found escrow transaction:', transaction._id);
      } else {
        transaction = await findStandardPayment(transactionId, true);
        if (transaction) {
          found = true;
          console.log('✅ Found standard payment transaction:', transaction._id);
        }
      }
    }

    if (!found || !transaction) {
      console.log('❌ Transaction not found:', transactionId);
      return successResponse(res, 'Transaction not found', {
        found: false,
        transactionId,
        transactionType
      });
    }

    console.log('🔍 Transaction found, details:', {
      _id: transaction._id.toString(),
      transactionId: transaction.transactionId,
      status: transaction.status,
      buyer: transaction.buyer,
      seller: transaction.seller,
      buyerType: typeof transaction.buyer,
      sellerType: typeof transaction.seller
    });

    // Check if user has permission to view this transaction
    console.log('🔍 Permission check details:', {
      userId: userId.toString(),
      buyer: transaction.buyer,
      seller: transaction.seller,
      buyerType: typeof transaction.buyer,
      sellerType: typeof transaction.seller,
      buyerId: transaction.buyer?._id?.toString() || transaction.buyer?.toString(),
      sellerId: transaction.seller?._id?.toString() || transaction.seller?.toString()
    });

    // Handle both populated and non-populated buyer/seller fields
    const buyerId = transaction.buyer?._id?.toString() || transaction.buyer?.toString();
    const sellerId = transaction.seller?._id?.toString() || transaction.seller?.toString();

    const isOwner = buyerId === userId.toString() || sellerId === userId.toString();

    if (!isOwner) {
      console.log('❌ User does not have permission to view this transaction');
      console.log('❌ Permission denied details:', {
        userId: userId.toString(),
        buyerId,
        sellerId,
        isBuyer: buyerId === userId.toString(),
        isSeller: sellerId === userId.toString()
      });
      return errorResponse(res, 'You do not have permission to view this transaction', 403);
    }

    // Return transaction details
    const transactionData = {
      found: true,
      transactionId: transaction.transactionId,
      status: transaction.status,
      amount: transaction.amount || transaction.productPrice,
      currency: transaction.currency,
      buyer: transaction.buyer,
      seller: transaction.seller,
      product: transaction.product,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
      type: transactionType === 'escrow' || transaction.escrowTransaction ? 'escrow' : 'standard'
    };

    console.log('✅ Transaction check successful');
    return successResponse(res, 'Transaction found', transactionData);

  } catch (error) {
    console.error('❌ Error checking transaction:', error);
    return errorResponse(res, 'Failed to check transaction: ' + error.message, 500);
  }
};

/**
 * Debug specific transaction ID (Development function)
 */
exports.debugTransactionId = async (req, res) => {
  try {
    const { transactionId } = req.query;

    if (!transactionId) {
      return errorResponse(res, 'Transaction ID is required', 400);
    }

    console.log(`🔍 Debug search for transaction ID: ${transactionId}`);

    // Import models
    const mongoose = require('mongoose');
    const Order = require('../../../../db/models/orderModel');
    const EscrowTransaction = require('../../../../db/models/escrowTransactionModel');
    const StandardPayment = require('../../../../db/models/standardPaymentModel');

    const isValidObjectId = mongoose.Types.ObjectId.isValid(transactionId) && /^[0-9a-fA-F]{24}$/.test(transactionId);

    const debugInfo = {
      searchedId: transactionId,
      isValidObjectId,
      searchResults: {}
    };

    // Search in all collections
    try {
      // EscrowTransaction searches
      debugInfo.searchResults.escrowTransaction = {
        byId: await EscrowTransaction.findById(transactionId).select('_id transactionId gatewayTransactionId status'),
        byTransactionId: await EscrowTransaction.findOne({ transactionId }).select('_id transactionId gatewayTransactionId status'),
        byGatewayTransactionId: await EscrowTransaction.findOne({ gatewayTransactionId: transactionId }).select('_id transactionId gatewayTransactionId status')
      };

      // StandardPayment searches
      debugInfo.searchResults.standardPayment = {
        byId: await StandardPayment.findById(transactionId).select('_id transactionId gatewayTransactionId status'),
        byTransactionId: await StandardPayment.findOne({ transactionId }).select('_id transactionId gatewayTransactionId status'),
        byGatewayTransactionId: await StandardPayment.findOne({ gatewayTransactionId: transactionId }).select('_id transactionId gatewayTransactionId status')
      };

      // Order searches
      debugInfo.searchResults.order = {
        byId: isValidObjectId ? await Order.findById(transactionId).select('_id orderNumber payment.transactionId status') : null,
        byOrderNumber: await Order.findOne({ orderNumber: transactionId }).select('_id orderNumber payment.transactionId status'),
        byPaymentTransactionId: await Order.findOne({ 'payment.transactionId': transactionId }).select('_id orderNumber payment.transactionId status')
      };

      // Database stats
      debugInfo.databaseStats = {
        escrowTransactionCount: await EscrowTransaction.countDocuments(),
        standardPaymentCount: await StandardPayment.countDocuments(),
        orderCount: await Order.countDocuments()
      };

      // Recent transactions for reference
      debugInfo.recentTransactions = {
        escrowTransactions: await EscrowTransaction.find().limit(5).select('_id transactionId gatewayTransactionId status createdAt'),
        standardPayments: await StandardPayment.find().limit(5).select('_id transactionId gatewayTransactionId status createdAt'),
        orders: await Order.find().limit(5).select('_id orderNumber payment.transactionId status createdAt')
      };

    } catch (searchError) {
      debugInfo.error = searchError.message;
    }

    return successResponse(res, 'Transaction debug completed', debugInfo);

  } catch (error) {
    console.error('❌ Error debugging transaction:', error);
    return errorResponse(res, 'Failed to debug transaction: ' + error.message, 500);
  }
};

/**
 * Fix wallet duplicate transaction IDs (Admin function)
 */
exports.fixWalletDuplicateKeys = async (req, res) => {
  try {
    console.log('🔧 Starting wallet duplicate key fix...');

    // First, let's drop the problematic index if it exists
    try {
      await Wallet.collection.dropIndex('transactions.transactionId_1');
      console.log('✅ Dropped problematic index: transactions.transactionId_1');
    } catch (indexError) {
      console.log('ℹ️ Index transactions.transactionId_1 does not exist or already dropped');
    }

    // Find all wallets
    const wallets = await Wallet.find({});
    console.log(`📊 Found ${wallets.length} wallets to check`);

    let fixedWallets = 0;
    let fixedTransactions = 0;

    for (const wallet of wallets) {
      let walletModified = false;
      const seenTransactionIds = new Set();

      console.log(`🔍 Checking wallet for user: ${wallet.user}`);

      // Check each transaction in the wallet
      for (let i = 0; i < wallet.transactions.length; i++) {
        const transaction = wallet.transactions[i];

        // Fix null or duplicate transaction IDs
        if (!transaction.transactionId || seenTransactionIds.has(transaction.transactionId)) {
          const oldId = transaction.transactionId;
          const timestamp = transaction.createdAt ? transaction.createdAt.getTime() : Date.now();
          const userPart = wallet.user.toString().slice(-6);
          const random = Math.random().toString(36).substring(2, 8).toUpperCase();
          const newId = `WTX_${timestamp}_${userPart}_${random}`;

          wallet.transactions[i].transactionId = newId;
          seenTransactionIds.add(newId);
          walletModified = true;
          fixedTransactions++;

          console.log(`  🔧 Fixed transaction ID: ${oldId || 'null'} → ${newId}`);
        } else {
          seenTransactionIds.add(transaction.transactionId);
        }
      }

      // Save wallet if modified
      if (walletModified) {
        try {
          await wallet.save();
          fixedWallets++;
          console.log(`  ✅ Saved wallet for user: ${wallet.user}`);
        } catch (saveError) {
          console.error(`  ❌ Error saving wallet for user ${wallet.user}:`, saveError.message);
        }
      }
    }

    return successResponse(res, 'Wallet duplicate key fix completed', {
      walletsChecked: wallets.length,
      walletsFixed: fixedWallets,
      transactionsFixed: fixedTransactions,
      indexDropped: true
    });

  } catch (error) {
    console.error('❌ Error fixing wallet duplicate keys:', error);
    return errorResponse(res, 'Failed to fix wallet duplicate keys: ' + error.message, 500);
  }
};
