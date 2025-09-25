const axios = require('axios');

class UAEShippingService {
  constructor() {
    this.providers = {
      emirates_post: {
        name: 'Emirates Post',
        trackingUrl: 'https://www.epg.gov.ae/en/track-and-trace',
        apiUrl: 'https://api.epg.gov.ae/tracking',
        website: 'https://www.epg.gov.ae',
        contact: '+971-600-599-999'
      },
      aramex: {
        name: 'Aramex',
        trackingUrl: 'https://www.aramex.com/track/results',
        apiUrl: 'https://ws.aramex.net/ShippingAPI.V2/Tracking/Service_1_0.svc/json/TrackShipments',
        website: 'https://www.aramex.com',
        contact: '+971-600-544-000'
      },
      dhl: {
        name: 'DHL Express',
        trackingUrl: 'https://www.dhl.com/ae-en/home/tracking.html',
        apiUrl: 'https://api-eu.dhl.com/track/shipments',
        website: 'https://www.dhl.com/ae-en',
        contact: '+971-800-4004'
      },
      fedex: {
        name: 'FedEx',
        trackingUrl: 'https://www.fedex.com/apps/fedextrack/',
        apiUrl: 'https://api.fedex.com/track/v1/trackingnumbers',
        website: 'https://www.fedex.com/ae',
        contact: '+971-800-4050'
      },
      ups: {
        name: 'UPS',
        trackingUrl: 'https://www.ups.com/track',
        apiUrl: 'https://onlinetools.ups.com/track/v1/details',
        website: 'https://www.ups.com/ae',
        contact: '+971-800-877'
      },
      smsa: {
        name: 'SMSA Express',
        trackingUrl: 'https://www.smsaexpress.com/tracking/',
        apiUrl: 'https://api.smsaexpress.com/tracking',
        website: 'https://www.smsaexpress.com',
        contact: '+971-800-7672'
      },
      naqel: {
        name: 'Naqel Express',
        trackingUrl: 'https://www.naqelexpress.com/track',
        apiUrl: 'https://api.naqelexpress.com/tracking',
        website: 'https://www.naqelexpress.com',
        contact: '+971-800-62735'
      },
      zajil: {
        name: 'Zajil Express',
        trackingUrl: 'https://www.zajil.com/track',
        apiUrl: 'https://api.zajil.com/tracking',
        website: 'https://www.zajil.com',
        contact: '+971-800-92445'
      }
    };
  }

  /**
   * Get provider information
   */
  getProvider(providerCode) {
    return this.providers[providerCode] || null;
  }

  /**
   * Get all available providers
   */
  getAllProviders() {
    return Object.keys(this.providers).map(code => ({
      code,
      ...this.providers[code]
    }));
  }

  /**
   * Generate tracking URL for a provider
   */
  generateTrackingUrl(providerCode, trackingNumber) {
    const provider = this.getProvider(providerCode);
    if (!provider) {
      throw new Error(`Unknown provider: ${providerCode}`);
    }

    // Generate provider-specific tracking URL
    switch (providerCode) {
      case 'emirates_post':
        return `${provider.trackingUrl}?trackingNumber=${trackingNumber}`;
      
      case 'aramex':
        return `${provider.trackingUrl}?ShipmentNumber=${trackingNumber}`;
      
      case 'dhl':
        return `${provider.trackingUrl}?tracking-id=${trackingNumber}`;
      
      case 'fedex':
        return `${provider.trackingUrl}?trknbr=${trackingNumber}`;
      
      case 'ups':
        return `${provider.trackingUrl}?tracknum=${trackingNumber}`;
      
      case 'smsa':
        return `${provider.trackingUrl}${trackingNumber}`;
      
      case 'naqel':
        return `${provider.trackingUrl}/${trackingNumber}`;
      
      case 'zajil':
        return `${provider.trackingUrl}/${trackingNumber}`;
      
      default:
        return `${provider.trackingUrl}?tracking=${trackingNumber}`;
    }
  }

  /**
   * Create shipment with provider (if API is available)
   */
  async createShipment(providerCode, shipmentData) {
    const provider = this.getProvider(providerCode);
    if (!provider) {
      throw new Error(`Unknown provider: ${providerCode}`);
    }

    try {
      // This would integrate with actual provider APIs
      // For now, we'll simulate the response
      const mockResponse = {
        success: true,
        trackingNumber: this.generateTrackingNumber(providerCode),
        shipmentId: `SHIP_${Date.now()}`,
        estimatedDelivery: this.calculateEstimatedDelivery(providerCode),
        shippingLabel: `https://labels.${providerCode}.com/label_${Date.now()}.pdf`,
        cost: this.calculateShippingCost(providerCode, shipmentData)
      };

      console.log(`📦 Created shipment with ${provider.name}:`, mockResponse);
      return mockResponse;

    } catch (error) {
      console.error(`❌ Error creating shipment with ${provider.name}:`, error);
      throw new Error(`Failed to create shipment with ${provider.name}: ${error.message}`);
    }
  }

