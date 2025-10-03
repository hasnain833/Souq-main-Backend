const BasePaymentService = require('./BasePaymentService');

class PayPalService extends BasePaymentService {
  constructor(config) {
    super(config);
    // Read credentials from environment only (no fallbacks/hardcoded defaults)
    this.clientId = process.env.PAYPAL_CLIENT_ID;
    this.clientSecret = process.env.PAYPAL_CLIENT_SECRET;

    // Determine environment from env var (defaults to sandbox)
    const env = (process.env.PAYPAL_ENV || 'sandbox').toLowerCase();
    this.environment = env === 'production' ? 'production' : 'sandbox';

    // Set base URL by environment
    this.baseUrl = this.environment === 'production'
      ? 'https://api.paypal.com'
      : 'https://api.sandbox.paypal.com';

    // Validate required env vars
    if (!this.clientId || !this.clientSecret) {
      throw new Error('PayPal configuration error: PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be set in environment variables');
    }

    this.accessToken = null;
    this.tokenExpiry = null;
  }
  async getAccessToken() {
    try {
      // Check if current token is still valid
      if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
        return this.accessToken;
      }

      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

      const response = await this.makeRequest(
        'POST',
        `${this.baseUrl}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      );

      if (response.success && response.data.access_token) {
        this.accessToken = response.data.access_token;
        // Set expiry to 5 minutes before actual expiry for safety
        this.tokenExpiry = new Date(Date.now() + (response.data.expires_in - 300) * 1000);
        return this.accessToken;
      }

      throw new Error('Failed to get PayPal access token');

    } catch (error) {
      throw new Error(`PayPal authentication failed: ${error.message}`);
    }
  }

  async initializePayment(paymentData) {
    try {
      const validation = this.validatePaymentData(paymentData);
      if (!validation.isValid) {
        return {
          success: false,
          error: 'Validation failed',
          details: validation.errors
        };
      }

      const accessToken = await this.getAccessToken();

      const orderData = {
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: paymentData.orderId,
          description: paymentData.description || 'SOUQ Marketplace Purchase',
          amount: {
            currency_code: paymentData.currency,
            value: this.formatAmount(paymentData.amount).toString()
          },
          shipping: paymentData.shippingAddress ? {
            name: {
              full_name: paymentData.shippingAddress.name || paymentData.customerName
            },
            address: {
              address_line_1: paymentData.shippingAddress.street1,
              address_line_2: paymentData.shippingAddress.street2,
              admin_area_2: paymentData.shippingAddress.city,
              admin_area_1: paymentData.shippingAddress.state,
              postal_code: paymentData.shippingAddress.zip,
              country_code: paymentData.shippingAddress.country
            }
          } : null,
          custom_id: paymentData.escrowTransactionId
        }],
        payment_source: {
          paypal: {
            experience_context: {
              payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
              brand_name: 'SOUQ Marketplace',
              locale: 'en-US',
              landing_page: 'LOGIN',
              shipping_preference: paymentData.shippingAddress ? 'SET_PROVIDED_ADDRESS' : 'NO_SHIPPING',
              user_action: 'PAY_NOW',
              return_url: paymentData.returnUrl,
              cancel_url: paymentData.cancelUrl
            }
          }
        }
      };

      const response = await this.makeRequest(
        'POST',
        `${this.baseUrl}/v2/checkout/orders`,
        orderData,
        {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': this.generateTransactionReference('PP')
        }
      );

      this.logTransaction('INITIALIZE_PAYMENT', orderData, response);

      if (response.success && response.data.id) {
        const approvalUrl = response.data.links?.find(link => link.rel === 'approve')?.href;

        return {
          success: true,
          transactionId: response.data.id,
          paymentUrl: approvalUrl,
          gatewayResponse: response.data
        };
      }

      return {
        success: false,
        error: response.data?.message || 'Payment initialization failed',
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
  async capturePayment(orderId) {
    try {
      const accessToken = await this.getAccessToken();

      const response = await this.makeRequest(
        'POST',
        `${this.baseUrl}/v2/checkout/orders/${orderId}/capture`,
        {},
        {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      );

      this.logTransaction('CAPTURE_PAYMENT', { orderId }, response);

      if (response.success && response.data.status === 'COMPLETED') {
        const capture = response.data.purchase_units[0]?.payments?.captures[0];

        return {
          success: true,
          status: 'completed',
          transactionId: orderId,
          captureId: capture?.id,
          amount: parseFloat(capture?.amount?.value || 0),
          currency: capture?.amount?.currency_code,
          gatewayTransactionId: capture?.id,
          gatewayResponse: response.data
        };
      }

      return {
        success: false,
        error: response.data?.message || 'Payment capture failed',
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
  async generateClientToken() {
    try {
      // Use Basic auth per PayPal docs
      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      const response = await this.makeRequest(
        'POST',
        `${this.baseUrl}/v1/identity/generate-token`,
        {},
        {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      );

      if (response.success && response.data?.client_token) {
        return { success: true, clientToken: response.data.client_token };
      }
      return { success: false, error: response.data?.message || 'Failed to generate client token' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async verifyPayment(transactionId) {
    try {
      const accessToken = await this.getAccessToken();

      const response = await this.makeRequest(
        'GET',
        `${this.baseUrl}/v2/checkout/orders/${transactionId}`,
        {},
        {
          'Authorization': `Bearer ${accessToken}`
        }
      );

      this.logTransaction('VERIFY_PAYMENT', { transactionId }, response);

      if (response.success && response.data) {
        const status = this.mapPaymentStatus(response.data.status);
        const capture = response.data.purchase_units?.[0]?.payments?.captures?.[0];

        return {
          success: true,
          status: status,
          transactionId: response.data.id,
          amount: parseFloat(response.data.purchase_units?.[0]?.amount?.value || 0),
          currency: response.data.purchase_units?.[0]?.amount?.currency_code,
          gatewayTransactionId: capture?.id,
          gatewayResponse: response.data,
          paidAt: capture?.create_time ? new Date(capture.create_time) : null
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
  async processRefund(refundData) {
    try {
      const accessToken = await this.getAccessToken();

      const refundRequest = {
        amount: {
          value: this.formatAmount(refundData.amount).toString(),
          currency_code: refundData.currency
        },
        note_to_payer: refundData.reason || 'Refund from SOUQ Marketplace'
      };

      const response = await this.makeRequest(
        'POST',
        `${this.baseUrl}/v2/payments/captures/${refundData.captureId}/refund`,
        refundRequest,
        {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': this.generateTransactionReference('RF')
        }
      );

      this.logTransaction('PROCESS_REFUND', refundRequest, response);

      if (response.success && response.data.status === 'COMPLETED') {
        return {
          success: true,
          refundId: response.data.id,
          status: 'completed',
          amount: parseFloat(response.data.amount.value),
          currency: response.data.amount.currency_code,
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

  async handleWebhook(webhookData) {
    try {
      const { event_type, resource } = webhookData;

      this.logTransaction('WEBHOOK_RECEIVED', { event_type }, resource);

      switch (event_type) {
        case 'CHECKOUT.ORDER.APPROVED':
          return {
            success: true,
            eventType: 'payment_approved',
            transactionId: resource.id,
            status: 'approved',
            rawData: webhookData
          };

        case 'PAYMENT.CAPTURE.COMPLETED':
          return {
            success: true,
            eventType: 'payment_completed',
            transactionId: resource.supplementary_data?.related_ids?.order_id,
            captureId: resource.id,
            status: 'completed',
            amount: parseFloat(resource.amount?.value || 0),
            currency: resource.amount?.currency_code,
            rawData: webhookData
          };

        case 'PAYMENT.CAPTURE.DENIED':
          return {
            success: true,
            eventType: 'payment_failed',
            transactionId: resource.supplementary_data?.related_ids?.order_id,
            status: 'failed',
            rawData: webhookData
          };

        default:
          return {
            success: true,
            eventType: 'unhandled',
            message: `Unhandled webhook event: ${event_type}`,
            rawData: webhookData
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
  mapPaymentStatus(paypalStatus) {
    const statusMap = {
      'CREATED': 'processing',
      'SAVED': 'processing',
      'APPROVED': 'processing',
      'VOIDED': 'cancelled',
      'COMPLETED': 'completed',
      'PAYER_ACTION_REQUIRED': 'processing'
    };

    return statusMap[paypalStatus] || 'unknown';
  }

  getGatewayConfig() {
    return {
      gatewayName: 'paypal',
      displayName: 'PayPal',
      supportedCurrencies: ['USD', 'EUR', 'GBP', 'AED'],
      supportedPaymentMethods: ['paypal', 'credit_card'],
      environment: this.environment,
      isConfigured: !!(this.clientId && this.clientSecret)
    };
  }

  async testConnection() {
    try {
      const accessToken = await this.getAccessToken();

      return {
        success: true,
        connected: !!accessToken,
        message: 'Connection successful',
        environment: this.environment
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

module.exports = PayPalService;
