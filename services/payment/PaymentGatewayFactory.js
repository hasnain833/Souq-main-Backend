const PayTabsService = require('./PayTabsService');
const StripeService = require('./StripeService');
const PayPalService = require('./PayPalService');
const PaymentGateway = require('../../db/models/paymentGatewayModel');

class PaymentGatewayFactory {
  constructor() {
    this.gateways = new Map();
    this.initialized = false;
  }

  /**
   * Initialize all payment gateways from database configuration
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      console.log('🔄 Loading payment gateway configurations from database...');
      const gatewayConfigs = await PaymentGateway.find({ isActive: true });

      console.log(`Found ${gatewayConfigs.length} active payment gateways in database`);

      for (const config of gatewayConfigs) {
        console.log(`🔧 Registering gateway: ${config.gatewayName}`);
        if (config.gatewayName === 'stripe') {
          console.log('Stripe configuration from database:', {
            hasConfiguration: !!config.configuration,
            hasStripeConfig: !!config.configuration?.stripe,
            hasSecretKey: !!config.configuration?.stripe?.secretKey,
            hasPublishableKey: !!config.configuration?.stripe?.publishableKey,
            secretKeyPrefix: config.configuration?.stripe?.secretKey ?
              config.configuration.stripe.secretKey.substring(0, 7) + '...' : 'Missing',
            publishableKeyPrefix: config.configuration?.stripe?.publishableKey ?
              config.configuration.stripe.publishableKey.substring(0, 7) + '...' : 'Missing'
          });
        }
        await this.registerGateway(config);
      }

      this.initialized = true;
      console.log(`✅ Initialized ${this.gateways.size} payment gateways`);

    } catch (error) {
      console.error('❌ Failed to initialize payment gateways:', error.message);
      throw error;
    }
  }

  /**
   * Register a payment gateway
   * @param {Object} config - Gateway configuration from database
   * @returns {Promise<void>}
   */
  async registerGateway(config) {
    try {
      let gatewayService;

      switch (config.gatewayName) {
        case 'paytabs':
          gatewayService = new PayTabsService(config);
          break;
        case 'stripe':
          gatewayService = new StripeService(config);
          break;
        case 'paypal':
          gatewayService = new PayPalService(config);
          break;
        case 'payfort':
          // TODO: Implement PayFort service
          console.warn(`⚠️ PayFort service not implemented yet`);
          return;
        case 'checkout':
          // TODO: Implement Checkout.com service
          console.warn(`⚠️ Checkout.com service not implemented yet`);
          return;
        default:
          console.warn(`⚠️ Unknown gateway: ${config.gatewayName}`);
          return;
      }

      // Test connection if configured
      const gatewayConfig = gatewayService.getGatewayConfig();
      if (gatewayConfig.isConfigured) {
        const connectionTest = await gatewayService.testConnection();
        if (!connectionTest.connected) {
          console.warn(`⚠️ Gateway ${config.gatewayName} connection test failed:`, connectionTest.message);
        }
      }

      this.gateways.set(config.gatewayName, gatewayService);
      console.log(`✅ Registered gateway: ${config.displayName}`);

    } catch (error) {
      console.error(`❌ Failed to register gateway ${config.gatewayName}:`, error.message);
    }
  }

  /**
   * Get a specific payment gateway service
   * @param {string} gatewayName - Gateway name
   * @returns {Object|null} Gateway service instance
   */
  getGateway(gatewayName) {
    if (!this.initialized) {
      throw new Error('Payment gateway factory not initialized. Call initialize() first.');
    }

    return this.gateways.get(gatewayName) || null;
  }

  /**
   * Get all available payment gateways
   * @returns {Array<Object>} Array of gateway services
   */
  getAllGateways() {
    if (!this.initialized) {
      throw new Error('Payment gateway factory not initialized. Call initialize() first.');
    }

    return Array.from(this.gateways.values());
  }

  /**
   * Get gateways that support a specific currency
   * @param {string} currency - Currency code
   * @returns {Array<Object>} Array of supporting gateway services
   */
  getGatewaysForCurrency(currency) {
    return this.getAllGateways().filter(gateway => 
      gateway.isCurrencySupported(currency)
    );
  }

  /**
   * Get the best gateway for a transaction
   * @param {number} amount - Transaction amount
   * @param {string} currency - Currency code
   * @param {string} paymentMethod - Payment method preference
   * @returns {Object|null} Best gateway service
   */
  getBestGateway(amount, currency = 'AED', paymentMethod = 'credit_card') {
    const supportingGateways = this.getGatewaysForCurrency(currency);
    
    if (supportingGateways.length === 0) {
      return null;
    }

    // Filter by payment method support
    const methodSupportingGateways = supportingGateways.filter(gateway => {
      const config = gateway.getGatewayConfig();
      return config.supportedPaymentMethods.includes(paymentMethod);
    });

    if (methodSupportingGateways.length === 0) {
      return supportingGateways[0]; // Fallback to first supporting gateway
    }

    // Find gateway with lowest fee
    let bestGateway = methodSupportingGateways[0];
    let lowestFee = bestGateway.calculateGatewayFee(amount, currency);

    for (const gateway of methodSupportingGateways) {
      const fee = gateway.calculateGatewayFee(amount, currency);
      if (fee < lowestFee) {
        lowestFee = fee;
        bestGateway = gateway;
      }
    }

    return bestGateway;
  }

