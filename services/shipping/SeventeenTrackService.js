const axios = require('axios');

/**
 * 17Track Service
 * Helper service for 17Track tracking integration
 * Note: This service is optional - sellers provide tracking URLs manually
 * This service can be used to generate 17Track URLs if needed
 */
class SeventeenTrackService {
  constructor() {
    // Optional: 17Track API key if using API features
    this.apiKey = process.env.SEVENTEENTRACK_API_KEY || null;
    this.baseUrl = 'https://api.17track.net/track/v2.2';
    this.trackingUrl = 'https://t.17track.net';
    
    // Map internal provider codes to 17Track carrier codes
    this.carrierCodes = {
      'emirates_post': 'emirates-post',
      'aramex': 'aramex',
      'dhl': 'dhl',
      'fedex': 'fedex',
      'ups': 'ups',
      'smsa': 'smsa',
      'naqel': 'naqel',
      'zajil': 'zajil',
      'other': 'other'
    };
  }

  /**
   * Get carrier code for 17Track
   */
  getCarrierCode(providerCode) {
    return this.carrierCodes[providerCode] || 'other';
  }

  /**
   * Generate 17Track tracking URL
   * This is optional - sellers can provide their own tracking URLs
   */
  generateTrackingUrl(trackingNumber, providerCode = null) {
    if (providerCode) {
      const carrierCode = this.getCarrierCode(providerCode);
      return `${this.trackingUrl}/en#nums=${trackingNumber}&fc=${carrierCode}`;
    }
    // Generic 17Track URL without carrier specification
    return `${this.trackingUrl}/en#nums=${trackingNumber}`;
  }

  /**
   * Create tracking in 17Track (optional - if using API)
   * Note: This is optional since sellers provide URLs manually
   */
  async createTracking(trackingData) {
    if (!this.apiKey) {
      console.warn('⚠️ 17Track API key not configured. Skipping API tracking creation.');
      return {
        success: false,
        error: '17Track API key not configured',
        trackingUrl: this.generateTrackingUrl(trackingData.trackingNumber, trackingData.providerCode)
      };
    }

    try {
      const { providerCode, trackingNumber, orderData } = trackingData;
      const carrierCode = this.getCarrierCode(providerCode);

      const payload = {
        number: trackingNumber,
        carrier: carrierCode !== 'other' ? carrierCode : null,
        title: `Order ${orderData?.transactionId || 'N/A'}`,
        tag: orderData?.transactionId || null
      };

      const response = await axios.post(`${this.baseUrl}/register`, payload, {
        headers: {
          '17token': this.apiKey,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ 17Track tracking created:', response.data.data?.accepted?.[0]?.number);
      
      return {
        success: true,
        trackingNumber: trackingNumber,
        trackingUrl: this.generateTrackingUrl(trackingNumber, providerCode),
        data: response.data
      };

    } catch (error) {
      console.error('❌ 17Track create tracking error:', error.response?.data || error.message);
      
      // Return fallback tracking URL even if 17Track API fails
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        trackingUrl: this.generateTrackingUrl(trackingData.trackingNumber, trackingData.providerCode)
      };
    }
  }

  /**
   * Get tracking information from 17Track (optional - if using API)
   */
  async getTracking(trackingNumber, carrierCode = null) {
    if (!this.apiKey) {
      console.warn('⚠️ 17Track API key not configured. Cannot fetch tracking data.');
      return {
        success: false,
        error: '17Track API key not configured'
      };
    }

    try {
      const payload = {
        numbers: [trackingNumber]
      };

      if (carrierCode && carrierCode !== 'other') {
        payload.carrier = carrierCode;
      }

      const response = await axios.post(`${this.baseUrl}/gettrackinfo`, payload, {
        headers: {
          '17token': this.apiKey,
          'Content-Type': 'application/json'
        }
      });

      const tracking = response.data.data?.accepted?.[0];
      
      if (!tracking) {
        return {
          success: false,
          error: 'Tracking not found'
        };
      }

      return {
        success: true,
        data: {
          trackingNumber: tracking.number,
          carrier: tracking.carrier,
          status: tracking.latest_status?.status || 'unknown',
          statusDescription: tracking.latest_status?.details || '',
          checkpoints: tracking.latest_checkpoint?.tracking_detail?.map(checkpoint => ({
            timestamp: new Date(checkpoint.tracking_date),
            status: checkpoint.tracking_location?.tracking_detail_status || '',
            description: checkpoint.tracking_detail_description || '',
            location: checkpoint.tracking_location?.city || ''
          })) || [],
          trackingUrl: this.generateTrackingUrl(trackingNumber, carrierCode)
        }
      };

    } catch (error) {
      console.error('❌ 17Track get tracking error:', error.response?.data || error.message);
      
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Handle 17Track webhook (optional - if using webhooks)
   */
  async handleWebhook(webhookData) {
    try {
      // 17Track webhook format may vary - adjust based on actual webhook structure
      const trackingInfo = {
        trackingNumber: webhookData.number || webhookData.tracking_number,
        status: webhookData.status || webhookData.latest_status?.status,
        statusDescription: webhookData.status_description || webhookData.latest_status?.details,
        updatedAt: new Date(webhookData.updated_at || Date.now())
      };

      console.log('📨 17Track webhook received:', trackingInfo);

      return {
        success: true,
        data: trackingInfo
      };

    } catch (error) {
      console.error('❌ 17Track webhook error:', error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate 17Track webhook signature (if using webhooks)
   */
  validateWebhookSignature(payload, signature, secret) {
    if (!secret) {
      console.warn('⚠️ 17Track webhook secret not configured');
      return true; // Allow if no secret configured
    }

    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    return signature === expectedSignature;
  }

  /**
   * Map 17Track status to internal status
   */
  mapSeventeenTrackStatus(status) {
    const statusMap = {
      'Not Found': 'shipped',
      'In Transit': 'in_transit',
      'Expired': 'exception',
      'Exception': 'exception',
      'Delivered': 'delivered',
      'Available for Pickup': 'out_for_delivery',
      'Undelivered': 'exception'
    };

    return statusMap[status] || 'shipped';
  }
}

module.exports = new SeventeenTrackService();

