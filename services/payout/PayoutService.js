const EscrowTransaction = require('../../db/models/escrowTransactionModel');
const PlatformFee = require('../../db/models/platformFeeModel');
const User = require('../../db/models/userModel');
const paymentGatewayFactory = require('../payment/PaymentGatewayFactory');

class PayoutService {
  constructor() {
    this.processingQueue = new Map();
  }

  /**
   * Process payout for completed escrow transaction
   * @param {string} escrowTransactionId - Escrow transaction ID
   * @returns {Promise<Object>} Payout result
   */
  async processPayout(escrowTransactionId) {
    try {
      // Prevent duplicate processing
      if (this.processingQueue.has(escrowTransactionId)) {
        return {
          success: false,
          error: 'Payout already being processed'
        };
      }

      this.processingQueue.set(escrowTransactionId, Date.now());

      const escrowTransaction = await EscrowTransaction.findById(escrowTransactionId)
        .populate('seller', 'firstName lastName email')
        .populate('product', 'title');

      if (!escrowTransaction) {
        this.processingQueue.delete(escrowTransactionId);
        return {
          success: false,
          error: 'Escrow transaction not found'
        };
      }

      // Check if transaction is eligible for payout
      if (escrowTransaction.status !== 'delivered') {
        this.processingQueue.delete(escrowTransactionId);
        return {
          success: false,
          error: 'Transaction must be in delivered status for payout'
        };
      }

      // Check if payout already processed
      if (escrowTransaction.payoutDetails.payoutProcessedAt) {
        this.processingQueue.delete(escrowTransactionId);
        return {
          success: false,
          error: 'Payout already processed'
        };
      }

      // Calculate final payout amount
      const payoutCalculation = this.calculatePayoutAmount(escrowTransaction);

      // Get seller's preferred payout method
      const seller = escrowTransaction.seller;
      const payoutMethod = await this.getSellerPayoutMethod(seller._id);

      // Process payout based on method
      let payoutResult;
      switch (payoutMethod.method) {
        case 'bank_transfer':
          payoutResult = await this.processBankTransfer(escrowTransaction, payoutCalculation, payoutMethod);
          break;
        case 'paypal':
          payoutResult = await this.processPayPalPayout(escrowTransaction, payoutCalculation, payoutMethod);
          break;
        case 'stripe':
          payoutResult = await this.processStripePayout(escrowTransaction, payoutCalculation, payoutMethod);
          break;
        case 'wallet':
          payoutResult = await this.processWalletPayout(escrowTransaction, payoutCalculation, payoutMethod);
          break;
        default:
          payoutResult = {
            success: false,
            error: 'Unsupported payout method'
          };
      }

      // Update escrow transaction with payout details
      if (payoutResult.success) {
        escrowTransaction.payoutDetails = {
          payoutMethod: payoutMethod.method,
          payoutReference: payoutResult.payoutReference,
          payoutProcessedAt: new Date(),
          payoutAmount: payoutCalculation.finalAmount
        };

        await escrowTransaction.updateStatus('completed', 'Payout processed successfully');

        // Record platform fee collection
        await this.recordPlatformFeeCollection(escrowTransaction, payoutCalculation);
      }

      this.processingQueue.delete(escrowTransactionId);
      return payoutResult;

    } catch (error) {
      this.processingQueue.delete(escrowTransactionId);
      console.error('Payout processing error:', error);
      return {
        success: false,
        error: error.message,
        details: error
      };
    }
  }

  /**
   * Calculate payout amount after fees
   * @param {Object} escrowTransaction - Escrow transaction
   * @returns {Object} Payout calculation details
   */
  calculatePayoutAmount(escrowTransaction) {
    const productPrice = escrowTransaction.productPrice;
    const platformFeeAmount = escrowTransaction.platformFeeAmount;
    const gatewayFeeAmount = escrowTransaction.gatewayFeeAmount;
    const gatewayFeePaidBy = escrowTransaction.gatewayFeePaidBy;

    let finalAmount = productPrice - platformFeeAmount;

    // Deduct gateway fee if paid by seller
    if (gatewayFeePaidBy === 'seller') {
      finalAmount -= gatewayFeeAmount;
    }

    // Ensure minimum payout amount
    finalAmount = Math.max(0, finalAmount);

    return {
      productPrice,
      platformFeeAmount,
      gatewayFeeAmount,
      gatewayFeePaidBy,
      finalAmount,
      currency: escrowTransaction.currency
    };
  }

