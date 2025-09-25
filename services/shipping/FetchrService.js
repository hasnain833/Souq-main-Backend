const BaseShippingService = require('./BaseShippingService');
const axios = require('axios');

class FetchrService extends BaseShippingService {
  constructor(config = {}) {
    super(config);
    this.providerName = 'Fetchr';
    this.baseUrl = config.environment === 'production' 
      ? 'https://api.fetchr.us/v1'
      : 'https://staging-api.fetchr.us/v1';
  }

  async validateConfiguration() {
    const required = ['apiKey', 'secretKey'];
    return required.every(field => this.config.fetchr && this.config.fetchr[field]);
  }

  getServiceCodes() {
    return [
      { code: 'STD', name: 'Standard Delivery', estimatedDays: { min: 2, max: 5 } },
      { code: 'EXP', name: 'Express Delivery', estimatedDays: { min: 1, max: 2 } },
      { code: 'SMD', name: 'Same Day Delivery', estimatedDays: { min: 0, max: 1 } },
      { code: 'COD', name: 'Cash on Delivery', estimatedDays: { min: 2, max: 5 } }
    ];
  }

  async getShippingRates(origin, destination, packageDetails) {
    try {
      const requestData = {
        pickup_address: this.formatFetchrAddress(origin),
        delivery_address: this.formatFetchrAddress(destination),
        package_details: {
          weight: packageDetails.weight || 1,
          length: packageDetails.dimensions?.length || 10,
          width: packageDetails.dimensions?.width || 10,
          height: packageDetails.dimensions?.height || 10,
          value: packageDetails.value || 0,
          currency: packageDetails.currency || 'USD',
          description: packageDetails.description || 'General merchandise'
        }
      };

      const response = await axios.post(`${this.baseUrl}/calculate_shipping`, requestData, {
        headers: {
          'Authorization': `Bearer ${this.config.fetchr.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Rate calculation failed');
      }

      const rates = this.getServiceCodes().map(service => {
        const serviceRate = response.data.rates?.find(r => r.service_code === service.code);
        return {
          serviceCode: service.code,
          serviceName: service.name,
          cost: {
            baseFee: serviceRate?.base_fee || 7, // ~$7 USD equivalent
            fuelSurcharge: serviceRate?.fuel_surcharge || 0,
            total: serviceRate?.total || 7,
            currency: 'USD'
          },
          estimatedDays: service.estimatedDays,
          features: {
            tracking: true,
            insurance: service.code !== 'STD',
            cashOnDelivery: service.code === 'COD',
            signatureRequired: service.code === 'EXP'
          }
        };
      });

      return rates;
    } catch (error) {
      throw this.handleError(error, 'rate calculation');
    }
  }

  async createShipment(shipmentData) {
    try {
      const requestData = {
        pickup_address: this.formatFetchrAddress(shipmentData.origin),
        delivery_address: this.formatFetchrAddress(shipmentData.destination),
        package_details: {
          weight: shipmentData.packages[0]?.weight || 1,
          length: shipmentData.packages[0]?.dimensions?.length || 10,
          width: shipmentData.packages[0]?.dimensions?.width || 10,
          height: shipmentData.packages[0]?.dimensions?.height || 10,
          value: shipmentData.packages[0]?.value || 0,
          currency: shipmentData.packages[0]?.currency || 'AED',
          description: shipmentData.packages[0]?.contents || 'General merchandise'
        },
        service_code: shipmentData.serviceCode || 'STD',
        reference: shipmentData.reference || `FETCHR_${Date.now()}`,
        pickup_date: new Date().toISOString().split('T')[0],
        delivery_instructions: shipmentData.deliveryInstructions || '',
        special_instructions: shipmentData.specialInstructions || ''
      };

      const response = await axios.post(`${this.baseUrl}/create_shipment`, requestData, {
        headers: {
          'Authorization': `Bearer ${this.config.fetchr.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Shipment creation failed');
      }

      const shipment = response.data.shipment;
      return {
        providerShipmentId: shipment.id,
        trackingNumber: shipment.tracking_number,
        trackingUrl: `https://www.fetchr.us/track/${shipment.tracking_number}`,
        labelUrl: shipment.label_url,
        estimatedDelivery: shipment.estimated_delivery ? new Date(shipment.estimated_delivery) : null,
        cost: {
          total: shipment.total_cost || 0,
          currency: 'USD'
        },
        providerData: shipment
      };
    } catch (error) {
      throw this.handleError(error, 'shipment creation');
    }
  }

  async trackShipment(trackingNumber) {
    try {
      const response = await axios.get(`${this.baseUrl}/track/${trackingNumber}`, {
        headers: {
          'Authorization': `Bearer ${this.config.fetchr.apiKey}`
        }
      });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Tracking failed');
      }

      const tracking = response.data.tracking;
      const events = tracking.events?.map(event => ({
        timestamp: new Date(event.timestamp),
        status: this.mapFetchrStatus(event.status),
        description: event.description,
        location: {
          city: event.location?.city,
          country: event.location?.country,
          facility: event.location?.facility
        },
        eventCode: event.status
      })) || [];

      return {
        trackingNumber,
        status: this.mapFetchrStatus(tracking.current_status),
        events,
        estimatedDelivery: tracking.estimated_delivery ? new Date(tracking.estimated_delivery) : null,
        actualDelivery: events.find(e => e.status === 'delivered')?.timestamp,
        providerData: tracking
      };
    } catch (error) {
      throw this.handleError(error, 'tracking');
    }
  }

  async cancelShipment(shipmentId) {
    try {
      const response = await axios.post(`${this.baseUrl}/cancel_shipment`, {
        shipment_id: shipmentId
      }, {
        headers: {
          'Authorization': `Bearer ${this.config.fetchr.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Cancellation failed');
      }

      return {
        success: true,
        message: 'Shipment cancelled successfully',
        cancellationId: response.data.cancellation_id
      };
    } catch (error) {
      throw this.handleError(error, 'cancellation');
    }
  }

  async getShippingLabel(shipmentId, format = 'PDF') {
    try {
      const response = await axios.get(`${this.baseUrl}/shipment/${shipmentId}/label`, {
        headers: {
          'Authorization': `Bearer ${this.config.fetchr.apiKey}`
        },
        params: {
          format: format.toLowerCase()
        }
      });

      return {
        labelUrl: response.data.label_url,
        format: format,
        expiresAt: response.data.expires_at ? new Date(response.data.expires_at) : null
      };
    } catch (error) {
      throw this.handleError(error, 'label generation');
    }
  }

  async validateAddress(address) {
    try {
      const response = await axios.post(`${this.baseUrl}/validate_address`, {
        address: this.formatFetchrAddress(address)
      }, {
        headers: {
          'Authorization': `Bearer ${this.config.fetchr.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        isValid: response.data.valid,
        address: response.data.validated_address || this.formatAddress(address),
        suggestions: response.data.suggestions || []
      };
    } catch (error) {
      // If validation fails, assume address is valid
      return {
        isValid: true,
        address: this.formatAddress(address),
        suggestions: []
      };
    }
  }

  async getDeliveryTimeEstimate(origin, destination, serviceCode) {
    try {
      const response = await axios.post(`${this.baseUrl}/delivery_estimate`, {
        pickup_address: this.formatFetchrAddress(origin),
        delivery_address: this.formatFetchrAddress(destination),
        service_code: serviceCode
      }, {
        headers: {
          'Authorization': `Bearer ${this.config.fetchr.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        estimatedDays: response.data.estimated_days || 3,
        estimatedDelivery: response.data.estimated_delivery ? new Date(response.data.estimated_delivery) : null
      };
    } catch (error) {
      const service = this.getServiceCodes().find(s => s.code === serviceCode);
      return {
        estimatedDays: service?.estimatedDays?.max || 3,
        estimatedDelivery: null
      };
    }
  }

  async schedulePickup(pickupData) {
    try {
      const response = await axios.post(`${this.baseUrl}/schedule_pickup`, {
        pickup_address: this.formatFetchrAddress(pickupData.address),
        pickup_date: pickupData.date,
        pickup_time_slot: pickupData.timeSlot,
        contact_person: pickupData.contactPerson,
        contact_phone: pickupData.contactPhone,
        special_instructions: pickupData.instructions
      }, {
        headers: {
          'Authorization': `Bearer ${this.config.fetchr.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Pickup scheduling failed');
      }

      return {
        pickupId: response.data.pickup_id,
        confirmationNumber: response.data.confirmation_number,
        scheduledDate: new Date(response.data.scheduled_date),
        timeSlot: response.data.time_slot
      };
    } catch (error) {
      throw this.handleError(error, 'pickup scheduling');
    }
  }

  formatFetchrAddress(address) {
    return {
      name: address.name || address.fullName,
      company: address.company || '',
      address_line_1: address.addressLine1,
      address_line_2: address.addressLine2 || '',
      city: address.city,
      state: address.state || '',
      postal_code: address.zipCode,
      country: address.country,
      phone: address.phone || address.phoneNumber || '',
      email: address.email || ''
    };
  }

  mapFetchrStatus(status) {
    const statusMap = {
      'created': 'created',
      'picked_up': 'picked_up',
      'in_transit': 'in_transit',
      'out_for_delivery': 'out_for_delivery',
      'delivered': 'delivered',
      'exception': 'exception',
      'returned': 'returned',
      'cancelled': 'cancelled'
    };
    return statusMap[status] || 'in_transit';
  }
}

module.exports = FetchrService;
