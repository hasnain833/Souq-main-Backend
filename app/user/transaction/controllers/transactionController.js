const TransactionStatusService = require('../../../../services/transaction/TransactionStatusService');
const { findStandardPayment, findEscrowTransaction } = require('../../../../utils/transactionUtils');
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');

// Models will be imported dynamically when needed to avoid circular dependencies

/**
 * Test endpoint to check if transaction routes are working
 */
exports.testTransactionRoutes = async (req, res) => {
  try {
    console.log('🧪 Transaction routes test endpoint called');
    console.log('👤 User:', req.user ? req.user._id : 'No user');
    console.log('📋 Params:', req.params);

    return successResponse(res, 'Transaction routes are working!', {
      timestamp: new Date().toISOString(),
      user: req.user ? {
        id: req.user._id,
        email: req.user.email
      } : null,
      params: req.params
    });

  } catch (error) {
    console.error('❌ Test transaction routes error:', error);
    return errorResponse(res, error.message || 'Test failed', 500);
  }
};

/**
 * Debug transaction lookup - for troubleshooting
 */
exports.debugTransactionLookup = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const userId = req.user?._id;

    console.log('🔍 Debug transaction lookup:', { transactionId, userId: userId?.toString() });

    // Try escrow first
    let escrowTransaction = await findEscrowTransaction(transactionId, true);
    let standardPayment = await findStandardPayment(transactionId, true);

    const debugInfo = {
      transactionId,
      userId: userId?.toString(),
      escrowFound: !!escrowTransaction,
      standardFound: !!standardPayment,
      escrowDetails: escrowTransaction ? {
        _id: escrowTransaction._id,
        status: escrowTransaction.status,
        buyer: escrowTransaction.buyer,
        seller: escrowTransaction.seller,
        buyerType: typeof escrowTransaction.buyer,
        sellerType: typeof escrowTransaction.seller
      } : null,
      standardDetails: standardPayment ? {
        _id: standardPayment._id,
        status: standardPayment.status,
        buyer: standardPayment.buyer,
        seller: standardPayment.seller,
        buyerType: typeof standardPayment.buyer,
        sellerType: typeof standardPayment.seller
      } : null
    };

    return successResponse(res, 'Debug info retrieved', debugInfo);

  } catch (error) {
    console.error('❌ Debug transaction lookup error:', error);
    return errorResponse(res, error.message || 'Debug failed', 500);
  }
};

/**
 * Update transaction status
 */
exports.updateTransactionStatus = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { status, notes } = req.body;
    const userId = req.user._id;
    
    console.log(`🔄 Update transaction status request:`, {
      transactionId,
      status,
      userId: userId.toString(),
      notes
    });
    
    if (!status) {
      return errorResponse(res, 'Status is required', 400);
    }
    
    // Check if user has permission to update this transaction
    const hasPermission = await checkTransactionPermission(transactionId, userId, true);
    if (!hasPermission.allowed) {
      console.log('❌ Update permission denied:', hasPermission.reason);
      return errorResponse(res, hasPermission.reason, 403);
    }
    
    // Update transaction status
    const result = await TransactionStatusService.updateTransactionStatus(
      transactionId,
      status,
      userId.toString(),
      notes || ''
    );
    
    return successResponse(res, 'Transaction status updated successfully', {
      transactionId,
      oldStatus: result.oldStatus,
      newStatus: result.newStatus,
      progress: TransactionStatusService.getTransactionProgress(result.newStatus, hasPermission.transactionType)
    });
    
  } catch (error) {
    console.error('❌ Update transaction status error:', error);
    return errorResponse(res, error.message || 'Failed to update transaction status', 500);
  }
};

/**
 * Get transaction status and progress
 */