  /**
   * Get seller's preferred payout method
   * @param {string} sellerId - Seller ID
   * @returns {Promise<Object>} Payout method details
   */
  async getSellerPayoutMethod(sellerId) {
    // TODO: Implement seller payout preferences in user model
    // For now, return default method
    return {
      method: 'bank_transfer',
      details: {
        accountNumber: '****1234',
        bankName: 'Default Bank',
        accountHolder: 'Seller Name'
      }
    };
  }

  /**
   * Process bank transfer payout
   * @param {Object} escrowTransaction - Escrow transaction
   * @param {Object} payoutCalculation - Payout calculation
   * @param {Object} payoutMethod - Payout method details
   * @returns {Promise<Object>} Payout result
   */
  async processBankTransfer(escrowTransaction, payoutCalculation, payoutMethod) {
    try {
      // TODO: Integrate with bank transfer API
      // For now, simulate successful transfer
      
      const payoutReference = `BT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      console.log(`💰 Bank transfer payout processed:`, {
        transactionId: escrowTransaction.transactionId,
        sellerId: escrowTransaction.seller._id,
        amount: payoutCalculation.finalAmount,
        currency: payoutCalculation.currency,
        payoutReference
      });

      return {
        success: true,
        payoutReference,
        method: 'bank_transfer',
        amount: payoutCalculation.finalAmount,
        currency: payoutCalculation.currency,
        processedAt: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        method: 'bank_transfer'
      };
    }
  }

  /**
   * Process PayPal payout
   * @param {Object} escrowTransaction - Escrow transaction
   * @param {Object} payoutCalculation - Payout calculation
   * @param {Object} payoutMethod - Payout method details
   * @returns {Promise<Object>} Payout result
   */
  async processPayPalPayout(escrowTransaction, payoutCalculation, payoutMethod) {
    try {
      // Get PayPal gateway service
      const paypalService = paymentGatewayFactory.getGateway('paypal');
      if (!paypalService) {
        return {
          success: false,
          error: 'PayPal service not available',
          method: 'paypal'
        };
      }

      // TODO: Implement PayPal payout API
      // PayPal has a separate Payouts API for sending money
      
      const payoutReference = `PP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      console.log(`💰 PayPal payout processed:`, {
        transactionId: escrowTransaction.transactionId,
        sellerId: escrowTransaction.seller._id,
        amount: payoutCalculation.finalAmount,
        currency: payoutCalculation.currency,
        payoutReference
      });

      return {
        success: true,
        payoutReference,
        method: 'paypal',
        amount: payoutCalculation.finalAmount,
        currency: payoutCalculation.currency,
        processedAt: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        method: 'paypal'
      };
    }
  }

  /**
   * Process Stripe payout
   * @param {Object} escrowTransaction - Escrow transaction
   * @param {Object} payoutCalculation - Payout calculation
   * @param {Object} payoutMethod - Payout method details
   * @returns {Promise<Object>} Payout result
   */
  async processStripePayout(escrowTransaction, payoutCalculation, payoutMethod) {
    try {
      // Get Stripe gateway service
      const stripeService = paymentGatewayFactory.getGateway('stripe');
      if (!stripeService) {
        return {
          success: false,
          error: 'Stripe service not available',
          method: 'stripe'
        };
      }

      // TODO: Implement Stripe Connect payouts
      // This requires Stripe Connect setup for marketplace
      
      const payoutReference = `ST-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      console.log(`💰 Stripe payout processed:`, {
        transactionId: escrowTransaction.transactionId,
        sellerId: escrowTransaction.seller._id,
        amount: payoutCalculation.finalAmount,
        currency: payoutCalculation.currency,
        payoutReference
      });

      return {
        success: true,
        payoutReference,
        method: 'stripe',
        amount: payoutCalculation.finalAmount,
        currency: payoutCalculation.currency,
        processedAt: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        method: 'stripe'
      };
    }
  }

  /**
   * Process wallet payout (internal wallet system)
   * @param {Object} escrowTransaction - Escrow transaction
   * @param {Object} payoutCalculation - Payout calculation
   * @param {Object} payoutMethod - Payout method details
   * @returns {Promise<Object>} Payout result
   */
  async processWalletPayout(escrowTransaction, payoutCalculation, payoutMethod) {
    try {
      // TODO: Implement internal wallet system
      // This would credit the seller's internal wallet balance
      
      const payoutReference = `WL-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      console.log(`💰 Wallet payout processed:`, {
        transactionId: escrowTransaction.transactionId,
        sellerId: escrowTransaction.seller._id,
        amount: payoutCalculation.finalAmount,
        currency: payoutCalculation.currency,
        payoutReference
      });

      return {
        success: true,
        payoutReference,
        method: 'wallet',
        amount: payoutCalculation.finalAmount,
        currency: payoutCalculation.currency,
        processedAt: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        method: 'wallet'
      };
    }
  }

