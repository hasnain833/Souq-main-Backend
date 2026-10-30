const BaseShippingService = require('./BaseShippingService');
const axios = require('axios');

class DHLService extends BaseShippingService {
  constructor(config = {}) {
    super(config);
    this.providerName = 'DHL';
    this.baseUrl = config.environment === 'production' 
      ? 'https://api-eu.dhl.com'
      : 'https://api-test.dhl.com';
  }

  async validateConfiguration() {
    const required = ['apiKey', 'secretKey', 'accountNumber'];
    return required.every(field => this.config.dhl && this.config.dhl[field]);
  }

  getServiceCodes() {
    return [
      { code: 'N', name: 'DHL Next Day 12:00', estimatedDays: { min: 1, max: 1 } },
      { code: 'S', name: 'DHL Next Day 10:30', estimatedDays: { min: 1, max: 1 } },
      { code: 'G', name: 'DHL Next Day 9:00', estimatedDays: { min: 1, max: 1 } },
      { code: 'W', name: 'DHL Economy Select', estimatedDays: { min: 2, max: 5 } },
      { code: 'P', name: 'DHL Express Worldwide', estimatedDays: { min: 1, max: 3 } },
      { code: 'U', name: 'DHL Express Worldwide', estimatedDays: { min: 1, max: 3 } }
    ];
  }

  async getShippingRates(origin, destination, packageDetails) {
    try {
      const requestData = {
        customerDetails: {
          shipperDetails: this.formatDHLAddress(origin),
          receiverDetails: this.formatDHLAddress(destination)
        },
        accounts: [{
          typeCode: "shipper",
          number: this.config.dhl.accountNumber
        }],
        productCode: "P", // Express Worldwide
        localProductCode: "P",
        valueAddedServices: [],
        outputImageProperties: {
          imageOptions: [{
            typeCode: "label",
            templateName: "ECOM26_84_001",
            isRequested: false
          }]
        },
        packages: [{
          typeCode: "2BP", // Your packaging
          weight: packageDetails.weight || 1,
          dimensions: {
            length: packageDetails.dimensions?.length || 10,
            width: packageDetails.dimensions?.width || 10,
            height: packageDetails.dimensions?.height || 10
          }
        }],
        plannedShippingDateAndTime: new Date().toISOString(),
        unitOfMeasurement: "metric",
        isCustomsDeclarable: false,
        monetaryAmount: [{
          typeCode: "declared",
          value: packageDetails.value || 0,
          currency: packageDetails.currency || "USD"
        }],
        requestAllValueAddedServices: false,
        returnStandardProductsOnly: false,
        nextBusinessDay: false
      };

      const response = await axios.post(`${this.baseUrl}/mydhlapi/rates`, requestData, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.config.dhl.apiKey}:${this.config.dhl.secretKey}`).toString('base64')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.data.products) {
        throw new Error('No rates returned from DHL');
      }

      const rates = response.data.products.map(product => ({
        serviceCode: product.productCode,
        serviceName: product.productName,
        cost: {
          baseFee: product.totalPrice?.[0]?.price || 0,
          currency: product.totalPrice?.[0]?.currencyType || 'USD',
          total: product.totalPrice?.[0]?.price || 0
        },
        estimatedDays: {
          min: 1,
          max: product.deliveryCapabilities?.deliveryTypeCode === 'QDDC' ? 1 : 3
        },
        features: {
          tracking: true,
          insurance: true,
          signatureRequired: true
        },
        estimatedDelivery: product.deliveryCapabilities?.estimatedDeliveryDateAndTime ? 
          new Date(product.deliveryCapabilities.estimatedDeliveryDateAndTime) : null
      }));

      return rates;
    } catch (error) {
      throw this.handleError(error, 'rate calculation');
    }
  }

  async createShipment(shipmentData) {
    try {
      const requestData = {
        plannedShippingDateAndTime: new Date().toISOString(),
        pickup: {
          isRequested: false
        },
        productCode: shipmentData.serviceCode || "P",
        localProductCode: shipmentData.serviceCode || "P",
        accounts: [{
          typeCode: "shipper",
          number: this.config.dhl.accountNumber
        }],
        customerDetails: {
          shipperDetails: this.formatDHLAddress(shipmentData.origin),
          receiverDetails: this.formatDHLAddress(shipmentData.destination)
        },
        content: {
          packages: [{
            typeCode: "2BP",
            weight: shipmentData.packages[0]?.weight || 1,
            dimensions: {
              length: shipmentData.packages[0]?.dimensions?.length || 10,
              width: shipmentData.packages[0]?.dimensions?.width || 10,
              height: shipmentData.packages[0]?.dimensions?.height || 10
            },
            customerReferences: [{
              value: shipmentData.reference || `DHL_${Date.now()}`,
              typeCode: "CU"
            }]
          }],
          isCustomsDeclarable: false,
          declaredValue: shipmentData.packages[0]?.value || 0,
          declaredValueCurrency: shipmentData.packages[0]?.currency || "USD",
          exportDeclaration: {
            lineItems: [{
              number: 1,
              description: shipmentData.packages[0]?.contents || "General merchandise",
              price: shipmentData.packages[0]?.value || 0,
              quantity: {
                value: 1,
                unitOfMeasurement: "PCS"
              },
              commodityCodes: [{
                typeCode: "outbound",
                value: "851713"
              }],
              exportReasonType: "permanent",
              manufacturerCountry: "AE",
              weight: {
                netValue: shipmentData.packages[0]?.weight || 1,
                grossValue: shipmentData.packages[0]?.weight || 1
              }
            }],
            invoice: {
              number: `INV_${Date.now()}`,
              date: new Date().toISOString().split('T')[0]
            },
            exportReason: "Sale"
          },
          description: shipmentData.packages[0]?.contents || "General merchandise",
          incoterms: "DAP",
          unitOfMeasurement: "metric"
        },
        outputImageProperties: {
          imageOptions: [{
            typeCode: "label",
            templateName: "ECOM26_84_001",
            isRequested: true
          }]
        }
      };

      const response = await axios.post(`${this.baseUrl}/mydhlapi/shipments`, requestData, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.config.dhl.apiKey}:${this.config.dhl.secretKey}`).toString('base64')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.data.shipmentTrackingNumber) {
        throw new Error('Shipment creation failed - no tracking number returned');
      }

