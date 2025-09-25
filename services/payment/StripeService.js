const BasePaymentService = require('./BasePaymentService');
const stripe = require('stripe');

class StripeService extends BasePaymentService {
  constructor(config) {
    super(config);
    this.secretKey = config.configuration?.stripe?.secretKey;
    this.publishableKey = config.configuration?.stripe?.publishableKey;
    this.webhookSecret = config.configuration?.stripe?.webhookSecret;

    console.log('🔧 Stripe service configuration:', {
      hasSecretKey: !!this.secretKey,
      hasPublishableKey: !!this.publishableKey,
      hasWebhookSecret: !!this.webhookSecret,
      secretKeyPrefix: this.secretKey ? this.secretKey.substring(0, 7) + '...' : 'Missing',
      publishableKeyPrefix: this.publishableKey ? this.publishableKey.substring(0, 7) + '...' : 'Missing'
    });

    // Check if we have a real Stripe key or placeholder
    const isPlaceholderKey = !this.secretKey ||
      this.secretKey.includes('REPLACE_WITH_YOUR_REAL') ||
      this.secretKey.includes('1234567890abcdef') ||
      this.secretKey.includes('wxyz') ||
      this.secretKey === 'sk_test_REPLACE_WITH_YOUR_REAL_SECRET_KEY';

    if (this.secretKey && this.secretKey.trim() !== '' && this.secretKey.startsWith('sk_') && !isPlaceholderKey) {
      try {
        this.stripe = stripe(this.secretKey);
        console.log('✅ Stripe instance initialized successfully');
        this.mockMode = false;
      } catch (error) {
        console.error('❌ Failed to initialize Stripe instance:', error.message);
        this.stripe = null;
        this.mockMode = true;
      }
    } else {
      console.warn('⚠️ Stripe running in MOCK MODE - No real API key provided');
      console.warn('For real payments, get Stripe keys from: https://dashboard.stripe.com/test/apikeys');
      this.stripe = null;
      this.mockMode = true;
    }
  }

