const EscrowTransaction = require('../../../../db/models/escrowTransactionModel');
const PaymentGateway = require('../../../../db/models/paymentGatewayModel');
const PlatformFee = require('../../../../db/models/platformFeeModel');
const paymentGatewayFactory = require('../../../../services/payment/PaymentGatewayFactory');
const payoutService = require('../../../../services/payout/PayoutService');
const currencyService = require('../../../../services/currency/CurrencyService');
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');

/**
 * Get escrow dashboard statistics
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate;
    
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get transaction statistics
    const transactionStats = await EscrowTransaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalVolume: { $sum: '$totalAmount' },
          totalPlatformFees: { $sum: '$platformFeeAmount' },
          totalGatewayFees: { $sum: '$gatewayFeeAmount' },
          completedTransactions: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          pendingTransactions: {
            $sum: { $cond: [{ $in: ['$status', ['pending_payment', 'payment_processing', 'funds_held', 'shipped']] }, 1, 0] }
          },
          failedTransactions: {
            $sum: { $cond: [{ $in: ['$status', ['payment_failed', 'cancelled']] }, 1, 0] }
          },
          disputedTransactions: {
            $sum: { $cond: [{ $eq: ['$status', 'disputed'] }, 1, 0] }
          }
        }
      }
    ]);

    // Get status breakdown
    const statusBreakdown = await EscrowTransaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    // Get gateway breakdown
    const gatewayBreakdown = await EscrowTransaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$paymentGateway',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          successRate: {
            $avg: {
              $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
            }
          }
        }
      }
    ]);

    // Get currency breakdown
    const currencyBreakdown = await EscrowTransaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$currency',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    // Get payout statistics
    const payoutStats = await payoutService.getPayoutStatistics({
      startDate: startDate.toISOString(),
      endDate: now.toISOString()
    });

    const stats = transactionStats[0] || {
      totalTransactions: 0,
      totalVolume: 0,
      totalPlatformFees: 0,
      totalGatewayFees: 0,
      completedTransactions: 0,
      pendingTransactions: 0,
      failedTransactions: 0,
      disputedTransactions: 0
    };

    return successResponse(res, 'Dashboard statistics retrieved successfully', {
      period,
      dateRange: { startDate, endDate: now },
      overview: {
        ...stats,
        successRate: stats.totalTransactions > 0 ? (stats.completedTransactions / stats.totalTransactions * 100).toFixed(2) : 0,
        averageTransactionValue: stats.totalTransactions > 0 ? (stats.totalVolume / stats.totalTransactions).toFixed(2) : 0
      },
      breakdowns: {
        status: statusBreakdown,
        gateway: gatewayBreakdown,
        currency: currencyBreakdown
      },
      payouts: payoutStats
    });

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    return errorResponse(res, 'Failed to retrieve dashboard statistics', 500);
  }
};

/**
 * Get all escrow transactions with filters
 */
exports.getAllTransactions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      gateway,
      currency,
      startDate,
      endDate,
      search
    } = req.query;

    const skip = (page - 1) * limit;
    let query = {};

    // Apply filters
    if (status) query.status = status;
    if (gateway) query.paymentGateway = gateway;
    if (currency) query.currency = currency;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (search) {
      query.$or = [
        { transactionId: { $regex: search, $options: 'i' } },
        { gatewayTransactionId: { $regex: search, $options: 'i' } }
      ];
    }

    const transactions = await EscrowTransaction.find(query)
      .populate('buyer', 'firstName lastName email')
      .populate('seller', 'firstName lastName email')
      .populate('product', 'title price')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await EscrowTransaction.countDocuments(query);

    return successResponse(res, 'Transactions retrieved successfully', {
      transactions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalTransactions: total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      },
      filters: { status, gateway, currency, startDate, endDate, search }
    });

  } catch (error) {
    console.error('Get all transactions error:', error);
    return errorResponse(res, 'Failed to retrieve transactions', 500);
  }
};

/**
 * Get transaction details
 */
exports.getTransactionDetails = async (req, res) => {
  try {
    const { transactionId } = req.params;

    const transaction = await EscrowTransaction.findById(transactionId)
      .populate('buyer', 'firstName lastName email phone profile')
      .populate('seller', 'firstName lastName email phone profile')
      .populate('product', 'title price product_photos description')
      .populate('offer', 'offerAmount originalPrice status');

    if (!transaction) {
      return errorResponse(res, 'Transaction not found', 404);
    }

    return successResponse(res, 'Transaction details retrieved successfully', {
      transaction
    });

  } catch (error) {
    console.error('Get transaction details error:', error);
    return errorResponse(res, 'Failed to retrieve transaction details', 500);
  }
};

/**
 * Update transaction status (admin action)
 */
exports.updateTransactionStatus = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { status, note } = req.body;

    if (!status) {
      return errorResponse(res, 'Status is required', 400);
    }

    const transaction = await EscrowTransaction.findById(transactionId);
    if (!transaction) {
      return errorResponse(res, 'Transaction not found', 404);
    }

    await transaction.updateStatus(status, note || `Admin updated status to ${status}`);

    return successResponse(res, 'Transaction status updated successfully', {
      transactionId: transaction.transactionId,
      oldStatus: transaction.statusHistory[transaction.statusHistory.length - 2]?.status,
      newStatus: status
    });

  } catch (error) {
    console.error('Update transaction status error:', error);
    return errorResponse(res, 'Failed to update transaction status', 500);
  }
};

/**
 * Process manual payout
 */
exports.processManualPayout = async (req, res) => {
  try {
    const { transactionId } = req.params;

    const result = await payoutService.processPayout(transactionId);

    if (result.success) {
      return successResponse(res, 'Payout processed successfully', result);
    } else {
      return errorResponse(res, result.error || 'Payout processing failed', 400);
    }

  } catch (error) {
    console.error('Process manual payout error:', error);
    return errorResponse(res, 'Failed to process payout', 500);
  }
};

/**
 * Get payment gateway status
 */
exports.getGatewayStatus = async (req, res) => {
  try {
    const gatewayStatus = paymentGatewayFactory.getGatewayStatus();
    const healthCheck = await paymentGatewayFactory.healthCheck();

    return successResponse(res, 'Gateway status retrieved successfully', {
      gateways: gatewayStatus,
      healthCheck
    });

  } catch (error) {
    console.error('Get gateway status error:', error);
    return errorResponse(res, 'Failed to retrieve gateway status', 500);
  }
};

/**
 * Get currency statistics
 */
exports.getCurrencyStats = async (req, res) => {
  try {
    const currencyStats = currencyService.getStatistics();
    const supportedCurrencies = currencyService.getSupportedCurrencies();

    return successResponse(res, 'Currency statistics retrieved successfully', {
      statistics: currencyStats,
      currencies: supportedCurrencies
    });

  } catch (error) {
    console.error('Get currency stats error:', error);
    return errorResponse(res, 'Failed to retrieve currency statistics', 500);
  }
};

/**
 * Update exchange rates manually
 */
exports.updateExchangeRates = async (req, res) => {
  try {
    const updateResult = await currencyService.updateExchangeRates();

    if (updateResult) {
      const currencies = currencyService.getSupportedCurrencies();
      return successResponse(res, 'Exchange rates updated successfully', currencies);
    } else {
      return errorResponse(res, 'Failed to update exchange rates', 500);
    }

  } catch (error) {
    console.error('Update exchange rates error:', error);
    return errorResponse(res, 'Failed to update exchange rates', 500);
  }
};

module.exports = exports;
