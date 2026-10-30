const axios = require('axios');

class AfterShipService {
  constructor() {
    this.apiKey = process.env.AFTERSHIP_API_KEY || 'your-aftership-api-key';
    this.baseUrl = 'https://api.aftership.com/v4';
    this.trackingUrl = 'https://track.aftership.com';
    
    this.courierSlugs = {
      'emirates_post': 'emirates-post',
      'aramex': 'aramex',
      'dhl': 'dhl',
      'fedex': 'fedex',
      'ups': 'ups',
      'smsa': 'smsa-express',
      'naqel': 'naqel',
      'zajil': 'zajil-express'
    };
  }

  /**
   * Get courier slug for AfterShip
   */
  getCourierSlug(providerCode) {
    return this.courierSlugs[providerCode] || 'other';
  }

  /**
   * Generate AfterShip tracking URL
   */
  generateTrackingUrl(providerCode, trackingNumber) {
    const slug = this.getCourierSlug(providerCode);
    return `${this.trackingUrl}/${slug}/${trackingNumber}`;
  }

  /**
   * Create tracking in AfterShip
   */
  async createTracking(trackingData) {
    try {
      const { providerCode, trackingNumber, orderData } = trackingData;
      const slug = this.getCourierSlug(providerCode);

      const payload = {
        tracking: {
          slug: slug,
          tracking_number: trackingNumber,
          title: `Order ${orderData.transactionId}`,
          smses: orderData.buyer.phone ? [orderData.buyer.phone] : [],
          emails: orderData.buyer.email ? [orderData.buyer.email] : [],
          order_id: orderData.transactionId,
          order_id_path: `https://yourapp.com/orders/${orderData.orderId}`,
          custom_fields: {
            product_name: orderData.product.title,
            product_price: orderData.product.price,
            buyer_name: orderData.buyer.userName,
            seller_name: orderData.seller.userName
          }
        }
      };

      const response = await axios.post(`${this.baseUrl}/trackings`, payload, {
        headers: {
          'aftership-api-key': this.apiKey,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ AfterShip tracking created:', response.data.data.tracking.id);
      
      return {
        success: true,
        aftershipId: response.data.data.tracking.id,
        trackingUrl: this.generateTrackingUrl(providerCode, trackingNumber),
        data: response.data.data.tracking
      };

    } catch (error) {
      console.error('❌ AfterShip create tracking error:', error.response?.data || error.message);
      
      // Return fallback tracking URL even if AfterShip fails
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        trackingUrl: this.generateTrackingUrl(trackingData.providerCode, trackingData.trackingNumber)
      };
    }
  }

  /**
   * Get tracking information from AfterShip
   */
  async getTracking(slug, trackingNumber) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/trackings/${slug}/${trackingNumber}`,
        {
          headers: {
            'aftership-api-key': this.apiKey
          }
        }
      );

      const tracking = response.data.data.tracking;
      
      return {
        success: true,
        data: {
          id: tracking.id,
          trackingNumber: tracking.tracking_number,
          slug: tracking.slug,
          status: tracking.tag,
          statusDescription: this.getStatusDescription(tracking.tag),
          estimatedDelivery: tracking.expected_delivery,
          checkpoints: tracking.checkpoints.map(checkpoint => ({
            timestamp: new Date(checkpoint.checkpoint_time),
            status: checkpoint.tag,
            description: checkpoint.message,
            location: checkpoint.location,
            countryCode: checkpoint.country_iso3
          })),
          lastUpdate: new Date(tracking.updated_at),
          trackingUrl: `${this.trackingUrl}/${slug}/${trackingNumber}`
        }
      };

    } catch (error) {
      console.error('❌ AfterShip get tracking error:', error.response?.data || error.message);
      
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Update tracking in AfterShip
   */
  async updateTracking(slug, trackingNumber, updateData) {
    try {
      const payload = {
        tracking: updateData
      };

      const response = await axios.put(
        `${this.baseUrl}/trackings/${slug}/${trackingNumber}`,
        payload,
        {
          headers: {
            'aftership-api-key': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ AfterShip tracking updated');
      
      return {
        success: true,
        data: response.data.data.tracking
      };

    } catch (error) {
      console.error('❌ AfterShip update tracking error:', error.response?.data || error.message);
      
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Delete tracking from AfterShip
   */
  async deleteTracking(slug, trackingNumber) {
    try {
      await axios.delete(
        `${this.baseUrl}/trackings/${slug}/${trackingNumber}`,
        {
          headers: {
            'aftership-api-key': this.apiKey
          }
        }
      );

      console.log('✅ AfterShip tracking deleted');
      
      return {
        success: true
      };

    } catch (error) {
      console.error('❌ AfterShip delete tracking error:', error.response?.data || error.message);
      
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Get all supported couriers
   */
  async getCouriers() {
    try {
      const response = await axios.get(`${this.baseUrl}/couriers`, {
        headers: {
          'aftership-api-key': this.apiKey
        }
      });

      return {
        success: true,
        couriers: response.data.data.couriers
      };

    } catch (error) {
      console.error('❌ AfterShip get couriers error:', error.response?.data || error.message);
      
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Handle AfterShip webhook
   */
  async handleWebhook(webhookData) {
    try {
      const { msg } = webhookData;
      
      if (!msg || !msg.tracking) {
        throw new Error('Invalid webhook data');
      }

      const tracking = msg.tracking;
      
      // Extract tracking information
      const trackingInfo = {
        aftershipId: tracking.id,
        trackingNumber: tracking.tracking_number,
        slug: tracking.slug,
        status: tracking.tag,
        statusDescription: this.getStatusDescription(tracking.tag),
        estimatedDelivery: tracking.expected_delivery,
        lastCheckpoint: tracking.checkpoints && tracking.checkpoints.length > 0 
          ? tracking.checkpoints[tracking.checkpoints.length - 1] 
          : null,
        updatedAt: new Date(tracking.updated_at)
      };

      console.log('📨 AfterShip webhook received:', trackingInfo);

      return {
        success: true,
        data: trackingInfo
      };

    } catch (error) {
      console.error('❌ AfterShip webhook error:', error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get status description
   */
  getStatusDescription(tag) {
    const descriptions = {
      'Pending': 'Tracking information pending',
      'InfoReceived': 'Shipping information received',
      'InTransit': 'Package is in transit',
      'OutForDelivery': 'Package is out for delivery',
      'AttemptFail': 'Delivery attempt failed',
      'Delivered': 'Package delivered successfully',
      'Exception': 'Delivery exception occurred',
      'Expired': 'Tracking expired'
    };

    return descriptions[tag] || 'Status unknown';
  }

  /**
   * Map AfterShip status to internal status
   */
  mapAfterShipStatus(tag) {
    const statusMap = {
      'Pending': 'shipped',
      'InfoReceived': 'shipped',
      'InTransit': 'in_transit',
      'OutForDelivery': 'out_for_delivery',
      'AttemptFail': 'exception',
      'Delivered': 'delivered',
      'Exception': 'exception',
      'Expired': 'exception'
    };

    return statusMap[tag] || 'shipped';
  }

  /**
   * Validate AfterShip webhook signature
   */
  validateWebhookSignature(payload, signature, secret) {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    return signature === expectedSignature;
  }

  /**
   * Get tracking page embed code
   */
  getTrackingPageEmbed(slug, trackingNumber, options = {}) {
    const params = new URLSearchParams({
      slug,
      tracking_number: trackingNumber,
      ...options
    });

    return `
      <iframe 
        src="${this.trackingUrl}/embed/${slug}/${trackingNumber}?${params}" 
        width="100%" 
        height="600" 
        frameborder="0">
      </iframe>
    `;
  }

  /**
   * Get tracking widget URL
   */
  getTrackingWidgetUrl(slug, trackingNumber, options = {}) {
    const params = new URLSearchParams({
      ...options
    });

    return `${this.trackingUrl}/${slug}/${trackingNumber}?${params}`;
  }
}

module.exports = new AfterShipService();