exports.getTransactionStatus = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const userId = req.user?._id;

    console.log(`🔍 Get transaction status request:`, {
      transactionId,
      userId: userId?.toString(),
      userExists: !!req.user,
      headers: {
        authorization: req.headers.authorization ? 'Present' : 'Missing'
      }
    });

    if (!userId) {
      console.log('❌ No user found in request');
      return errorResponse(res, 'Authentication required', 401);
    }

    // Check if user has permission to view this transaction
    const hasPermission = await checkTransactionPermission(transactionId, userId, false);
    if (!hasPermission.allowed) {
      console.log('❌ Permission denied:', hasPermission.reason);

      // If transaction not found, return 404 instead of 403
      if (hasPermission.reason === 'Transaction not found') {
        return errorResponse(res, 'Transaction not found', 404);
      }

      return errorResponse(res, hasPermission.reason, 403);
    }

    const transaction = hasPermission.transaction;
    const transactionType = hasPermission.transactionType;

    console.log('✅ Permission granted, getting transaction progress...');

    const progress = TransactionStatusService.getTransactionProgress(transaction.status, transactionType);
    const nextStatuses = TransactionStatusService.getNextPossibleStatuses(transaction.status, transactionType);

    console.log('✅ Transaction status retrieved successfully');

    return successResponse(res, 'Transaction status retrieved', {
      transactionId: transaction.transactionId,
      status: transaction.status,
      progress,
      transactionType,
      nextPossibleStatuses: nextStatuses,
      statusHistory: transaction.statusHistory || [],
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
      userRole: hasPermission.userRole
    });

  } catch (error) {
    console.error('❌ Get transaction status error:', error);
    console.error('❌ Error stack:', error.stack);
    return errorResponse(res, error.message || 'Failed to get transaction status', 500);
  }
};

/**
 * Get available status transitions for a transaction
 */
exports.getAvailableTransitions = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const userId = req.user._id;
    
    console.log(`🔍 Get available transitions request: ${transactionId}`);
    
    // Find transaction and check permissions
    const hasPermission = await checkTransactionPermission(transactionId, userId, false);
    if (!hasPermission.allowed) {
      console.log('❌ View permission denied:', hasPermission.reason);

      // If transaction not found, return 404 instead of 403
      if (hasPermission.reason === 'Transaction not found') {
        return errorResponse(res, 'Transaction not found', 404);
      }

      return errorResponse(res, hasPermission.reason, 403);
    }
    
    const transaction = hasPermission.transaction;
    const nextStatuses = TransactionStatusService.getNextPossibleStatuses(
      transaction.status, 
      hasPermission.transactionType
    );
    
    // Filter statuses based on user role
    const userRole = hasPermission.userRole;
    const allowedStatuses = filterStatusesByRole(nextStatuses, userRole, transaction.status);
    
    return successResponse(res, 'Available transitions retrieved', {
      transactionId: transaction.transactionId,
      currentStatus: transaction.status,
      userRole,
      availableTransitions: allowedStatuses.map(status => ({
        status,
        label: getStatusLabel(status),
        description: getStatusDescription(status),
        requiresConfirmation: requiresConfirmation(status)
      }))
    });
    
  } catch (error) {
    console.error('❌ Get available transitions error:', error);
    return errorResponse(res, error.message || 'Failed to get available transitions', 500);
  }
};

/**
 * Bulk update transaction statuses (admin only)
 */
exports.bulkUpdateTransactionStatus = async (req, res) => {
  try {
    const { transactions, status, notes } = req.body;
    const userId = req.user._id;
    
    console.log(`🔄 Bulk update transaction status request:`, {
      transactionCount: transactions?.length,
      status,
      userId: userId.toString()
    });
    
    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return errorResponse(res, 'Transactions array is required', 400);
    }
    
    if (!status) {
      return errorResponse(res, 'Status is required', 400);
    }
    
    const results = {
      successful: [],
      failed: []
    };
    
    for (const transactionId of transactions) {
      try {
        const result = await TransactionStatusService.updateTransactionStatus(
          transactionId,
          status,
          userId.toString(),
          notes || ''
        );
        
        results.successful.push({
          transactionId,
          oldStatus: result.oldStatus,
          newStatus: result.newStatus
        });
        
      } catch (error) {
        results.failed.push({
          transactionId,
          error: error.message
        });
      }
    }
    
    return successResponse(res, 'Bulk update completed', {
      total: transactions.length,
      successful: results.successful.length,
      failed: results.failed.length,
      results
    });
    
  } catch (error) {
    console.error('❌ Bulk update transaction status error:', error);
    return errorResponse(res, error.message || 'Failed to bulk update transaction status', 500);
  }
};

/**
 * Check if user has permission to view/update transaction
 */