  /**
   * Process payment through specified gateway
   * @param {string} gatewayName - Gateway name
   * @param {Object} paymentData - Payment details
   * @returns {Promise<Object>} Payment result
   */
  async processPayment(gatewayName, paymentData) {
    const gateway = this.getGateway(gatewayName);
    
    if (!gateway) {
      return {
        success: false,
        error: `Gateway ${gatewayName} not available`
      };
    }

    try {
      return await gateway.initializePayment(paymentData);
    } catch (error) {
      return {
        success: false,
        error: error.message,
        details: error
      };
    }
  }

  /**
   * Verify payment through specified gateway
   * @param {string} gatewayName - Gateway name
   * @param {string} transactionId - Transaction ID
   * @returns {Promise<Object>} Verification result
   */
  async verifyPayment(gatewayName, transactionId) {
    const gateway = this.getGateway(gatewayName);
    
    if (!gateway) {
      return {
        success: false,
        error: `Gateway ${gatewayName} not available`
      };
    }

    try {
      return await gateway.verifyPayment(transactionId);
    } catch (error) {
      return {
        success: false,
        error: error.message,
        details: error
      };
    }
  }

  /**
   * Process refund through specified gateway
   * @param {string} gatewayName - Gateway name
   * @param {Object} refundData - Refund details
   * @returns {Promise<Object>} Refund result
   */
  async processRefund(gatewayName, refundData) {
    const gateway = this.getGateway(gatewayName);
    
    if (!gateway) {
      return {
        success: false,
        error: `Gateway ${gatewayName} not available`
      };
    }

    try {
      return await gateway.processRefund(refundData);
    } catch (error) {
      return {
        success: false,
        error: error.message,
        details: error
      };
    }
  }

  /**
   * Handle webhook from specified gateway
   * @param {string} gatewayName - Gateway name
   * @param {Object} webhookData - Webhook payload
   * @param {string} signature - Webhook signature (if applicable)
   * @returns {Promise<Object>} Webhook processing result
   */
  async handleWebhook(gatewayName, webhookData, signature = null) {
    const gateway = this.getGateway(gatewayName);
    
    if (!gateway) {
      return {
        success: false,
        error: `Gateway ${gatewayName} not available`
      };
    }

    try {
      if (signature && gateway.handleWebhook.length > 1) {
        return await gateway.handleWebhook(webhookData, signature);
      }
      return await gateway.handleWebhook(webhookData);
    } catch (error) {
      return {
        success: false,
        error: error.message,
        details: error
      };
    }
  }

  /**
   * Get gateway status information
   * @returns {Array<Object>} Status of all gateways
   */
  getGatewayStatus() {
    return this.getAllGateways().map(gateway => gateway.getStatus());
  }

  /**
   * Reload gateway configurations from database
   * @returns {Promise<void>}
   */
  async reloadConfigurations() {
    this.gateways.clear();
    this.initialized = false;
    await this.initialize();
  }

  /**
   * Calculate fees for all gateways
   * @param {number} amount - Transaction amount
   * @param {string} currency - Currency code
   * @returns {Object} Fee comparison across gateways
   */
  calculateFeesComparison(amount, currency = 'AED') {
    const supportingGateways = this.getGatewaysForCurrency(currency);
    const feeComparison = {};

    for (const gateway of supportingGateways) {
      const config = gateway.getGatewayConfig();
      feeComparison[config.gatewayName] = {
        displayName: config.displayName,
        fee: gateway.calculateGatewayFee(amount, currency),
        supportedMethods: config.supportedPaymentMethods
      };
    }

    return feeComparison;
  }

  /**
   * Health check for all gateways
   * @returns {Promise<Object>} Health status of all gateways
   */
  async healthCheck() {
    const results = {};
    
    for (const [gatewayName, gateway] of this.gateways) {
      try {
        const status = await gateway.testConnection();
        results[gatewayName] = {
          status: status.connected ? 'healthy' : 'unhealthy',
          message: status.message,
          lastChecked: new Date().toISOString()
        };
      } catch (error) {
        results[gatewayName] = {
          status: 'error',
          message: error.message,
          lastChecked: new Date().toISOString()
        };
      }
    }

    return results;
  }
}

// Create singleton instance
const paymentGatewayFactory = new PaymentGatewayFactory();

module.exports = paymentGatewayFactory;
