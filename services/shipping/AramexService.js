const BaseShippingService = require('./BaseShippingService');
const axios = require('axios');

class AramexService extends BaseShippingService {
  constructor(config = {}) {
    super(config);
    this.providerName = 'Aramex';
    this.baseUrl = config.environment === 'production' 
      ? 'https://ws.aramex.net/ShippingAPI.V2'
      : 'https://ws.dev.aramex.net/ShippingAPI.V2';
  }

  async validateConfiguration() {
    const required = ['username', 'password', 'accountNumber', 'accountPin', 'accountEntity', 'accountCountryCode'];
    return required.every(field => this.config.aramex && this.config.aramex[field]);
  }

  getServiceCodes() {
    return [
      { code: 'PDX', name: 'Priority Document Express', estimatedDays: { min: 1, max: 3 } },
      { code: 'PPX', name: 'Priority Parcel Express', estimatedDays: { min: 1, max: 3 } },
      { code: 'GDX', name: 'Ground Document Express', estimatedDays: { min: 2, max: 5 } },
      { code: 'GPX', name: 'Ground Parcel Express', estimatedDays: { min: 2, max: 5 } }
    ];
  }

  async getShippingRates(origin, destination, packageDetails) {
    try {
      const requestData = {
        ClientInfo: this.getClientInfo(),
        Transaction: {
          Reference1: `RATE_${Date.now()}`,
          Reference2: '',
          Reference3: '',
          Reference4: '',
          Reference5: ''
        },
        OriginAddress: this.formatAramexAddress(origin),
        DestinationAddress: this.formatAramexAddress(destination),
        ShipmentDetails: {
          Dimensions: {
            Length: packageDetails.dimensions?.length || 10,
            Width: packageDetails.dimensions?.width || 10,
            Height: packageDetails.dimensions?.height || 10,
            Unit: 'cm'
          },
          ActualWeight: {
            Value: packageDetails.weight || 1,
            Unit: 'kg'
          },
          ChargeableWeight: {
            Value: packageDetails.weight || 1,
            Unit: 'kg'
          },
          DescriptionOfGoods: packageDetails.description || 'General merchandise',
          GoodsOriginCountry: origin.country || 'AE',
          NumberOfPieces: 1,
          ProductGroup: 'EXP',
          ProductType: 'PPX',
          PaymentType: 'P',
          PaymentOptions: '',
          Services: '',
          CashOnDeliveryAmount: {
            Value: 0,
            CurrencyCode: 'AED'
          },
          InsuranceAmount: {
            Value: 0,
            CurrencyCode: 'USD'
          },
          CollectAmount: {
            Value: 0,
            CurrencyCode: 'USD'
          },
          CashAdditionalAmount: {
            Value: 0,
            CurrencyCode: 'USD'
          },
          CashAdditionalAmountDescription: '',
          CustomsValueAmount: {
            Value: packageDetails.value || 0,
            CurrencyCode: packageDetails.currency || 'USD'
          }
        },
        PreferredCurrencyCode: 'USD'
      };

      const response = await axios.post(`${this.baseUrl}/Service_1_0.svc/json/CalculateRate`, requestData, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data.HasErrors) {
        throw new Error(response.data.Notifications?.[0]?.Message || 'Rate calculation failed');
      }

      const rates = this.getServiceCodes().map(service => ({
        serviceCode: service.code,
        serviceName: service.name,
        cost: {
          baseFee: response.data.TotalAmount?.Value || 0,
          currency: response.data.TotalAmount?.CurrencyCode || 'USD',
          total: response.data.TotalAmount?.Value || 0
        },
        estimatedDays: service.estimatedDays,
        features: {
          tracking: true,
          insurance: false,
          signatureRequired: false
        }
      }));

      return rates;
    } catch (error) {
      throw this.handleError(error, 'rate calculation');
    }
  }