async function checkTransactionPermission(transactionId, userId, requireUpdatePermission = false) {
  try {
    console.log(`🔍 Checking transaction permission for: ${transactionId}, user: ${userId}`);
    console.log(`🔍 Transaction ID details:`, {
      transactionId,
      length: transactionId.length,
      isValidObjectId: require('mongoose').Types.ObjectId.isValid(transactionId)
    });

    // Try escrow first
    let transaction = await findEscrowTransaction(transactionId, true);
    let transactionType = 'escrow';

    if (!transaction) {
      console.log('🔍 Not found in escrow, trying standard payments...');
      transaction = await findStandardPayment(transactionId, true);
      transactionType = 'standard';
    }

    // If still not found, try direct database queries as fallback
    if (!transaction) {
      console.log('🔍 Not found via utility functions, trying direct database queries...');

      try {
        // Import models dynamically to avoid circular dependencies
        const EscrowTransaction = require('../../../../db/models/escrowTransactionModel');
        const StandardPayment = require('../../../../db/models/standardPaymentModel');
        const Transaction = require('../../../../db/models/transactionModel');

        // Check if it's a valid ObjectId
        const isValidObjectId = require('mongoose').Types.ObjectId.isValid(transactionId) && /^[0-9a-fA-F]{24}$/.test(transactionId);

        if (isValidObjectId) {
          // Try direct Transaction lookup (escrow payment records)
          transaction = await Transaction.findById(transactionId)
            .populate('buyer', '_id firstName lastName email username profile_picture')
            .populate('seller', '_id firstName lastName email username profile_picture')
            .populate('product', '_id title price product_photos brand size condition material colors user')
            .populate('escrowTransaction');

          if (transaction) {
            console.log('✅ Found via direct Transaction query (escrow payment record)');
            transactionType = 'escrow';
          } else {
            // Try direct EscrowTransaction lookup
            transaction = await EscrowTransaction.findById(transactionId)
              .populate('buyer', '_id firstName lastName email username profile_picture')
              .populate('seller', '_id firstName lastName email username profile_picture')
              .populate('product', '_id title price product_photos brand size condition material colors user');

            if (transaction) {
              console.log('✅ Found via direct EscrowTransaction query');
              transactionType = 'escrow';
            } else {
              // Try direct StandardPayment lookup
              transaction = await StandardPayment.findById(transactionId)
                .populate('buyer', '_id firstName lastName email username profile_picture')
                .populate('seller', '_id firstName lastName email username profile_picture')
                .populate('product', '_id title price product_photos brand size condition material colors user');

              if (transaction) {
                console.log('✅ Found via direct StandardPayment query');
                transactionType = 'standard';
              }
            }
          }
        }
      } catch (modelError) {
        console.log('❌ Error loading models for direct queries:', modelError.message);
      }
    }

    // If still not found and transactionId looks like an order number (TXN_*),
    // try to find the order and get the actual payment ID
    if (!transaction && transactionId.startsWith('TXN_')) {
      console.log('🔍 Transaction not found directly, trying order-based lookup...');

      try {
        const Transaction = require('../../../../db/models/transactionModel');

        // Find transaction by transactionId
        const order = await Transaction.findOne({ transactionId: transactionId })
          .populate('buyer', '_id firstName lastName email username')
          .populate('seller', '_id firstName lastName email username')
          .populate('escrowTransaction');

        if (order) {
          console.log(`✅ Found transaction with transactionId ${transactionId}:`, {
            _id: order._id,
            transactionId: order.transactionId,
            status: order.status,
            escrowTransaction: order.escrowTransaction
          });

          if (order.escrowTransaction) {
            // This is an escrow transaction, use the populated escrowTransaction
            transaction = order.escrowTransaction;
            transactionType = 'escrow';
            console.log(`✅ Found escrow transaction via Transaction lookup: ${transaction._id}`);
          } else {
            // This might be a standard payment, try to find it
            transaction = await findStandardPayment(order._id.toString(), true);
            transactionType = 'standard';
            if (transaction) {
              console.log(`✅ Found standard payment via Transaction lookup: ${transaction._id}`);
            }
          }
        } else {
          console.log(`❌ No transaction found with transactionId: ${transactionId}`);
        }
      } catch (orderError) {
        console.error('❌ Error in order-based lookup:', orderError);
      }
    }

    if (!transaction) {
      console.log('❌ Transaction not found in either escrow or standard payments');
      console.log('🔍 Attempted lookups:', {
        transactionId,
        escrowAttempted: true,
        standardAttempted: true,
        orderLookupAttempted: transactionId.startsWith('TXN_')
      });
      return { allowed: false, reason: 'Transaction not found' };
    }

    // console.log(`✅ Found ${transactionType} transaction:`, {
    //   _id: transaction._id.toString(),
    //   transactionId: transaction.transactionId,
    //   status: transaction.status,
    //   orderStatus: transaction.orderStatus,
    //   buyer: transaction.buyer,
    //   seller: transaction.seller,
    //   buyerType: typeof transaction.buyer,
    //   sellerType: typeof transaction.seller,
    //   buyerPopulated: !!transaction.buyer?._id,
    //   sellerPopulated: !!transaction.seller?._id
    // });

    // Check if buyer and seller are properly populated
    if (!transaction.buyer || !transaction.seller) {
      console.log('❌ Transaction buyer or seller not properly populated');
      return { allowed: false, reason: 'Transaction data incomplete - buyer or seller missing' };
    }

    // Extract user IDs - handle both ObjectId and populated objects
    let buyerId = null;
    let sellerId = null;

    if (typeof transaction.buyer === 'object' && transaction.buyer._id) {
      buyerId = transaction.buyer._id.toString();
    } else if (typeof transaction.buyer === 'string') {
      buyerId = transaction.buyer;
    }

    if (typeof transaction.seller === 'object' && transaction.seller._id) {
      sellerId = transaction.seller._id.toString();
    } else if (typeof transaction.seller === 'string') {
      sellerId = transaction.seller;
    }

    console.log(`👤 User ID extraction:`, {
      requestUserId: userId.toString(),
      buyerId,
      sellerId
    });

    // Check if user is buyer or seller
    const isBuyer = buyerId && buyerId === userId.toString();
    const isSeller = sellerId && sellerId === userId.toString();

    console.log(`👤 User role check: isBuyer=${isBuyer}, isSeller=${isSeller}`);

    if (!isBuyer && !isSeller) {
      console.log('❌ User not authorized - not buyer or seller');
      console.log('❌ Authorization failed details:', {
        userId: userId.toString(),
        buyerId,
        sellerId,
        buyerMatch: buyerId === userId.toString(),
        sellerMatch: sellerId === userId.toString(),
        hasBuyerId: !!buyerId,
        hasSellerId: !!sellerId
      });
      return { allowed: false, reason: 'You do not have permission to view this transaction' };
    }

    // For view operations, being buyer or seller is enough
    // For update operations, check additional permissions if needed
    if (requireUpdatePermission) {
      // Add any additional update permission checks here if needed
      console.log('✅ Update permission granted');
    }

    return {
      allowed: true,
      transaction,
      transactionType,
      userRole: isBuyer ? 'buyer' : 'seller'
    };

  } catch (error) {
    console.error('❌ Error checking transaction permission:', error);
    return { allowed: false, reason: 'Failed to check permissions: ' + error.message };
  }
}