  /**
   * Record platform fee collection
   * @param {Object} escrowTransaction - Escrow transaction
   * @param {Object} payoutCalculation - Payout calculation
   * @returns {Promise<void>}
   */
  async recordPlatformFeeCollection(escrowTransaction, payoutCalculation) {
    try {
      const platformFeeConfig = await PlatformFee.getActiveFeeStructure();
      if (platformFeeConfig) {
        // Update platform fee statistics
        platformFeeConfig.statistics.totalFeesCollected += payoutCalculation.platformFeeAmount;
        platformFeeConfig.statistics.totalTransactions += 1;
        platformFeeConfig.statistics.lastUpdated = new Date();
        
        // Recalculate average fee percentage
        if (platformFeeConfig.statistics.totalTransactions > 0) {
          platformFeeConfig.statistics.averageFeePercentage = 
            (platformFeeConfig.statistics.totalFeesCollected / 
             (platformFeeConfig.statistics.totalTransactions * payoutCalculation.productPrice)) * 100;
        }

        await platformFeeConfig.save();
      }
    } catch (error) {
      console.error('Error recording platform fee collection:', error);
    }
  }

  /**
   * Process auto-release payouts for eligible transactions
   * @returns {Promise<Array>} Array of payout results
   */
  async processAutoReleasePayouts() {
    try {
      const eligibleTransactions = await EscrowTransaction.findPendingAutoRelease();
      const results = [];

      for (const transaction of eligibleTransactions) {
        console.log(`🔄 Processing auto-release payout for transaction: ${transaction.transactionId}`);
        
        // Mark as delivered (auto-release)
        await transaction.updateStatus('delivered', 'Auto-released after timeout period');
        
        // Process payout
        const payoutResult = await this.processPayout(transaction._id);
        results.push({
          transactionId: transaction.transactionId,
          payoutResult
        });
      }

      return results;

    } catch (error) {
      console.error('Auto-release payout processing error:', error);
      return [];
    }
  }

  /**
   * Get payout statistics
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Payout statistics
   */
  async getPayoutStatistics(filters = {}) {
    try {
      const matchStage = {
        status: 'completed',
        'payoutDetails.payoutProcessedAt': { $exists: true }
      };

      // Apply date filters
      if (filters.startDate || filters.endDate) {
        matchStage['payoutDetails.payoutProcessedAt'] = {};
        if (filters.startDate) {
          matchStage['payoutDetails.payoutProcessedAt'].$gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          matchStage['payoutDetails.payoutProcessedAt'].$lte = new Date(filters.endDate);
        }
      }

      const stats = await EscrowTransaction.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalPayouts: { $sum: 1 },
            totalPayoutAmount: { $sum: '$payoutDetails.payoutAmount' },
            totalPlatformFees: { $sum: '$platformFeeAmount' },
            totalGatewayFees: { $sum: '$gatewayFeeAmount' },
            averagePayoutAmount: { $avg: '$payoutDetails.payoutAmount' },
            payoutMethods: {
              $push: '$payoutDetails.payoutMethod'
            }
          }
        }
      ]);

      if (stats.length === 0) {
        return {
          totalPayouts: 0,
          totalPayoutAmount: 0,
          totalPlatformFees: 0,
          totalGatewayFees: 0,
          averagePayoutAmount: 0,
          payoutMethodBreakdown: {}
        };
      }

      const result = stats[0];
      
      // Calculate payout method breakdown
      const payoutMethodBreakdown = {};
      result.payoutMethods.forEach(method => {
        payoutMethodBreakdown[method] = (payoutMethodBreakdown[method] || 0) + 1;
      });

      return {
        totalPayouts: result.totalPayouts,
        totalPayoutAmount: Math.round(result.totalPayoutAmount * 100) / 100,
        totalPlatformFees: Math.round(result.totalPlatformFees * 100) / 100,
        totalGatewayFees: Math.round(result.totalGatewayFees * 100) / 100,
        averagePayoutAmount: Math.round(result.averagePayoutAmount * 100) / 100,
        payoutMethodBreakdown
      };

    } catch (error) {
      console.error('Get payout statistics error:', error);
      return null;
    }
  }
}

// Create singleton instance
const payoutService = new PayoutService();

module.exports = payoutService;