  async createShipment(shipmentData) {
    try {
      const requestData = {
        ClientInfo: this.getClientInfo(),
        LabelInfo: {
          ReportID: 9201,
          ReportType: 'URL'
        },
        Shipments: [{
          Reference1: shipmentData.reference || `SHIP_${Date.now()}`,
          Reference2: '',
          Reference3: '',
          Shipper: this.formatAramexAddress(shipmentData.origin),
          Consignee: this.formatAramexAddress(shipmentData.destination),
          ShippingDateTime: new Date().toISOString(),
          DueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          Comments: shipmentData.description || '',
          PickupLocation: 'Reception',
          OperationsInstructions: '',
          AccountingInstrcutions: '',
          Details: {
            Dimensions: {
              Length: shipmentData.packages[0]?.dimensions?.length || 10,
              Width: shipmentData.packages[0]?.dimensions?.width || 10,
              Height: shipmentData.packages[0]?.dimensions?.height || 10,
              Unit: 'cm'
            },
            ActualWeight: {
              Value: shipmentData.packages[0]?.weight || 1,
              Unit: 'kg'
            },
            ProductGroup: 'EXP',
            ProductType: shipmentData.serviceCode || 'PPX',
            PaymentType: 'P',
            PaymentOptions: '',
            DescriptionOfGoods: shipmentData.packages[0]?.contents || 'General merchandise',
            GoodsOriginCountry: shipmentData.origin.country || 'AE',
            NumberOfPieces: shipmentData.packages?.length || 1,
            Services: '',
            CashOnDeliveryAmount: {
              Value: 0,
              CurrencyCode: 'USD'
            },
            InsuranceAmount: {
              Value: 0,
              CurrencyCode: 'USD'
            },
            CustomsValueAmount: {
              Value: shipmentData.packages[0]?.value || 0,
              CurrencyCode: shipmentData.packages[0]?.currency || 'USD'
            }
          }
        }]
      };

      const response = await axios.post(`${this.baseUrl}/Service_1_0.svc/json/CreateShipments`, requestData, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data.HasErrors) {
        throw new Error(response.data.Notifications?.[0]?.Message || 'Shipment creation failed');
      }

      const shipment = response.data.Shipments?.[0];
      if (!shipment) {
        throw new Error('No shipment data returned');
      }

      return {
        providerShipmentId: shipment.ID,
        trackingNumber: shipment.ForeignHAWB,
        trackingUrl: `https://www.aramex.com/track/results?ShipmentNumber=${shipment.ForeignHAWB}`,
        labelUrl: shipment.ShipmentLabel?.LabelURL,
        estimatedDelivery: null,
        cost: {
          total: shipment.ShipmentCharges?.TotalAmount || 0,
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
      const requestData = {
        ClientInfo: this.getClientInfo(),
        GetLastTrackingUpdateOnly: false,
        ShipmentNumber: trackingNumber,
        Transaction: {
          Reference1: `TRACK_${Date.now()}`,
          Reference2: '',
          Reference3: '',
          Reference4: '',
          Reference5: ''
        }
      };

      const response = await axios.post(`${this.baseUrl}/Service_1_0.svc/json/TrackShipments`, requestData, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data.HasErrors) {
        throw new Error(response.data.Notifications?.[0]?.Message || 'Tracking failed');
      }

      const trackingResult = response.data.TrackingResults?.[0];
      if (!trackingResult) {
        throw new Error('No tracking data found');
      }

      const events = trackingResult.TrackingUpdateDetails?.map(update => ({
        timestamp: new Date(update.UpdateDateTime),
        status: this.mapAramexStatus(update.UpdateCode),
        description: update.UpdateDescription,
        location: {
          city: update.UpdateLocation,
          country: update.Comments
        },
        eventCode: update.UpdateCode
      })) || [];

      return {
        trackingNumber,
        status: this.mapAramexStatus(trackingResult.TrackingUpdateDetails?.[0]?.UpdateCode),
        events,
        estimatedDelivery: null,
        actualDelivery: events.find(e => e.status === 'delivered')?.timestamp,
        providerData: trackingResult
      };
    } catch (error) {
      throw this.handleError(error, 'tracking');
    }
  }

  async cancelShipment(shipmentId) {
    // Aramex doesn't provide a direct cancel API, return not supported
    throw new Error('Shipment cancellation not supported by Aramex API');
  }

  async getShippingLabel(shipmentId, format = 'PDF') {
    // Labels are provided during shipment creation in Aramex
    throw new Error('Use label URL from shipment creation response');
  }

  async validateAddress(address) {
    // Aramex doesn't provide address validation API
    return {
      isValid: true,
      address: this.formatAddress(address),
      suggestions: []
    };
  }

  getClientInfo() {
    return {
      UserName: this.config.aramex.username,
      Password: this.config.aramex.password,
      Version: this.config.aramex.version || 'v1.0',
      AccountNumber: this.config.aramex.accountNumber,
      AccountPin: this.config.aramex.accountPin,
      AccountEntity: this.config.aramex.accountEntity,
      AccountCountryCode: this.config.aramex.accountCountryCode,
      Source: 24
    };
  }

  formatAramexAddress(address) {
    return {
      Line1: address.street1,
      Line2: address.street2 || '',
      Line3: '',
      City: address.city,
      StateOrProvinceCode: address.state || '',
      PostCode: address.zipCode,
      CountryCode: this.getCountryCode(address.country),
      Longitude: 0,
      Latitude: 0,
      BuildingNumber: '',
      BuildingName: '',
      Floor: '',
      Apartment: '',
      POBox: '',
      Description: '',
      ContactInfo: {
        PersonName: address.name || address.fullName,
        CompanyName: address.company || '',
        PhoneNumber1: address.phone || address.phoneNumber || '',
        PhoneNumber1Ext: '',
        PhoneNumber2: '',
        PhoneNumber2Ext: '',
        FaxNumber: '',
        CellPhone: address.phone || address.phoneNumber || '',
        EmailAddress: address.email || '',
        Type: ''
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
      'United Kingdom': 'GB'
    };
    return countryCodes[country] || 'AE';
  }

  mapAramexStatus(updateCode) {
    const statusMap = {
      'SH001': 'picked_up',
      'SH002': 'in_transit',
      'SH003': 'out_for_delivery',
      'SH004': 'delivered',
      'SH005': 'exception',
      'SH006': 'returned'
    };
    return statusMap[updateCode] || 'in_transit';
  }
}

module.exports = AramexService;