/**
 * Filter available statuses based on user role
 */
function filterStatusesByRole(statuses, userRole, currentStatus) {
  const buyerAllowedActions = {
    'delivered': ['completed'], // Buyer can confirm delivery
    'dispute_opened': ['dispute_resolved'] // Buyer can resolve dispute
  };
  
  const sellerAllowedActions = {
    'funds_held': ['shipped'], // Seller can mark as shipped
    'payment_confirmed': ['shipped'], // Seller can mark as shipped
    'shipped': ['in_transit'], // Seller can update shipping status
    'dispute_opened': ['dispute_resolved'] // Seller can resolve dispute
  };
  
  const allowedActions = userRole === 'buyer' ? buyerAllowedActions : sellerAllowedActions;
  const userAllowedStatuses = allowedActions[currentStatus] || [];
  
  return statuses.filter(status => userAllowedStatuses.includes(status));
}

/**
 * Get human-readable status label
 */
function getStatusLabel(status) {
  const labels = {
    'processing': 'Mark as Processing',
    'payment_confirmed': 'Confirm Payment',
    'funds_held': 'Funds Secured',
    'shipped': 'Mark as Shipped',
    'in_transit': 'In Transit',
    'delivered': 'Confirm Delivery',
    'completed': 'Complete Transaction',
    'cancelled': 'Cancel Transaction',
    'dispute_opened': 'Open Dispute',
    'dispute_resolved': 'Resolve Dispute'
  };
  
  return labels[status] || status;
}

/**
 * Get status description
 */
function getStatusDescription(status) {
  const descriptions = {
    'processing': 'Mark the payment as being processed',
    'payment_confirmed': 'Confirm that payment has been received',
    'funds_held': 'Funds are secured in escrow',
    'shipped': 'Mark the item as shipped to buyer',
    'in_transit': 'Item is in transit to buyer',
    'delivered': 'Confirm that item has been delivered',
    'completed': 'Complete the transaction and release funds',
    'cancelled': 'Cancel the transaction',
    'dispute_opened': 'Open a dispute for this transaction',
    'dispute_resolved': 'Mark the dispute as resolved'
  };
  
  return descriptions[status] || '';
}

/**
 * Check if status change requires confirmation
 */
function requiresConfirmation(status) {
  const confirmationRequired = ['completed', 'cancelled', 'dispute_opened', 'refunded'];
  return confirmationRequired.includes(status);
}
