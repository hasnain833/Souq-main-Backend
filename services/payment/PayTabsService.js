const BasePaymentService = require('./BasePaymentService');

class PayTabsService extends BasePaymentService {
  constructor(config) {
    super(config);
    this.baseUrl = this.isTestMode
      ? 'https://secure.paytabs.com'
      : 'https://secure.paytabs.com';

    // Use configuration from database or environment variables
    this.profileId = '165428'; // fallback for testing

    this.serverKey = process.env.PAYTABS_SERVER_KEY || 'SJJ92MDGNB-JLK69KBKN9-KHN9TLLMRK';

    this.region = config.configuration?.paytabs?.region || 'ARE';

    console.log('🔧 PayTabs Service initialized:', {
      profileId: this.profileId,
      serverKey: this.serverKey ? `${this.serverKey.substring(0, 10)}...` : 'MISSING',
      region: this.region,
      isTestMode: this.isTestMode,
      baseUrl: this.baseUrl
    });
  }

  /**
   * Initialize payment with PayTabs
   * @param {Object} paymentData - Payment details
   * @returns {Promise<Object>} Payment initialization response
   */
  async initializePayment(paymentData) {
    try {
      console.log('🔄 PayTabs - Initialize payment called');
      console.log('🔄 PayTabs - Payment data received:', {
        amount: paymentData.amount,
        currency: paymentData.currency,
        orderId: paymentData.orderId
      });

      // Validate PayTabs configuration
      if (!this.profileId || !this.serverKey) {
        console.error('❌ PayTabs - Missing configuration');
        return {
          success: false,
          error: 'PayTabs configuration is incomplete. Missing profileId or serverKey.',
          details: {
            hasProfileId: !!this.profileId,
            hasServerKey: !!this.serverKey
          }
        };
      }

      // Check currency support
      const gatewayConfig = this.getGatewayConfig();
      console.log('🔍 PayTabs - Supported currencies:', gatewayConfig.supportedCurrencies);
      console.log('🔍 PayTabs - Requested currency:', paymentData.currency);

      if (!gatewayConfig.supportedCurrencies.includes(paymentData.currency)) {
        console.error(`❌ PayTabs - Currency ${paymentData.currency} not supported`);
        console.error('❌ PayTabs - This should have been converted before reaching this point');
        return {
          success: false,
          error: `PayTabs does not support ${paymentData.currency}. Supported currencies: ${gatewayConfig.supportedCurrencies.join(', ')}`,
          details: {
            requestedCurrency: paymentData.currency,
            supportedCurrencies: gatewayConfig.supportedCurrencies
          }
        };
      }

      const validation = this.validatePaymentData(paymentData);
      if (!validation.isValid) {
        console.error('❌ PayTabs - Payment data validation failed:', validation.errors);
        return {
          success: false,
          error: 'Validation failed',
          details: validation.errors
        };
      }

      // Force SAR currency for PayTabs if not already SAR
      let finalCurrency = paymentData.currency;
      let finalAmount = paymentData.amount;

      console.log(`🔍 PayTabs Service - Input currency: ${paymentData.currency}, amount: ${paymentData.amount}`);
      console.log('🔍 PayTabs Service - Supported currencies:', this.getGatewayConfig().supportedCurrencies);

      // ALWAYS convert to SAR for PayTabs (force conversion)
      console.log(`🔄 PayTabs Service - FORCING conversion to SAR regardless of input currency`);
      finalCurrency = 'SAR';

      // Convert to SAR using fallback rates
      if (paymentData.currency === 'USD') {
        finalAmount = Math.round(paymentData.amount * 3.75 * 100) / 100; // USD to SAR
        console.log(`💱 PayTabs Service - USD to SAR: ${paymentData.amount} → ${finalAmount}`);
      } else if (paymentData.currency === 'AED') {
        finalAmount = Math.round(paymentData.amount * 1.02 * 100) / 100; // AED to SAR
        console.log(`💱 PayTabs Service - AED to SAR: ${paymentData.amount} → ${finalAmount}`);
      } else if (paymentData.currency === 'EUR') {
        finalAmount = Math.round(paymentData.amount * 4.10 * 100) / 100; // EUR to SAR
        console.log(`💱 PayTabs Service - EUR to SAR: ${paymentData.amount} → ${finalAmount}`);
      } else if (paymentData.currency === 'SAR') {
        finalAmount = paymentData.amount; // Keep SAR as is
        console.log(`💱 PayTabs Service - SAR to SAR: ${paymentData.amount} → ${finalAmount}`);
      } else {
        // Default conversion for unknown currencies (treat as USD)
        finalAmount = Math.round(paymentData.amount * 3.75 * 100) / 100;
        console.log(`💱 PayTabs Service - Unknown currency (${paymentData.currency}) to SAR: ${paymentData.amount} → ${finalAmount}`);
      }

      console.log(`🔍 PayTabs Service - Final currency: ${finalCurrency}, final amount: ${finalAmount}`);

      // VALIDATION: Ensure we're always sending SAR to PayTabs
      if (finalCurrency !== 'SAR') {
        console.error(`❌ CRITICAL ERROR: PayTabs service is trying to send ${finalCurrency} instead of SAR!`);
        throw new Error(`PayTabs only supports SAR currency, but ${finalCurrency} was provided`);
      }

      console.log(`✅ PayTabs Service - Currency validation passed: ${finalCurrency}`);

      const requestData = {
        profile_id: this.profileId,
        tran_type: 'sale',
        tran_class: 'ecom',
        cart_id: paymentData.orderId,
        cart_description: paymentData.description || 'SOUQ Marketplace Purchase',
        cart_currency: finalCurrency,
        cart_amount: this.formatAmount(finalAmount),
        
        // Customer information
        customer_details: {
          name: paymentData.customerName,
          email: paymentData.customerEmail,
          phone: paymentData.customerPhone,
          street1: paymentData.billingAddress?.street1 || '',
          city: paymentData.billingAddress?.city || '',
          state: paymentData.billingAddress?.state || '',
          country: paymentData.billingAddress?.country || this.region,
          zip: paymentData.billingAddress?.zip || ''
        },
        
        // Shipping information (if different from billing)
        shipping_details: paymentData.shippingAddress ? {
          name: paymentData.shippingAddress.name || paymentData.customerName,
          email: paymentData.customerEmail,
          phone: paymentData.customerPhone,
          street1: paymentData.shippingAddress.street1,
          city: paymentData.shippingAddress.city,
          state: paymentData.shippingAddress.state,
          country: paymentData.shippingAddress.country,
          zip: paymentData.shippingAddress.zip
        } : null,
        
        // URLs
        callback: paymentData.callbackUrl,
        return: paymentData.returnUrl,
        
        // Payment configuration
        payment_methods: ['all'],
        hide_shipping: paymentData.hideShipping || false,
        
        // Additional configuration
        config_id: this.isTestMode ? 1 : 2, // 1 for test, 2 for live
        
        // Metadata
        user_defined: {
          escrow_transaction_id: paymentData.escrowTransactionId,
          buyer_id: paymentData.buyerId,
          seller_id: paymentData.sellerId,
          product_id: paymentData.productId
        }
      };

      console.log('🔄 PayTabs - Making payment request to:', `${this.baseUrl}/payment/request`);
      console.log('🔄 PayTabs - Request data:', JSON.stringify(requestData, null, 2));
      console.log('🔄 PayTabs - Headers:', {
        'authorization': this.serverKey ? `${this.serverKey.substring(0, 10)}...` : 'MISSING',
        'Content-Type': 'application/json'
      });
      console.log('🔄 PayTabs - Final currency being sent:', requestData.cart_currency);
      console.log('🔄 PayTabs - Final amount being sent:', requestData.cart_amount);

      // Try multiple authentication methods with retry for server errors
      console.log('🔄 Trying PayTabs authentication methods...');

      let response = null;
      const authMethods = [
        { name: 'lowercase authorization', headers: { 'authorization': this.serverKey, 'Content-Type': 'application/json' } },
        { name: 'Authorization header', headers: { 'Authorization': this.serverKey, 'Content-Type': 'application/json' } },
        { name: 'server_key in body', headers: { 'Content-Type': 'application/json' }, addServerKey: true }
      ];

      for (const method of authMethods) {
        console.log(`🔄 Trying ${method.name}...`);

        let requestDataWithAuth = { ...requestData };
        if (method.addServerKey) {
          requestDataWithAuth.server_key = this.serverKey;
        }

        // Retry logic for server errors
        let retryCount = 0;
        const maxRetries = 2;

        while (retryCount <= maxRetries) {
          if (retryCount > 0) {
            console.log(`🔄 Retry attempt ${retryCount}/${maxRetries} for ${method.name}...`);
            await new Promise(resolve => setTimeout(resolve, 2000 * retryCount)); // Wait 2s, 4s
          }

          response = await this.makeRequest(
            'POST',
            `${this.baseUrl}/payment/request`,
            requestDataWithAuth,
            method.headers
          );

          console.log(`📋 ${method.name} attempt ${retryCount + 1} result:`, {
            success: response.success,
            status: response.status,
            hasData: !!response.data,
            hasError: !!response.error,
            isServerError: response.isServerError
          });

          // If successful, break out of retry loop
          if (response.success && response.data && response.data.tran_ref) {
            console.log(`✅ ${method.name} worked on attempt ${retryCount + 1}!`);
            break;
          }

          // If it's a server error (522, 503, 502), retry
          if (response.isServerError && response.status >= 500 && retryCount < maxRetries) {
            console.log(`⚠️ Server error (${response.status}), retrying...`);
            retryCount++;
            continue;
          }

          // If it's an auth error (code 1), try next method
          if (response.error && response.error.code === 1) {
            console.log(`🔄 Authentication error, trying next method...`);
            break;
          }

          // For other errors, stop retrying this method
          console.log(`🔄 ${method.name} got non-retryable error, stopping attempts`);
          break;
        }

        // If this method worked, break out of the method loop
        if (response.success && response.data && response.data.tran_ref) {
          break;
        }

        // If we got a non-auth error, also break (don't try other auth methods)
        if (response.error && response.error.code !== 1) {
          console.log(`🔄 Non-authentication error encountered, stopping method attempts`);
          break;
        }
      }

      console.log('� PayTabs raw response:', response);

      console.log('�📥 PayTabs - Response received:', JSON.stringify(response, null, 2));
      this.logTransaction('INITIALIZE_PAYMENT', requestData, response);

      if (response.success && response.data && response.data.tran_ref) {
        console.log('✅ PayTabs - Payment initialized successfully');
        return {
          success: true,
          transactionId: response.data.tran_ref,
          paymentUrl: response.data.redirect_url,
          gatewayResponse: response.data
        };
      }

      console.error('❌ PayTabs - Payment initialization failed');
      console.error('❌ PayTabs - Response success:', response.success);
      console.error('❌ PayTabs - Response data:', JSON.stringify(response.data, null, 2));
      console.error('❌ PayTabs - Response error:', JSON.stringify(response.error, null, 2));
      console.error('❌ PayTabs - Response status:', response.status);

      let errorMessage = 'Payment initialization failed';

      // Handle specific PayTabs error cases
      if (response.status === 401 || response.error?.code === 1) {
        errorMessage = 'PayTabs authentication failed. Please check your PayTabs credentials.';
        console.error('❌ PayTabs - Authentication failed. Credentials may be invalid or expired.');
      } else if (response.error?.code === 206 || response.error?.message?.includes('Currency not available')) {
        errorMessage = `PayTabs currency error: ${response.error?.message || 'Currency not supported'}`;
        console.error('❌ PayTabs - Currency not supported. This should not happen with SAR conversion.');
        console.error('❌ PayTabs - Currency sent to PayTabs:', requestData.cart_currency);
        console.error('❌ PayTabs - Amount sent to PayTabs:', requestData.cart_amount);
        console.error('❌ PayTabs - Profile ID:', requestData.profile_id);
        console.error('❌ PayTabs - This suggests the PayTabs profile may not support SAR or is configured for a different region.');
      } else if (response.status === 522) {
        errorMessage = 'PayTabs server is temporarily unavailable (Connection timeout). Please try again in a few minutes.';
        console.error('❌ PayTabs - Server connection timeout (522). PayTabs servers may be experiencing issues.');
      } else if (response.status === 503) {
        errorMessage = 'PayTabs service is temporarily unavailable. Please try again later.';
        console.error('❌ PayTabs - Service unavailable (503). PayTabs may be under maintenance.');
      } else if (response.status === 502) {
        errorMessage = 'PayTabs server error. Please try again later.';
        console.error('❌ PayTabs - Bad gateway (502). PayTabs server error.');
      } else if (response.isServerError) {
        errorMessage = 'PayTabs server is experiencing issues. Please try again later.';
        console.error('❌ PayTabs - Server error detected from HTML response.');
      } else if (response.data?.message) {
        errorMessage = response.data.message;
      } else if (response.data?.error) {
        errorMessage = response.data.error;
      } else if (response.error?.message) {
        errorMessage = response.error.message;
      } else if (response.error) {
        errorMessage = typeof response.error === 'string' ? response.error : JSON.stringify(response.error);
      }

      return {
        success: false,
        error: errorMessage,
        gatewayResponse: response.data,
        httpStatus: response.status,
        isAuthenticationError: response.status === 401
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
   * Verify payment status with PayTabs
   * @param {string} transactionId - PayTabs transaction reference
   * @returns {Promise<Object>} Payment status
   */
  async verifyPayment(transactionId) {
    try {
      const requestData = {
        profile_id: this.profileId,
        tran_ref: transactionId
      };

      const response = await this.makeRequest(
        'POST',
        `${this.baseUrl}/payment/query`,
        requestData,
        {
          'authorization': this.serverKey,
          'Content-Type': 'application/json'
        }
      );

      this.logTransaction('VERIFY_PAYMENT', requestData, response);

      if (response.success && response.data) {
        const paymentStatus = this.mapPaymentStatus(response.data.payment_result?.response_status);
        
        return {
          success: true,
          status: paymentStatus,
          transactionId: response.data.tran_ref,
          amount: response.data.cart_amount,
          currency: response.data.cart_currency,
          gatewayTransactionId: response.data.acquirer_rrn,
          gatewayResponse: response.data,
          paidAt: response.data.payment_result?.response_time ? new Date(response.data.payment_result.response_time) : null
        };
      }

      return {
        success: false,
        error: response.data?.message || 'Payment verification failed',
        gatewayResponse: response.data
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
   * Process refund with PayTabs
   * @param {Object} refundData - Refund details
   * @returns {Promise<Object>} Refund response
   */
  async processRefund(refundData) {
    try {
      const requestData = {
        profile_id: this.profileId,
        tran_type: 'refund',
        tran_class: 'ecom',
        tran_ref: refundData.originalTransactionId,
        cart_id: refundData.orderId,
        cart_description: refundData.reason || 'Refund request',
        cart_currency: refundData.currency,
        cart_amount: this.formatAmount(refundData.amount)
      };

      const response = await this.makeRequest(
        'POST',
        `${this.baseUrl}/payment/request`,
        requestData,
        {
          'authorization': this.serverKey,
          'Content-Type': 'application/json'
        }
      );

      this.logTransaction('PROCESS_REFUND', requestData, response);

      if (response.success && response.data.tran_ref) {
        return {
          success: true,
          refundId: response.data.tran_ref,
          status: 'processed',
          amount: refundData.amount,
          currency: refundData.currency,
          gatewayResponse: response.data
        };
      }

      return {
        success: false,
        error: response.data?.message || 'Refund processing failed',
        gatewayResponse: response.data
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
   * Handle PayTabs webhook
   * @param {Object} webhookData - Webhook payload
   * @returns {Promise<Object>} Processed webhook data
   */
  async handleWebhook(webhookData) {
    try {
      // PayTabs sends webhook data in the request body
      const {
        tran_ref,
        payment_result,
        cart_id,
        cart_amount,
        cart_currency,
        user_defined
      } = webhookData;

      if (!tran_ref) {
        return {
          success: false,
          error: 'Invalid webhook data: missing transaction reference'
        };
      }

      const paymentStatus = this.mapPaymentStatus(payment_result?.response_status);
      
      return {
        success: true,
        transactionId: tran_ref,
        status: paymentStatus,
        orderId: cart_id,
        amount: parseFloat(cart_amount),
        currency: cart_currency,
        gatewayTransactionId: payment_result?.acquirer_rrn,
        metadata: user_defined,
        rawData: webhookData
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
   * Map PayTabs payment status to standard status
   * @param {string} paytabsStatus - PayTabs status
   * @returns {string} Standardized status
   */
  mapPaymentStatus(paytabsStatus) {
    const statusMap = {
      'A': 'completed',      // Authorized/Approved
      'H': 'completed',      // Hold (successful but on hold)
      'P': 'processing',     // Pending
      'V': 'completed',      // Voided (but payment was successful)
      'E': 'failed',         // Error
      'D': 'failed',         // Declined
      'C': 'cancelled',      // Cancelled
      'F': 'failed',         // Failed
      'N': 'failed'          // Not processed
    };

    return statusMap[paytabsStatus] || 'unknown';
  }

  /**
   * Get PayTabs specific configuration
   * @returns {Object} Configuration details
   */
  getGatewayConfig() {
    // Define supported currencies based on region
    let supportedCurrencies = ['AED']; // Default for UAE

    // Force SAR only for this PayTabs profile since AED is not actually supported
    // Even though the profile is in UAE region, it only supports SAR
    supportedCurrencies = ['SAR']; // Only SAR is actually supported by this profile

    console.log(`🔍 PayTabs region: ${this.region}, forced to SAR only due to profile limitations`);

    return {
      gatewayName: 'paytabs',
      displayName: 'PayTabs',
      supportedCurrencies: supportedCurrencies,
      supportedPaymentMethods: ['credit_card', 'debit_card', 'apple_pay'],
      region: this.region,
      isConfigured: !!(this.profileId && this.serverKey),
      configurationStatus: {
        hasProfileId: !!this.profileId,
        hasServerKey: !!this.serverKey,
        profileId: this.profileId,
        serverKeyPreview: this.serverKey ? `${this.serverKey.substring(0, 10)}...` : 'MISSING',
        region: this.region,
        supportedCurrencies: supportedCurrencies
      }
    };
  }

  /**
   * Test PayTabs connection and credentials
   * @returns {Promise<Object>} Connection test result
   */
  async testConnection() {
    try {
      if (!this.profileId || !this.serverKey) {
        return {
          success: false,
          error: 'PayTabs configuration is incomplete',
          details: {
            hasProfileId: !!this.profileId,
            hasServerKey: !!this.serverKey
          }
        };
      }

      // Make a simple test request to verify credentials
      const testData = {
        profile_id: this.profileId,
        server_key: this.serverKey,
        tran_type: 'sale',
        tran_class: 'ecom',
        cart_id: 'TEST_CONNECTION',
        cart_description: 'Connection Test',
        cart_currency: 'SAR',
        cart_amount: 1.00,
        customer_details: {
          name: 'Test Customer',
          email: 'test@example.com',
          phone: '+1234567890',
          street1: 'Test Street',
          city: 'Test City',
          state: 'Test State',
          country: 'US',
          zip: '12345'
        },
        callback: 'https://example.com/callback',
        return: 'https://example.com/return'
      };

      const response = await this.makeRequest(
        'POST',
        `${this.baseUrl}/payment/request`,
        testData,
        { 'Content-Type': 'application/json' }
      );

      console.log('🔍 PayTabs - Connection test result:', {
        success: response.success,
        status: response.status,
        hasData: !!response.data,
        hasError: !!response.error,
        isServerError: response.isServerError
      });

      if (response.success) {
        return {
          success: true,
          message: 'PayTabs connection successful',
          data: response.data
        };
      } else if (response.isServerError) {
        return {
          success: false,
          error: `PayTabs server error (${response.status}): Server is temporarily unavailable`,
          details: response,
          isServerError: true
        };
      } else {
        return {
          success: false,
          error: 'PayTabs connection failed',
          details: response
        };
      }

    } catch (error) {
      return {
        success: false,
        error: 'PayTabs connection test failed',
        details: error.message
      };
    }
  }

  /**
   * Test gateway connection
   * @returns {Promise<Object>} Connection test result
   */
  async testConnection() {
    try {
      // Test with a minimal query request
      const response = await this.makeRequest(
        'POST',
        `${this.baseUrl}/payment/query`,
        {
          profile_id: this.profileId,
          tran_ref: 'TEST_CONNECTION'
        },
        {
          'Authorization': this.serverKey,
          'Content-Type': 'application/json'
        }
      );

      return {
        success: true,
        connected: response.success,
        message: response.success ? 'Connection successful' : 'Connection failed',
        details: response.data
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

  /**
   * Check PayTabs server health
   * @returns {Promise<Object>} Server health status
   */
  async checkServerHealth() {
    try {
      console.log('🔄 PayTabs - Checking server health...');

      // Make a minimal request to check if PayTabs servers are responding
      const testData = {
        profile_id: this.profileId,
        server_key: this.serverKey
      };

      const response = await this.makeRequest(
        'POST',
        `${this.baseUrl}/payment/query`,
        testData,
        { 'Content-Type': 'application/json' }
      );

      console.log('🔍 PayTabs - Server health check result:', {
        success: response.success,
        status: response.status,
        isServerError: response.isServerError
      });

      // If we get a server error (522, 503, 502), servers are down
      if (response.isServerError || response.status >= 500) {
        return {
          success: false,
          status: response.status,
          message: `PayTabs servers are experiencing issues (${response.status})`,
          isServerError: true
        };
      }

      // If we get any response (even auth errors), servers are up
      return {
        success: true,
        status: response.status || 200,
        message: 'PayTabs servers are accessible'
      };

    } catch (error) {
      console.error('❌ PayTabs - Server health check failed:', error.message);
      return {
        success: false,
        status: 500,
        message: 'PayTabs servers are not accessible',
        error: error.message,
        isServerError: true
      };
    }
  }
}

module.exports = PayTabsService;
