const BaseShippingService = require('./BaseShippingService');

class LocalDeliveryService extends BaseShippingService {
  constructor(config = {}) {
    super(config);
    this.providerName = 'Local Delivery';
    this.isConfigured = true; // Local delivery doesn't need external configuration
  }

  async validateConfiguration() {
    return true; // Local delivery is always available
  }

  getServiceCodes() {
    return [
      { code: 'LOCAL_PICKUP', name: 'Local Pickup', estimatedDays: { min: 0, max: 1 } },
      { code: 'LOCAL_DROPOFF', name: 'Drop-off Point', estimatedDays: { min: 0, max: 1 } },
      { code: 'LOCAL_DELIVERY', name: 'Local Delivery', estimatedDays: { min: 0, max: 2 } }
    ];
  }

  async getShippingRates(origin, destination, packageDetails) {
    try {
      // Calculate distance between origin and destination
      const distance = this.calculateDistance(origin, destination);
      
      const rates = this.getServiceCodes().map(service => {
        let cost = 0;
        
        switch (service.code) {
          case 'LOCAL_PICKUP':
            cost = 0; // Free pickup
            break;
          case 'LOCAL_DROPOFF':
            cost = 5; // Small fee for drop-off point
            break;
          case 'LOCAL_DELIVERY':
            cost = Math.max(3, distance * 0.5); // Base $3 USD + $0.5 per km
            break;
        }

        return {
          serviceCode: service.code,
          serviceName: service.name,
          cost: {
            baseFee: cost,
            currency: 'USD',
            total: cost
          },
          estimatedDays: service.estimatedDays,
          features: {
            tracking: true,
            insurance: false,
            cashOnDelivery: service.code === 'LOCAL_DELIVERY',
            signatureRequired: false
          },
          distance: distance,
          isAvailable: distance <= 50 // Available within 50km radius
        };
      });

      return rates.filter(rate => rate.isAvailable);
    } catch (error) {
      throw this.handleError(error, 'rate calculation');
    }
  }