  /**
   * Track shipment with provider API
   */
  async trackShipment(providerCode, trackingNumber) {
    const provider = this.getProvider(providerCode);
    if (!provider) {
      throw new Error(`Unknown provider: ${providerCode}`);
    }

    try {
      // This would integrate with actual provider tracking APIs
      // For now, we'll simulate tracking data
      const mockTrackingData = {
        trackingNumber,
        status: 'in_transit',
        statusDescription: 'Package is in transit',
        estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
        events: [
          {
            timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
            status: 'shipped',
            description: 'Package shipped from origin facility',
            location: 'Dubai, UAE'
          },
          {
            timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
            status: 'in_transit',
            description: 'Package in transit to destination',
            location: 'Abu Dhabi, UAE'
          }
        ]
      };

      console.log(`🔍 Tracked shipment with ${provider.name}:`, trackingNumber);
      return mockTrackingData;

    } catch (error) {
      console.error(`❌ Error tracking shipment with ${provider.name}:`, error);
      throw new Error(`Failed to track shipment with ${provider.name}: ${error.message}`);
    }
  }

  /**
   * Generate tracking number for provider
   */
  generateTrackingNumber(providerCode) {
    const prefixes = {
      emirates_post: 'EP',
      aramex: 'ARX',
      dhl: 'DHL',
      fedex: 'FDX',
      ups: 'UPS',
      smsa: 'SMS',
      naqel: 'NQL',
      zajil: 'ZJL'
    };

    const prefix = prefixes[providerCode] || 'TRK';
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    
    return `${prefix}${timestamp}${random}`;
  }

  /**
   * Calculate estimated delivery date
   */
  calculateEstimatedDelivery(providerCode) {
    const deliveryDays = {
      emirates_post: 3,
      aramex: 2,
      dhl: 1,
      fedex: 1,
      ups: 2,
      smsa: 2,
      naqel: 3,
      zajil: 2
    };

    const days = deliveryDays[providerCode] || 3;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  /**
   * Calculate shipping cost
   */
  calculateShippingCost(providerCode, shipmentData) {
    const baseCosts = {
      emirates_post: 15,
      aramex: 25,
      dhl: 45,
      fedex: 50,
      ups: 40,
      smsa: 20,
      naqel: 18,
      zajil: 22
    };

    const baseCost = baseCosts[providerCode] || 20;
    const weight = shipmentData.weight || 1;
    const weightCost = weight > 1 ? (weight - 1) * 5 : 0;
    
    return {
      baseFee: baseCost,
      weightFee: weightCost,
      total: baseCost + weightCost,
      currency: 'AED'
    };
  }

  /**
   * Get shipping options for a destination
   */
  getShippingOptions(destination) {
    const isLocal = destination.country === 'UAE' || destination.country === 'United Arab Emirates';
    
    if (isLocal) {
      // Local UAE shipping options
      return [
        {
          provider: 'emirates_post',
          name: 'Emirates Post Standard',
          estimatedDays: 3,
          cost: 15,
          currency: 'AED'
        },
        {
          provider: 'aramex',
          name: 'Aramex Express',
          estimatedDays: 2,
          cost: 25,
          currency: 'AED'
        },
        {
          provider: 'smsa',
          name: 'SMSA Express',
          estimatedDays: 2,
          cost: 20,
          currency: 'AED'
        },
        {
          provider: 'naqel',
          name: 'Naqel Standard',
          estimatedDays: 3,
          cost: 18,
          currency: 'AED'
        }
      ];
    } else {
      // International shipping options
      return [
        {
          provider: 'dhl',
          name: 'DHL Express International',
          estimatedDays: 3,
          cost: 120,
          currency: 'AED'
        },
        {
          provider: 'fedex',
          name: 'FedEx International Priority',
          estimatedDays: 2,
          cost: 150,
          currency: 'AED'
        },
        {
          provider: 'aramex',
          name: 'Aramex International',
          estimatedDays: 5,
          cost: 80,
          currency: 'AED'
        }
      ];
    }
  }

  /**
   * Validate tracking number format
   */
  validateTrackingNumber(providerCode, trackingNumber) {
    if (!trackingNumber || trackingNumber.length < 5) {
      return false;
    }

    // Provider-specific validation patterns
    const patterns = {
      emirates_post: /^EP\d{8}[A-Z]{4}$/,
      aramex: /^ARX\d{8}[A-Z]{4}$/,
      dhl: /^\d{10,11}$/,
      fedex: /^\d{12,14}$/,
      ups: /^1Z[A-Z0-9]{16}$/,
      smsa: /^SMS\d{8}[A-Z]{4}$/,
      naqel: /^NQL\d{8}[A-Z]{4}$/,
      zajil: /^ZJL\d{8}[A-Z]{4}$/
    };

    const pattern = patterns[providerCode];
    if (pattern) {
      return pattern.test(trackingNumber);
    }

    // Generic validation for unknown providers
    return trackingNumber.length >= 5 && trackingNumber.length <= 30;
  }
}

module.exports = new UAEShippingService();