      return {
        providerShipmentId: response.data.shipmentTrackingNumber,
        trackingNumber: response.data.shipmentTrackingNumber,
        trackingUrl: `https://www.dhl.com/track?AWB=${response.data.shipmentTrackingNumber}`,
        labelUrl: response.data.documents?.[0]?.imageBase64 ? 
          `data:application/pdf;base64,${response.data.documents[0].imageBase64}` : null,
        estimatedDelivery: response.data.estimatedDeliveryDate ? 
          new Date(response.data.estimatedDeliveryDate) : null,
        cost: {
          total: response.data.shipmentCharges?.[0]?.price || 0,
          currency: response.data.shipmentCharges?.[0]?.currencyType || 'AED'
        },
        providerData: response.data
      };
    } catch (error) {
      throw this.handleError(error, 'shipment creation');
    }
  }

  async trackShipment(trackingNumber) {
    try {
      const response = await axios.get(`${this.baseUrl}/mydhlapi/track/shipments`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.config.dhl.apiKey}:${this.config.dhl.secretKey}`).toString('base64')}`
        },
        params: {
          shipmentTrackingNumber: trackingNumber
        }
      });

      if (!response.data.shipments || response.data.shipments.length === 0) {
        throw new Error('No tracking data found');
      }

      const shipment = response.data.shipments[0];
      const events = shipment.events?.map(event => ({
        timestamp: new Date(event.timestamp),
        status: this.mapDHLStatus(event.statusCode),
        description: event.description,
        location: {
          city: event.location?.address?.addressLocality,
          country: event.location?.address?.countryCode,
          facility: event.serviceArea?.description
        },
        eventCode: event.statusCode
      })) || [];

      return {
        trackingNumber,
        status: this.mapDHLStatus(shipment.status?.statusCode),
        events,
        estimatedDelivery: shipment.estimatedTimeOfDelivery ? 
          new Date(shipment.estimatedTimeOfDelivery) : null,
        actualDelivery: events.find(e => e.status === 'delivered')?.timestamp,
        providerData: shipment
      };
    } catch (error) {
      throw this.handleError(error, 'tracking');
    }
  }

  async cancelShipment(shipmentId) {
    try {
      const response = await axios.delete(`${this.baseUrl}/mydhlapi/shipments/${shipmentId}`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.config.dhl.apiKey}:${this.config.dhl.secretKey}`).toString('base64')}`
        }
      });

      return {
        success: true,
        message: 'Shipment cancelled successfully',
        cancellationId: response.data.cancellationRequestId
      };
    } catch (error) {
      throw this.handleError(error, 'cancellation');
    }
  }

  async getShippingLabel(shipmentId, format = 'PDF') {
    // Labels are provided during shipment creation in DHL
    throw new Error('Use label data from shipment creation response');
  }

  async validateAddress(address) {
    try {
      const response = await axios.get(`${this.baseUrl}/mydhlapi/address-validate`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.config.dhl.apiKey}:${this.config.dhl.secretKey}`).toString('base64')}`
        },
        params: {
          type: 'delivery',
          countryCode: this.getCountryCode(address.country),
          postalCode: address.zipCode,
          cityName: address.city
        }
      });

      return {
        isValid: response.data.warnings?.length === 0,
        address: this.formatAddress(address),
        suggestions: response.data.suggestions || []
      };
    } catch (error) {
      return {
        isValid: true,
        address: this.formatAddress(address),
        suggestions: []
      };
    }
  }

  formatDHLAddress(address) {
    return {
      postalAddress: {
        postalCode: address.zipCode,
        cityName: address.city,
        countryCode: this.getCountryCode(address.country),
        provinceCode: address.state,
        addressLine1: address.street1,
        addressLine2: address.street2,
        addressLine3: ""
      },
      contactInformation: {
        phone: address.phone || address.phoneNumber || "",
        companyName: address.company || "",
        fullName: address.name || address.fullName || "",
        email: address.email || ""
      }
    };
  }

  getCountryCode(country) {
    const countryCodes = {
      'United Arab Emirates': 'AE',
      'Saudi Arabia': 'SA',
      'Kuwait': 'KW',
      'Qatar': 'QA',
      'Bahrain': 'BH',
      'Oman': 'OM',
      'United States': 'US',
      'United Kingdom': 'GB',
      'Germany': 'DE',
      'France': 'FR'
    };
    return countryCodes[country] || 'AE';
  }

  mapDHLStatus(statusCode) {
    const statusMap = {
      'pre-transit': 'created',
      'transit': 'in_transit',
      'delivered': 'delivered',
      'returned': 'returned',
      'failure': 'exception'
    };
    return statusMap[statusCode] || 'in_transit';
  }
}

module.exports = DHLService;