  async createShipment(shipmentData) {
    try {
      const trackingNumber = `LOCAL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      return {
        providerShipmentId: trackingNumber,
        trackingNumber: trackingNumber,
        trackingUrl: `/track/${trackingNumber}`,
        labelUrl: null, // No label needed for local delivery
        estimatedDelivery: this.calculateEstimatedDelivery(shipmentData.serviceCode),
        cost: {
          total: this.calculateLocalCost(shipmentData),
          currency: 'AED'
        },
        providerData: {
          serviceCode: shipmentData.serviceCode,
          origin: shipmentData.origin,
          destination: shipmentData.destination,
          createdAt: new Date()
        }
      };
    } catch (error) {
      throw this.handleError(error, 'shipment creation');
    }
  }

  async trackShipment(trackingNumber) {
    try {
      // For local delivery, we'll simulate tracking based on time elapsed
      const createdTime = this.extractTimeFromTrackingNumber(trackingNumber);
      const now = new Date();
      const hoursElapsed = (now - createdTime) / (1000 * 60 * 60);
      
      let status = 'created';
      const events = [{
        timestamp: createdTime,
        status: 'created',
        description: 'Local delivery order created',
        location: { city: 'Local', country: 'AE' },
        eventCode: 'CREATED'
      }];

      if (hoursElapsed > 1) {
        status = 'picked_up';
        events.push({
          timestamp: new Date(createdTime.getTime() + 60 * 60 * 1000),
          status: 'picked_up',
          description: 'Package picked up for local delivery',
          location: { city: 'Local', country: 'AE' },
          eventCode: 'PICKED_UP'
        });
      }

      if (hoursElapsed > 2) {
        status = 'out_for_delivery';
        events.push({
          timestamp: new Date(createdTime.getTime() + 2 * 60 * 60 * 1000),
          status: 'out_for_delivery',
          description: 'Out for local delivery',
          location: { city: 'Local', country: 'AE' },
          eventCode: 'OUT_FOR_DELIVERY'
        });
      }

      if (hoursElapsed > 24) {
        status = 'delivered';
        events.push({
          timestamp: new Date(createdTime.getTime() + 24 * 60 * 60 * 1000),
          status: 'delivered',
          description: 'Package delivered locally',
          location: { city: 'Local', country: 'AE' },
          eventCode: 'DELIVERED'
        });
      }

      return {
        trackingNumber,
        status,
        events,
        estimatedDelivery: new Date(createdTime.getTime() + 24 * 60 * 60 * 1000),
        actualDelivery: status === 'delivered' ? events[events.length - 1].timestamp : null,
        providerData: { hoursElapsed, createdTime }
      };
    } catch (error) {
      throw this.handleError(error, 'tracking');
    }
  }

  async cancelShipment(shipmentId) {
    try {
      return {
        success: true,
        message: 'Local delivery cancelled successfully',
        cancellationId: `CANCEL_${Date.now()}`
      };
    } catch (error) {
      throw this.handleError(error, 'cancellation');
    }
  }

  async getShippingLabel(shipmentId, format = 'PDF') {
    // Local delivery doesn't require shipping labels
    return {
      message: 'No shipping label required for local delivery',
      labelUrl: null
    };
  }

  async validateAddress(address) {
    // For local delivery, we just check if it's within service area
    const isLocal = this.isWithinServiceArea(address);
    
    return {
      isValid: isLocal,
      address: this.formatAddress(address),
      suggestions: isLocal ? [] : ['Address is outside local delivery area']
    };
  }

  async getDeliveryTimeEstimate(origin, destination, serviceCode) {
    const distance = this.calculateDistance(origin, destination);
    
    let estimatedHours = 24; // Default 24 hours
    
    switch (serviceCode) {
      case 'LOCAL_PICKUP':
        estimatedHours = 2; // 2 hours for pickup
        break;
      case 'LOCAL_DROPOFF':
        estimatedHours = 1; // 1 hour for drop-off
        break;
      case 'LOCAL_DELIVERY':
        estimatedHours = distance < 10 ? 4 : 24; // Same day if < 10km
        break;
    }

    return {
      estimatedHours,
      estimatedDelivery: new Date(Date.now() + estimatedHours * 60 * 60 * 1000)
    };
  }

  async schedulePickup(pickupData) {
    try {
      const pickupId = `PICKUP_${Date.now()}`;
      
      return {
        pickupId,
        confirmationNumber: pickupId,
        scheduledDate: new Date(pickupData.date),
        timeSlot: pickupData.timeSlot || '09:00-17:00',
        instructions: 'Local pickup scheduled. Please have package ready.'
      };
    } catch (error) {
      throw this.handleError(error, 'pickup scheduling');
    }
  }

  // Helper methods
  calculateDistance(origin, destination) {
    // Simple distance calculation (in reality, you'd use a proper geocoding service)
    // For demo purposes, return a random distance between 1-30 km
    return Math.floor(Math.random() * 30) + 1;
  }

  calculateLocalCost(shipmentData) {
    const distance = this.calculateDistance(shipmentData.origin, shipmentData.destination);
    
    switch (shipmentData.serviceCode) {
      case 'LOCAL_PICKUP':
        return 0;
      case 'LOCAL_DROPOFF':
        return 5;
      case 'LOCAL_DELIVERY':
        return Math.max(10, distance * 2);
      default:
        return 10;
    }
  }

  calculateEstimatedDelivery(serviceCode) {
    const now = new Date();
    
    switch (serviceCode) {
      case 'LOCAL_PICKUP':
        return new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours
      case 'LOCAL_DROPOFF':
        return new Date(now.getTime() + 1 * 60 * 60 * 1000); // 1 hour
      case 'LOCAL_DELIVERY':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
      default:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }
  }

  extractTimeFromTrackingNumber(trackingNumber) {
    try {
      const timestamp = trackingNumber.split('_')[1];
      return new Date(parseInt(timestamp));
    } catch (error) {
      return new Date(); // Fallback to current time
    }
  }

  isWithinServiceArea(address) {
    // For demo purposes, assume all addresses in UAE are within service area
    const localCountries = ['United Arab Emirates', 'UAE', 'AE'];
    return localCountries.some(country => 
      address.country?.toLowerCase().includes(country.toLowerCase())
    );
  }
}

module.exports = LocalDeliveryService;
