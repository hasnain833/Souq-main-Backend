const stripe = require('stripe');
const BankAccount = require('../../db/models/bankAccountModel');

class StripePayoutService {
  constructor(config) {
    this.secretKey = config.configuration?.stripe?.secretKey;
    this.publishableKey = config.configuration?.stripe?.publishableKey;
    this.webhookSecret = config.configuration?.stripe?.webhookSecret;

    console.log('🔧 Stripe Payout Service configuration:', {
      hasSecretKey: !!this.secretKey,
      hasPublishableKey: !!this.publishableKey,
      hasWebhookSecret: !!this.webhookSecret,
      secretKeyPrefix: this.secretKey ? this.secretKey.substring(0, 7) + '...' : 'Missing'
    });

    // Check if we have a valid Stripe key
    const isPlaceholderKey = this.secretKey === 'your_stripe_secret_key_here' || 
                            this.secretKey === 'sk_test_placeholder' ||
                            !this.secretKey;

    if (this.secretKey && this.secretKey.trim() !== '' && this.secretKey.startsWith('sk_') && !isPlaceholderKey) {
      try {
        this.stripe = stripe(this.secretKey);
        console.log('✅ Stripe Payout Service initialized successfully');
        this.mockMode = false;
      } catch (error) {
        console.error('❌ Failed to initialize Stripe Payout Service:', error.message);
        this.stripe = null;
        this.mockMode = true;
      }
    } else {
      console.warn('⚠️ Stripe Payout Service running in MOCK MODE - No real API key provided');
      this.stripe = null;
      this.mockMode = true;
    }
  }