  /**
   * Initialize payment with Stripe
   * @param {Object} paymentData - Payment details
   * @returns {Promise<Object>} Payment initialization response
   * 
   */
  async createCheckoutSession(sessionData) {
    if (!this.stripe) {
      return { success: false, error: 'Stripe not configured.' };
    }
    try {
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: sessionData.currency || 'usd',
              product_data: { name: sessionData.productName || 'Product' },
              unit_amount: sessionData.amount, // in smallest unit
            },
            quantity: 1
          }
        ],
        mode: 'payment',
        success_url: sessionData.successUrl,
        cancel_url: sessionData.cancelUrl,
        customer_email: sessionData.customerEmail || undefined,
        metadata: sessionData.metadata || {}
      });

      return { success: true, url: session.url, sessionId: session.id };
    } catch (error) {
      console.error('❌ Error creating Stripe Checkout session:', error);
      return { success: false, error: error.message };
    }
  }

  async initializePayment(paymentData) {
    try {
      console.log('🔄 Stripe initializePayment called with data:', paymentData);
      console.log('Stripe configuration check:', {
        hasSecretKey: !!this.secretKey,
        hasPublishableKey: !!this.publishableKey,
        hasStripeInstance: !!this.stripe
      });

      // If no real Stripe instance, use mock mode for testing
      if (!this.stripe && this.mockMode) {
        console.log('🎭 Stripe MOCK MODE: Simulating payment intent creation');
        return this.createMockPaymentIntent(paymentData);
      }

      if (!this.stripe) {
        console.error('❌ Stripe instance not initialized and not in mock mode');
        return {
          success: false,
          error: 'Stripe not configured. Please add real Stripe keys to .env file.',
          details: {
            missingStripeInstance: true,
            mockMode: this.mockMode,
            needsRealKeys: true
          }
        };
      }

      const validation = this.validatePaymentData(paymentData);
      if (!validation.isValid) {
        console.error('❌ Stripe payment data validation failed:', validation.errors);
        return {
          success: false,
          error: 'Validation failed',
          details: validation.errors
        };
      }

      console.log('✅ Creating Stripe payment intent...');
      // Create payment intent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: this.formatAmount(paymentData.amount, true), // Stripe uses cents
        currency: paymentData.currency.toLowerCase(),
        description: paymentData.description || 'SOUQ Marketplace Purchase',

        // Receipt email (optional)
        receipt_email: paymentData.customerEmail,

        // Metadata for tracking
        metadata: {
          escrow_transaction_id: paymentData.escrowTransactionId,
          buyer_id: paymentData.buyerId,
          seller_id: paymentData.sellerId,
          product_id: paymentData.productId,
          order_id: paymentData.orderId
        },

        // Payment method types
        payment_method_types: ['card'],

        // Confirmation method - use automatic for frontend confirmation
        confirmation_method: 'automatic',

        // Shipping information (only include if provided)
        ...(paymentData.shippingAddress && {
          shipping: {
            name: paymentData.shippingAddress.name || paymentData.customerName,
            address: {
              line1: paymentData.shippingAddress.street1,
              line2: paymentData.shippingAddress.street2,
              city: paymentData.shippingAddress.city,
              state: paymentData.shippingAddress.state,
              postal_code: paymentData.shippingAddress.zip,
              country: paymentData.shippingAddress.country
            }
          }
        })
      });

      this.logTransaction('INITIALIZE_PAYMENT', paymentData, paymentIntent);

      return {
        success: true,
        transactionId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        publishableKey: this.publishableKey,
        gatewayResponse: paymentIntent
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        details: error
      };
    }
  }

  /**
   * Create mock payment intent for testing when real Stripe keys are not available
   * @param {Object} paymentData - Payment details
   * @returns {Object} Mock payment response
   */
  createMockPaymentIntent(paymentData) {
    console.log('🎭 Creating mock payment intent for testing');

    // Generate a fake payment intent ID
    const mockPaymentIntentId = `pi_mock_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const mockClientSecret = process.env.STRIPE_SECRET_KEY;

    return {
      success: true,
      transactionId: mockPaymentIntentId,
      clientSecret: mockClientSecret,
      // publishableKey: this.publishableKey || 'pk_test_mock_key',
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ,
      amount: this.formatAmount(paymentData.amount, true),
      currency: paymentData.currency.toLowerCase(),
      status: 'requires_payment_method',
      mockMode: true,
      message: 'Mock payment intent created for testing. No real payment will be processed.',
      gatewayResponse: {
        id: mockPaymentIntentId,
        object: 'payment_intent',
        amount: this.formatAmount(paymentData.amount, true),
        currency: paymentData.currency.toLowerCase(),
        status: 'requires_payment_method',
        client_secret: mockClientSecret,
        created: Math.floor(Date.now() / 1000),
        description: paymentData.description || 'SOUQ Marketplace Purchase (Mock)',
        metadata: {
          escrow_transaction_id: paymentData.escrowTransactionId,
          buyer_id: paymentData.buyerId,
          seller_id: paymentData.sellerId,
          product_id: paymentData.productId,
          mock_mode: 'true'
        }
      }
    };
  }

  /**
   * Confirm payment with Stripe
   * @param {Object} confirmationData - Payment confirmation details
   * @returns {Promise<Object>} Payment confirmation response
   */
  async confirmPayment(confirmationData) {
    try {
      const { paymentIntentId, paymentMethodId } = confirmationData;

      const paymentIntent = await this.stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: paymentMethodId,
        return_url: confirmationData.returnUrl
      });

      this.logTransaction('CONFIRM_PAYMENT', confirmationData, paymentIntent);

      const status = this.mapPaymentStatus(paymentIntent.status);

      return {
        success: true,
        status: status,
        transactionId: paymentIntent.id,
        amount: paymentIntent.amount / 100, // Convert from cents
        currency: paymentIntent.currency.toUpperCase(),
        gatewayTransactionId: paymentIntent.charges?.data[0]?.id,
        gatewayResponse: paymentIntent,
        requiresAction: paymentIntent.status === 'requires_action',
        nextAction: paymentIntent.next_action
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        details: error
      };
    }
  }

  /**
   * Verify payment status with Stripe
   * @param {string} transactionId - Stripe payment intent ID
   * @returns {Promise<Object>} Payment status
   */
  async verifyPayment(transactionId) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(transactionId);

      this.logTransaction('VERIFY_PAYMENT', { transactionId }, paymentIntent);

      const status = this.mapPaymentStatus(paymentIntent.status);

      return {
        success: true,
        status: status,
        transactionId: paymentIntent.id,
        amount: paymentIntent.amount / 100, // Convert from cents
        currency: paymentIntent.currency.toUpperCase(),
        gatewayTransactionId: paymentIntent.charges?.data[0]?.id,
        gatewayResponse: paymentIntent,
        paidAt: paymentIntent.charges?.data[0]?.created ? new Date(paymentIntent.charges.data[0].created * 1000) : null
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        details: error
      };
    }
  }

  /**
   * Process refund with Stripe
   * @param {Object} refundData - Refund details
   * @returns {Promise<Object>} Refund response
   */
  async processRefund(refundData) {
    try {
      // First, get the payment intent to find the charge
      const paymentIntent = await this.stripe.paymentIntents.retrieve(refundData.originalTransactionId);

      if (!paymentIntent.charges?.data[0]?.id) {
        return {
          success: false,
          error: 'No charge found for this payment intent'
        };
      }

      const refund = await this.stripe.refunds.create({
        charge: paymentIntent.charges.data[0].id,
        amount: this.formatAmount(refundData.amount, true), // Stripe uses cents
        reason: this.mapRefundReason(refundData.reason),
        metadata: {
          escrow_transaction_id: refundData.escrowTransactionId,
          refund_reason: refundData.reason,
          requested_by: refundData.requestedBy
        }
      });

      this.logTransaction('PROCESS_REFUND', refundData, refund);

      return {
        success: true,
        refundId: refund.id,
        status: refund.status,
        amount: refund.amount / 100, // Convert from cents
        currency: refund.currency.toUpperCase(),
        gatewayResponse: refund
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        details: error
      };
    }
  }

  /**
   * Handle Stripe webhook
   * @param {Object} webhookData - Webhook payload
   * @param {string} signature - Stripe signature header
   * @returns {Promise<Object>} Processed webhook data
   */
  async handleWebhook(webhookData, signature) {
    try {
      // Verify webhook signature
      const event = this.stripe.webhooks.constructEvent(
        webhookData,
        signature,
        this.webhookSecret
      );

      const { type, data } = event;
      const object = data.object;

      this.logTransaction('WEBHOOK_RECEIVED', { type }, object);

      switch (type) {
        case 'payment_intent.succeeded':
          return {
            success: true,
            eventType: 'payment_completed',
            transactionId: object.id,
            status: 'completed',
            amount: object.amount / 100,
            currency: object.currency.toUpperCase(),
            gatewayTransactionId: object.charges?.data[0]?.id,
            metadata: object.metadata,
            rawData: event
          };

        case 'payment_intent.payment_failed':
          return {
            success: true,
            eventType: 'payment_failed',
            transactionId: object.id,
            status: 'failed',
            amount: object.amount / 100,
            currency: object.currency.toUpperCase(),
            error: object.last_payment_error?.message,
            metadata: object.metadata,
            rawData: event
          };

        case 'charge.dispute.created':
          return {
            success: true,
            eventType: 'dispute_created',
            transactionId: object.payment_intent,
            status: 'disputed',
            amount: object.amount / 100,
            currency: object.currency.toUpperCase(),
            disputeReason: object.reason,
            rawData: event
          };

        default:
          return {
            success: true,
            eventType: 'unhandled',
            message: `Unhandled webhook event: ${type}`,
            rawData: event
          };
      }

    } catch (error) {
      return {
        success: false,
        error: error.message,
        details: error
      };
    }
  }

  /**
   * Map Stripe payment status to standard status
   * @param {string} stripeStatus - Stripe status
   * @returns {string} Standardized status
   */
  mapPaymentStatus(stripeStatus) {
    const statusMap = {
      'succeeded': 'completed',
      'processing': 'processing',
      'requires_payment_method': 'failed',
      'requires_confirmation': 'processing',
      'requires_action': 'processing',
      'canceled': 'cancelled',
      'requires_capture': 'processing'
    };

    return statusMap[stripeStatus] || 'unknown';
  }

  /**
   * Map refund reason to Stripe reason
   * @param {string} reason - Refund reason
   * @returns {string} Stripe refund reason
   */
  mapRefundReason(reason) {
    const reasonMap = {
      'duplicate': 'duplicate',
      'fraudulent': 'fraudulent',
      'requested_by_customer': 'requested_by_customer'
    };

    return reasonMap[reason] || 'requested_by_customer';
  }

  /**
   * Check payment status with Stripe
   * @param {string} paymentIntentId - Stripe payment intent ID
   * @returns {Promise<Object>} Payment status response
   */
  async checkPaymentStatus(paymentIntentId) {
    try {
      this.logTransaction('CHECK_PAYMENT_STATUS', { paymentIntentId });

      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

      this.logTransaction('PAYMENT_STATUS_RETRIEVED', {
        status: paymentIntent.status,
        amount: paymentIntent.amount
      }, paymentIntent);

      // Map Stripe status to our standard status
      let status = 'processing';
      if (paymentIntent.status === 'succeeded') {
        status = 'completed';
      } else if (paymentIntent.status === 'canceled') {
        status = 'canceled';
      } else if (paymentIntent.status === 'payment_failed') {
        status = 'failed';
      }

      return {
        success: true,
        status: status,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency.toUpperCase(),
        gatewayTransactionId: paymentIntent.charges?.data[0]?.id,
        metadata: paymentIntent.metadata,
        rawData: paymentIntent
      };

    } catch (error) {
      this.logTransaction('CHECK_PAYMENT_STATUS_ERROR', { paymentIntentId }, null, error);

      return {
        success: false,
        error: error.message,
        details: error
      };
    }
  }

  /**
   * Create customer in Stripe
   * @param {Object} customerData - Customer details
   * @returns {Promise<Object>} Customer creation response
   */
  async createCustomer(customerData) {
    try {
      const customer = await this.stripe.customers.create({
        email: customerData.email,
        name: customerData.name,
        phone: customerData.phone,
        address: customerData.address ? {
          line1: customerData.address.street1,
          line2: customerData.address.street2,
          city: customerData.address.city,
          state: customerData.address.state,
          postal_code: customerData.address.zip,
          country: customerData.address.country
        } : null,
        metadata: {
          user_id: customerData.userId,
          source: 'souq_marketplace'
        }
      });

      return {
        success: true,
        customerId: customer.id,
        customer: customer
      };

    } catch (error) {
      console.error('❌ Stripe customer creation failed:', error);
      return {
        success: false,
        error: error.message,
        code: error.code || 'CUSTOMER_CREATION_FAILED'
      };
    }
  }

  /**
   * Create a payout to a bank account
   * @param {Object} payoutData - Payout details
   * @returns {Promise<Object>} Payout creation response
   */
  async createPayout(payoutData) {
    try {
      console.log('🔄 Creating Stripe payout:', payoutData);

      // If no real Stripe instance, use mock mode for testing
      if (!this.stripe && this.mockMode) {
        console.log('🎭 Stripe MOCK MODE: Simulating payout creation');
        return this.createMockPayout(payoutData);
      }

      if (!this.stripe) {
        throw new Error('Stripe not initialized');
      }

      // Validate required fields
      if (!payoutData.amount || !payoutData.currency) {
        throw new Error('Amount and currency are required for payout');
      }

      if (!payoutData.destination) {
        throw new Error('Destination bank account is required for payout');
      }

      // Create payout
      const payout = await this.stripe.payouts.create({
        amount: this.formatAmount(payoutData.amount, true), // Stripe uses cents
        currency: payoutData.currency.toLowerCase(),
        destination: payoutData.destination, // Bank account ID from Stripe
        description: payoutData.description || 'SOUQ Marketplace Withdrawal',
        statement_descriptor: 'SOUQ WITHDRAWAL',
        metadata: {
          user_id: payoutData.userId,
          wallet_transaction_id: payoutData.walletTransactionId,
          withdrawal_request_id: payoutData.withdrawalRequestId,
          source: 'souq_marketplace'
        }
      });

      console.log('✅ Stripe payout created successfully:', payout.id);

      return {
        success: true,
        payoutId: payout.id,
        status: payout.status,
        amount: this.formatAmount(payout.amount, false),
        currency: payout.currency.toUpperCase(),
        arrivalDate: payout.arrival_date ? new Date(payout.arrival_date * 1000) : null,
        payout: payout
      };

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

    const mockPayoutId = `po_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const arrivalDate = new Date();
    arrivalDate.setDate(arrivalDate.getDate() + 2); // Mock 2 days processing time

    return {
      success: true,
      payoutId: mockPayoutId,
      status: 'pending',
      amount: payoutData.amount,
      currency: payoutData.currency,
      arrivalDate: arrivalDate,
      payout: {
        id: mockPayoutId,
        amount: this.formatAmount(payoutData.amount, true),
        currency: payoutData.currency.toLowerCase(),
        status: 'pending',
        arrival_date: Math.floor(arrivalDate.getTime() / 1000),
        description: payoutData.description || 'SOUQ Marketplace Withdrawal',
        metadata: {
          user_id: payoutData.userId,
          wallet_transaction_id: payoutData.walletTransactionId,
          withdrawal_request_id: payoutData.withdrawalRequestId,
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
    if (payoutId.includes('_paid_')) status = 'paid';
    if (payoutId.includes('_failed_')) status = 'failed';

    const arrivalDate = new Date();
    arrivalDate.setDate(arrivalDate.getDate() + 2);

    return {
      success: true,
      payoutId: payoutId,
      status: status,
      amount: 100.00, // Mock amount
      currency: 'USD',
      arrivalDate: status === 'paid' ? new Date() : arrivalDate,
      failureCode: status === 'failed' ? 'account_closed' : null,
      failureMessage: status === 'failed' ? 'The bank account has been closed' : null,
      payout: {
        id: payoutId,
        amount: 10000, // Mock amount in cents
        currency: 'usd',
        status: status,
        arrival_date: Math.floor(arrivalDate.getTime() / 1000),
        failure_code: status === 'failed' ? 'account_closed' : null,
        failure_message: status === 'failed' ? 'The bank account has been closed' : null
      }
    };
  }

  /**
   * Create external account (bank account) for payouts
   * @param {Object} accountData - Bank account details
   * @returns {Promise<Object>} External account creation response
   */
  async createExternalAccount(accountData) {
    try {
      console.log('🔄 Creating Stripe external account:', {
        country: accountData.country,
        currency: accountData.currency,
        accountHolderName: accountData.accountHolderName
      });

      // If no real Stripe instance, use mock mode for testing
      if (!this.stripe && this.mockMode) {
        console.log('🎭 Stripe MOCK MODE: Simulating external account creation');
        return this.createMockExternalAccount(accountData);
      }

      if (!this.stripe) {
        throw new Error('Stripe not initialized');
      }

      // For payouts, we need to create a bank account token first
      const bankAccountToken = await this.stripe.tokens.create({
        bank_account: {
          country: accountData.country,
          currency: accountData.currency.toLowerCase(),
          account_number: accountData.accountNumber,
          routing_number: accountData.routingNumber,
          account_holder_name: accountData.accountHolderName,
          account_holder_type: accountData.accountHolderType || 'individual'
        }
      });

      console.log('✅ Stripe bank account token created:', bankAccountToken.id);

      return {
        success: true,
        tokenId: bankAccountToken.id,
        accountId: bankAccountToken.bank_account.id,
        lastFourDigits: bankAccountToken.bank_account.last4,
        bankName: bankAccountToken.bank_account.bank_name,
        status: bankAccountToken.bank_account.status,
        token: bankAccountToken
      };

    } catch (error) {
      console.error('❌ Stripe external account creation failed:', error);
      return {
        success: false,
        error: error.message,
        code: error.code || 'EXTERNAL_ACCOUNT_FAILED'
      };
    }
  }

  /**
   * Create mock external account for testing
   * @param {Object} accountData - Bank account details
   * @returns {Promise<Object>} Mock external account response
   */
  async createMockExternalAccount(accountData) {
    console.log('🎭 Creating mock external account:', accountData);

    const mockTokenId = `btok_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const mockAccountId = `ba_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      success: true,
      tokenId: mockTokenId,
      accountId: mockAccountId,
      lastFourDigits: accountData.accountNumber.slice(-4),
      bankName: 'Mock Bank',
      status: 'new',
      token: {
        id: mockTokenId,
        bank_account: {
          id: mockAccountId,
          object: 'bank_account',
          account_holder_name: accountData.accountHolderName,
          account_holder_type: accountData.accountHolderType || 'individual',
          bank_name: 'Mock Bank',
          country: accountData.country,
          currency: accountData.currency.toLowerCase(),
          last4: accountData.accountNumber.slice(-4),
          routing_number: accountData.routingNumber,
          status: 'new'
        }
      }
    };
  }

  /**
   * Get Stripe specific configuration
   * @returns {Object} Configuration details
   */
  getGatewayConfig() {
    return {
      gatewayName: 'stripe',
      displayName: 'Stripe',
      supportedCurrencies: ['AED', 'USD', 'EUR', 'GBP', 'SAR'],
      supportedPaymentMethods: ['credit_card', 'debit_card', 'apple_pay', 'google_pay'],
      isConfigured: !!(this.secretKey && this.publishableKey)
    };
  }

  /**
   * Test gateway connection
   * @returns {Promise<Object>} Connection test result
   */
  async testConnection() {
    try {
      const account = await this.stripe.accounts.retrieve();

      return {
        success: true,
        connected: true,
        message: 'Connection successful',
        details: {
          accountId: account.id,
          country: account.country,
          defaultCurrency: account.default_currency
        }
      };

    } catch (error) {
      return {
        success: false,
        connected: false,
        message: 'Connection test failed',
        error: error.message
      };
    }
  }
}

module.exports = StripeService;
