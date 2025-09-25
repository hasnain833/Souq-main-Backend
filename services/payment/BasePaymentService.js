const axios = require('axios');
const crypto = require('crypto');

class BasePaymentService {
  constructor(config) {
    this.config = config;
    this.gatewayName = config.gatewayName;
    this.isTestMode = config.isTestMode || false;
  }

  /**
   * Initialize payment - to be implemented by each gateway
   * @param {Object} paymentData - Payment details
   * @returns {Promise<Object>} Payment initialization response
   */
  async initializePayment(paymentData) {
    throw new Error('initializePayment method must be implemented by subclass');
  }

  /**
   * Process payment - to be implemented by each gateway
   * @param {Object} paymentData - Payment details
   * @returns {Promise<Object>} Payment processing response
   */
  async processPayment(paymentData) {
    throw new Error('processPayment method must be implemented by subclass');
  }

  /**
   * Verify payment status - to be implemented by each gateway
   * @param {string} transactionId - Transaction ID
   * @returns {Promise<Object>} Payment status
   */
  async verifyPayment(transactionId) {
    throw new Error('verifyPayment method must be implemented by subclass');
  }

  /**
   * Process refund - to be implemented by each gateway
   * @param {Object} refundData - Refund details
   * @returns {Promise<Object>} Refund response
   */
  async processRefund(refundData) {
    throw new Error('processRefund method must be implemented by subclass');
  }

  /**
   * Handle webhook - to be implemented by each gateway
   * @param {Object} webhookData - Webhook payload
   * @returns {Promise<Object>} Processed webhook data
   */
  async handleWebhook(webhookData) {
    throw new Error('handleWebhook method must be implemented by subclass');
  }

  /**
   * Calculate gateway fee
   * @param {number} amount - Transaction amount
   * @param {string} currency - Currency code
   * @returns {number} Gateway fee
   */
  calculateGatewayFee(amount, currency = 'AED') {
    const { fixedFee = 0, percentageFee = 0, minimumFee = 0, maximumFee = null } = this.config.feeStructure || {};
    
    let fee = fixedFee + (amount * percentageFee / 100);
    
    if (minimumFee && fee < minimumFee) {
      fee = minimumFee;
    }
    
    if (maximumFee && fee > maximumFee) {
      fee = maximumFee;
    }
    
    return Math.round(fee * 100) / 100;
  }

  /**
   * Validate payment data
   * @param {Object} paymentData - Payment data to validate
   * @returns {Object} Validation result
   */
  validatePaymentData(paymentData) {
    const errors = [];
    
    if (!paymentData.amount || paymentData.amount <= 0) {
      errors.push('Invalid amount');
    }
    
    if (!paymentData.currency) {
      errors.push('Currency is required');
    }
    
    if (!paymentData.customerEmail) {
      errors.push('Customer email is required');
    }
    
    if (!paymentData.orderId) {
      errors.push('Order ID is required');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate secure hash for payment verification
   * @param {Object} data - Data to hash
   * @param {string} secret - Secret key
   * @returns {string} Generated hash
   */
  generateHash(data, secret) {
    const sortedKeys = Object.keys(data).sort();
    const hashString = sortedKeys.map(key => `${key}=${data[key]}`).join('&');
    return crypto.createHmac('sha256', secret).update(hashString).digest('hex');
  }

  /**
   * Verify webhook signature
   * @param {string} payload - Webhook payload
   * @param {string} signature - Received signature
   * @param {string} secret - Webhook secret
   * @returns {boolean} Signature validity
   */
  verifyWebhookSignature(payload, signature, secret) {
    const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  }

  /**
   * Make HTTP request to gateway API
   * @param {string} method - HTTP method
   * @param {string} url - API endpoint
   * @param {Object} data - Request data
   * @param {Object} headers - Request headers
   * @returns {Promise<Object>} API response
   */
  async makeRequest(method, url, data = {}, headers = {}) {
    try {
      const config = {
        method,
        url,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        timeout: 30000 // 30 seconds timeout
      };

      if (method.toLowerCase() === 'get') {
        config.params = data;
      } else {
        config.data = data;
      }

      const response = await axios(config);
      return {
        success: true,
        data: response.data,
        status: response.status
      };
    } catch (error) {
      // Handle different types of errors
      let errorMessage = error.message;
      let errorData = error.response?.data;
      let status = error.response?.status || 500;

      // Check if the error is HTML (server error page)
      if (typeof errorData === 'string' && errorData.includes('<!DOCTYPE html>')) {
        // Extract error information from HTML
        if (errorData.includes('522: Connection timed out')) {
          errorMessage = 'PayTabs server connection timeout (Error 522)';
          status = 522;
        } else if (errorData.includes('503 Service Unavailable')) {
          errorMessage = 'PayTabs service temporarily unavailable (Error 503)';
          status = 503;
        } else if (errorData.includes('502 Bad Gateway')) {
          errorMessage = 'PayTabs server error (Error 502)';
          status = 502;
        } else {
          errorMessage = 'PayTabs server error - HTML response received';
        }
        errorData = { serverError: true, htmlResponse: true };
      }

      return {
        success: false,
        error: errorData || errorMessage,
        status: status,
        isServerError: typeof errorData === 'string' && errorData.includes('<!DOCTYPE html>')
      };
    }
  }

  /**
   * Format amount for gateway (some gateways require cents)
   * @param {number} amount - Amount in main currency unit
   * @param {boolean} toCents - Convert to cents
   * @returns {number} Formatted amount
   */
  formatAmount(amount, toCents = false) {
    if (toCents) {
      return Math.round(amount * 100);
    }
    return Math.round(amount * 100) / 100;
  }

  /**
   * Generate unique transaction reference
   * @param {string} prefix - Reference prefix
   * @returns {string} Unique reference
   */
  generateTransactionReference(prefix = 'TXN') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Log transaction for debugging
   * @param {string} action - Action being performed
   * @param {Object} data - Transaction data
   * @param {Object} response - Gateway response
   */
  logTransaction(action, data, response) {
    if (this.isTestMode) {
      console.log(`[${this.gatewayName.toUpperCase()}] ${action}:`, {
        timestamp: new Date().toISOString(),
        data: this.sanitizeLogData(data),
        response: this.sanitizeLogData(response)
      });
    }
  }

  /**
   * Remove sensitive data from logs
   * @param {Object} data - Data to sanitize
   * @returns {Object} Sanitized data
   */
  sanitizeLogData(data) {
    if (!data || typeof data !== 'object') return data;
    
    const sensitiveFields = ['password', 'secret', 'key', 'token', 'cvv', 'pin'];
    const sanitized = { ...data };
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '***REDACTED***';
      }
    }
    
    return sanitized;
  }

  /**
   * Get supported currencies for this gateway
   * @returns {Array<string>} Supported currencies
   */
  getSupportedCurrencies() {
    return this.config.supportedCurrencies || ['AED'];
  }

  /**
   * Check if currency is supported
   * @param {string} currency - Currency code
   * @returns {boolean} Currency support status
   */
  isCurrencySupported(currency) {
    return this.getSupportedCurrencies().includes(currency);
  }

  /**
   * Get gateway status
   * @returns {Object} Gateway status information
   */
  getStatus() {
    return {
      gatewayName: this.gatewayName,
      isActive: this.config.isActive,
      isTestMode: this.isTestMode,
      supportedCurrencies: this.getSupportedCurrencies(),
      lastHealthCheck: new Date().toISOString()
    };
  }
}

module.exports = BasePaymentService;