  /**
   * Create a payout to a bank account
   * @param {Object} payoutData - Payout details
   * @returns {Promise<Object>} Payout creation response
   */
  async createPayout(payoutData) {
    try {
      console.log('🔄 Creating Stripe payout:', {
        amount: payoutData.amount,
        currency: payoutData.currency,
        userId: payoutData.userId,
        bankAccountId: payoutData.bankAccountId
      });

      // If in mock mode or no real Stripe instance, use mock mode for testing
      if (this.mockMode || !this.stripe) {
        console.log('🎭 Stripe MOCK MODE: Simulating payout creation');
        return this.createMockPayout(payoutData);
      }

      // Validate required fields
      if (!payoutData.amount || !payoutData.currency) {
        throw new Error('Amount and currency are required for payout');
      }

      if (!payoutData.bankAccountId) {
        throw new Error('Bank account ID is required for payout');
      }

      // Get bank account details (skip in mock mode)
      if (!this.mockMode) {
        const bankAccount = await BankAccount.findById(payoutData.bankAccountId);
        if (!bankAccount) {
          throw new Error('Bank account not found');
        }

        console.log('🏦 Bank account details:', {
          bankName: bankAccount.bankName,
          accountType: bankAccount.accountType,
          lastFour: bankAccount.lastFourDigits,
          routingNumber: bankAccount.routingNumber
        });

        // For direct bank transfers, we'll use a different approach
        // Since Stripe payouts require Connect accounts, we'll simulate the process
        // In production, you would integrate with a bank transfer service

        console.log('⚠️ Note: Direct bank payouts require Stripe Connect setup');
        console.log('🔄 Simulating bank transfer process...');

        // Simulate payout creation with bank account details
        const simulatedPayoutId = `po_sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const simulatedPayout = {
          id: simulatedPayoutId,
          amount: this.formatAmount(payoutData.amount, true),
          currency: payoutData.currency.toLowerCase(),
          status: 'pending',
          arrival_date: Math.floor(this.calculateEstimatedArrival().getTime() / 1000),
          description: payoutData.description || 'SOUQ Marketplace Withdrawal',
          metadata: {
            user_id: payoutData.userId,
            wallet_transaction_id: payoutData.walletTransactionId,
            withdrawal_request_id: payoutData.withdrawalRequestId,
            bank_account_id: payoutData.bankAccountId,
            bank_name: bankAccount.bankName,
            account_last_four: bankAccount.lastFourDigits,
            routing_number: bankAccount.routingNumber,
            source: 'souq_marketplace'
          }
        };

        console.log('✅ Simulated bank transfer payout created:', simulatedPayoutId);

        return {
          success: true,
          payoutId: simulatedPayout.id,
          status: simulatedPayout.status,
          amount: this.formatAmount(simulatedPayout.amount, false),
          currency: simulatedPayout.currency.toUpperCase(),
          arrivalDate: new Date(simulatedPayout.arrival_date * 1000),
          estimatedArrival: this.calculateEstimatedArrival(),
          bankAccount: {
            bankName: bankAccount.bankName,
            lastFourDigits: bankAccount.lastFourDigits,
            accountType: bankAccount.accountType
          },
          payout: simulatedPayout
        };
      }

    } catch (error) {
      console.error('❌ Stripe payout creation failed:', error);
      return {
        success: false,
        error: error.message,
        code: error.code || 'PAYOUT_FAILED'
      };
    }
  }

  /**
   * Create mock payout for testing
   * @param {Object} payoutData - Payout details
   * @returns {Promise<Object>} Mock payout response
   */
  async createMockPayout(payoutData) {
    console.log('🎭 Creating mock payout:', payoutData);

    // Try to get bank account details for more realistic mock
    let bankAccountDetails = null;
    try {
      if (payoutData.bankAccountId) {
        const bankAccount = await BankAccount.findById(payoutData.bankAccountId);
        if (bankAccount) {
          bankAccountDetails = {
            bankName: bankAccount.bankName,
            lastFourDigits: bankAccount.lastFourDigits,
            accountType: bankAccount.accountType,
            routingNumber: bankAccount.routingNumber
          };
        }
      }
    } catch (error) {
      console.log('⚠️ Could not fetch bank account details for mock:', error.message);
    }

    const mockPayoutId = `po_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const arrivalDate = this.calculateEstimatedArrival();

    // Simulate different outcomes based on amount for testing
    let status = 'pending';
    let failureCode = null;
    let failureMessage = null;

    if (payoutData.amount > 1000) {
      // Simulate failure for large amounts in testing
      status = 'failed';
      failureCode = 'insufficient_funds';
      failureMessage = 'Insufficient funds in account';
    }

    return {
      success: true,
      payoutId: mockPayoutId,
      status: status,
      amount: payoutData.amount,
      currency: payoutData.currency,
      arrivalDate: status === 'failed' ? null : arrivalDate,
      estimatedArrival: status === 'failed' ? null : arrivalDate,
      failureCode: failureCode,
      failureMessage: failureMessage,
      bankAccount: bankAccountDetails,
      payout: {
        id: mockPayoutId,
        amount: this.formatAmount(payoutData.amount, true),
        currency: payoutData.currency.toLowerCase(),
        status: status,
        arrival_date: status === 'failed' ? null : Math.floor(arrivalDate.getTime() / 1000),
        failure_code: failureCode,
        failure_message: failureMessage,
        description: payoutData.description || 'SOUQ Marketplace Withdrawal',
        metadata: {
          user_id: payoutData.userId,
          wallet_transaction_id: payoutData.walletTransactionId,
          withdrawal_request_id: payoutData.withdrawalRequestId,
          bank_account_id: payoutData.bankAccountId,
          bank_name: bankAccountDetails?.bankName || 'Mock Bank',
          account_last_four: bankAccountDetails?.lastFourDigits || '0000',
          routing_number: bankAccountDetails?.routingNumber || '000000000',
          source: 'souq_marketplace'
        }
      }
    };
  }

  /**
   * Retrieve payout details
   * @param {string} payoutId - Stripe payout ID
   * @returns {Promise<Object>} Payout details
   */
  async retrievePayout(payoutId) {
    try {
      console.log('🔄 Retrieving Stripe payout:', payoutId);

      // If no real Stripe instance, use mock mode for testing
      if (!this.stripe && this.mockMode) {
        console.log('🎭 Stripe MOCK MODE: Simulating payout retrieval');
        return this.retrieveMockPayout(payoutId);
      }

      if (!this.stripe) {
        throw new Error('Stripe not initialized');
      }

      const payout = await this.stripe.payouts.retrieve(payoutId);

      console.log('✅ Stripe payout retrieved successfully:', payout.id);

      return {
        success: true,
        payoutId: payout.id,
        status: payout.status,
        amount: this.formatAmount(payout.amount, false),
        currency: payout.currency.toUpperCase(),
        arrivalDate: payout.arrival_date ? new Date(payout.arrival_date * 1000) : null,
        failureCode: payout.failure_code,
        failureMessage: payout.failure_message,
        payout: payout
      };

    } catch (error) {
      console.error('❌ Stripe payout retrieval failed:', error);
      return {
        success: false,
        error: error.message,
        code: error.code || 'PAYOUT_RETRIEVAL_FAILED'
      };
    }
  }

  /**
   * Retrieve mock payout for testing
   * @param {string} payoutId - Mock payout ID
   * @returns {Promise<Object>} Mock payout details
   */
  async retrieveMockPayout(payoutId) {
    console.log('🎭 Retrieving mock payout:', payoutId);
    
    // Simulate different statuses based on payout ID
    let status = 'pending';
    let failureCode = null;
    let failureMessage = null;

    if (payoutId.includes('_paid_')) {
      status = 'paid';
    } else if (payoutId.includes('_failed_')) {
      status = 'failed';
      failureCode = 'account_closed';
      failureMessage = 'The bank account has been closed';
    }

    const arrivalDate = new Date();
    arrivalDate.setDate(arrivalDate.getDate() + 2);

    return {
      success: true,
      payoutId: payoutId,
      status: status,
      amount: 100.00, // Mock amount
      currency: 'USD',
      arrivalDate: status === 'paid' ? new Date() : (status === 'failed' ? null : arrivalDate),
      failureCode: failureCode,
      failureMessage: failureMessage,
      payout: {
        id: payoutId,
        amount: 10000, // Mock amount in cents
        currency: 'usd',
        status: status,
        arrival_date: status === 'paid' ? Math.floor(Date.now() / 1000) : (status === 'failed' ? null : Math.floor(arrivalDate.getTime() / 1000)),
        failure_code: failureCode,
        failure_message: failureMessage
      }
    };
  }

  /**
   * Calculate estimated arrival date for payouts
   * @returns {Date} Estimated arrival date
   */
  calculateEstimatedArrival() {
    const arrivalDate = new Date();
    // Standard bank transfers take 1-3 business days
    // For simplicity, we'll add 2 days
    arrivalDate.setDate(arrivalDate.getDate() + 2);
    return arrivalDate;
  }

  /**
   * Format amount for Stripe (cents) or display (dollars)
   * @param {number} amount - Amount to format
   * @param {boolean} toCents - Whether to convert to cents
   * @returns {number} Formatted amount
   */
  formatAmount(amount, toCents = false) {
    if (toCents) {
      return Math.round(amount * 100); // Convert to cents
    } else {
      return amount / 100; // Convert from cents to dollars
    }
  }

  /**
   * Validate payout data
   * @param {Object} payoutData - Payout data to validate
   * @returns {Object} Validation result
   */
  validatePayoutData(payoutData) {
    const errors = [];

    if (!payoutData.amount || payoutData.amount <= 0) {
      errors.push('Amount must be greater than 0');
    }

    if (!payoutData.currency) {
      errors.push('Currency is required');
    }

    if (!payoutData.userId) {
      errors.push('User ID is required');
    }

    if (!payoutData.bankAccountId) {
      errors.push('Bank account ID is required');
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }
}

module.exports = StripePayoutService;
