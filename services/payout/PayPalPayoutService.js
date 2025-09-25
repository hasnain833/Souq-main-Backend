const axios = require('axios');

class PayPalPayoutService {
  constructor(paypalConfig) {
    this.clientId = paypalConfig?.clientId || process.env.PAYPAL_CLIENT_ID;
    this.clientSecret = paypalConfig?.clientSecret || process.env.PAYPAL_CLIENT_SECRET;
    this.mode = paypalConfig?.mode || process.env.PAYPAL_MODE || 'sandbox';
    this.baseURL = this.mode === 'live' 
      ? 'https://api.paypal.com' 
      : 'https://api.sandbox.paypal.com';
    
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Get PayPal access token
   */
  async getAccessToken() {
    try {
      // Check if we have a valid token
      if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
        return this.accessToken;
      }

      console.log('🔄 Getting PayPal access token...');

      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      
      const response = await axios.post(`${this.baseURL}/v1/oauth2/token`, 
        'grant_type=client_credentials',
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.accessToken = response.data.access_token;
      // Set expiry to 5 minutes before actual expiry for safety
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in - 300) * 1000);

      console.log('✅ PayPal access token obtained');
      return this.accessToken;

    } catch (error) {
      console.error('❌ Error getting PayPal access token:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with PayPal');
    }
  }

  /**
   * Create PayPal payout
   */
  async createPayout(payoutData) {
    try {
      console.log('🔄 Creating PayPal payout:', {
        amount: payoutData.amount,
        currency: payoutData.currency,
        email: payoutData.paypalEmail,
        userId: payoutData.userId
      });

      // For now, simulate PayPal payout since we don't have real PayPal credentials
      if (process.env.PAYPAL_SIMULATION_MODE === 'true' || !this.clientId || !this.clientSecret) {
        return this.simulatePayPalPayout(payoutData);
      }

      const accessToken = await this.getAccessToken();
      
      const payoutRequest = {
        sender_batch_header: {
          sender_batch_id: `batch_${Date.now()}_${payoutData.userId}`,
          email_subject: 'You have a payout!',
          email_message: 'You have received a payout from your wallet withdrawal.'
        },
        items: [
          {
            recipient_type: 'EMAIL',
            amount: {
              value: payoutData.amount.toFixed(2),
              currency: payoutData.currency
            },
            receiver: payoutData.paypalEmail,
            note: payoutData.description || 'Wallet withdrawal',
            sender_item_id: payoutData.walletTransactionId
          }
        ]
      };

      const response = await axios.post(`${this.baseURL}/v1/payments/payouts`, payoutRequest, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      const payoutBatchId = response.data.batch_header.payout_batch_id;
      const payoutItemId = response.data.items[0].payout_item_id;

      console.log('✅ PayPal payout created successfully:', {
        batchId: payoutBatchId,
        itemId: payoutItemId
      });

      return {
        success: true,
        payoutId: payoutBatchId,
        payoutItemId: payoutItemId,
        status: 'pending',
        estimatedArrival: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        provider: 'paypal',
        rawResponse: response.data
      };

    } catch (error) {
      console.error('❌ PayPal payout creation failed:', error.response?.data || error.message);
      
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'PayPal payout failed',
        code: error.response?.data?.name || 'PAYPAL_ERROR',
        details: error.response?.data
      };
    }
  }

  /**
   * Simulate PayPal payout for testing
   */
  async simulatePayPalPayout(payoutData) {
    console.log('🧪 Simulating PayPal payout...');
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Simulate failure for test emails
    if (payoutData.paypalEmail && payoutData.paypalEmail.includes('test-fail')) {
      return {
        success: false,
        error: 'PayPal account not found or cannot receive payments',
        code: 'RECEIVER_UNREGISTERED'
      };
    }

    const payoutId = `PAYPAL_BATCH_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const payoutItemId = `PAYPAL_ITEM_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      success: true,
      payoutId: payoutId,
      payoutItemId: payoutItemId,
      status: 'pending',
      estimatedArrival: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      provider: 'paypal_simulation',
      simulationData: {
        amount: payoutData.amount,
        currency: payoutData.currency,
        recipient: payoutData.paypalEmail,
        note: payoutData.description
      }
    };
  }

  /**
   * Check payout status
   */
  async checkPayoutStatus(payoutId) {
    try {
      // For simulation mode
      if (process.env.PAYPAL_SIMULATION_MODE === 'true' || !this.clientId || !this.clientSecret) {
        return this.simulatePayoutStatusCheck(payoutId);
      }

      const accessToken = await this.getAccessToken();
      
      const response = await axios.get(`${this.baseURL}/v1/payments/payouts/${payoutId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      const batchStatus = response.data.batch_header.batch_status;
      const items = response.data.items || [];

      return {
        success: true,
        batchStatus: batchStatus,
        items: items.map(item => ({
          payoutItemId: item.payout_item_id,
          status: item.transaction_status,
          amount: item.payout_item.amount,
          recipient: item.payout_item.receiver,
          timeProcessed: item.time_processed
        }))
      };

    } catch (error) {
      console.error('❌ Error checking PayPal payout status:', error.response?.data || error.message);
      
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to check payout status'
      };
    }
  }

  /**
   * Simulate payout status check
   */
  async simulatePayoutStatusCheck(payoutId) {
    console.log('🧪 Simulating PayPal payout status check for:', payoutId);
    
    // Simulate different statuses based on payout age
    const payoutAge = Date.now() - parseInt(payoutId.split('_')[2] || Date.now());
    const hoursOld = payoutAge / (1000 * 60 * 60);

    let status = 'PENDING';
    if (hoursOld > 48) {
      status = 'SUCCESS';
    } else if (hoursOld > 24) {
      status = 'PROCESSING';
    }

    return {
      success: true,
      batchStatus: status,
      items: [{
        payoutItemId: `${payoutId}_ITEM`,
        status: status,
        timeProcessed: hoursOld > 24 ? new Date().toISOString() : null
      }]
    };
  }

  /**
   * Get payout details
   */
  async getPayoutDetails(payoutItemId) {
    try {
      // For simulation mode
      if (process.env.PAYPAL_SIMULATION_MODE === 'true' || !this.clientId || !this.clientSecret) {
        return {
          success: true,
          payoutItemId: payoutItemId,
          status: 'SUCCESS',
          amount: { value: '100.00', currency: 'USD' },
          recipient: 'user@example.com',
          timeProcessed: new Date().toISOString()
        };
      }

      const accessToken = await this.getAccessToken();
      
      const response = await axios.get(`${this.baseURL}/v1/payments/payouts-item/${payoutItemId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        ...response.data
      };

    } catch (error) {
      console.error('❌ Error getting PayPal payout details:', error.response?.data || error.message);
      
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to get payout details'
      };
    }
  }
}

module.exports = PayPalPayoutService;