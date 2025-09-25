const AramexService = require('./AramexService');
const FetchrService = require('./FetchrService');
const DHLService = require('./DHLService');
const ZajelService = require('./ZajelService');
const LocalDeliveryService = require('./LocalDeliveryService');
const ShippingProvider = require('../../db/models/shippingProviderModel');

class ShippingServiceFactory {
  constructor() {
    this.services = new Map();
    this.initialized = false;
  }

  /**
   * Initialize the factory with shipping providers from database
   */
  async initialize() {
    try {
      const providers = await ShippingProvider.find({ isActive: true });
      
      for (const provider of providers) {
        await this.createService(provider);
      }
      
      this.initialized = true;
      console.log(`Shipping factory initialized with ${this.services.size} providers`);
    } catch (error) {
      console.error('Failed to initialize shipping factory:', error);
      throw error;
    }
  }

  /**
   * Create a shipping service instance for a provider
   */
  async createService(provider) {
    try {
      let service;
      
      switch (provider.name) {
        case 'aramex':
          service = new AramexService(provider.configuration);
          break;
        case 'fetchr':
          service = new FetchrService(provider.configuration);
          break;
        case 'dhl':
          service = new DHLService(provider.configuration);
          break;
        case 'zajel':
          service = new ZajelService(provider.configuration);
          break;
        case 'local_pickup':
        case 'local_dropoff':
        case 'local_delivery':
          service = new LocalDeliveryService(provider.configuration);
          break;
        default:
          throw new Error(`Unsupported shipping provider: ${provider.name}`);
      }

      // Initialize the service
      const isConfigured = await service.initialize(provider.configuration);
      
      if (isConfigured) {
        this.services.set(provider.name, {
          service,
          provider,
          lastHealthCheck: new Date(),
          isHealthy: true
        });
        console.log(`${provider.displayName} service initialized successfully`);
      } else {
        console.warn(`${provider.displayName} service configuration invalid`);
      }
    } catch (error) {
      console.error(`Failed to create service for ${provider.displayName}:`, error);
    }
  }

  /**
   * Get a shipping service by provider name
   */
  getService(providerName) {
    if (!this.initialized) {
      throw new Error('Shipping factory not initialized');
    }

    const serviceData = this.services.get(providerName);
    if (!serviceData) {
      throw new Error(`Shipping provider '${providerName}' not found or not configured`);
    }

    if (!serviceData.isHealthy) {
      throw new Error(`Shipping provider '${providerName}' is currently unavailable`);
    }

    return serviceData.service;
  }

  /**
   * Get all available shipping services
   */
  getAllServices() {
    if (!this.initialized) {
      throw new Error('Shipping factory not initialized');
    }

    const services = [];
    for (const [name, serviceData] of this.services) {
      if (serviceData.isHealthy) {
        services.push({
          name,
          displayName: serviceData.provider.displayName,
          service: serviceData.service,
          provider: serviceData.provider
        });
      }
    }

    return services;
  }

  /**
   * Get shipping rates from all available providers
   */
  async getAllRates(origin, destination, packageDetails) {
    const allRates = [];
    const services = this.getAllServices();

    for (const serviceData of services) {
      try {
        const rates = await serviceData.service.getShippingRates(origin, destination, packageDetails);
        
        // Add provider information to each rate
        const enrichedRates = rates.map(rate => ({
          ...rate,
          provider: {
            name: serviceData.name,
            displayName: serviceData.displayName
          }
        }));

        allRates.push(...enrichedRates);
      } catch (error) {
        console.error(`Failed to get rates from ${serviceData.displayName}:`, error);
        // Continue with other providers
      }
    }

    // Sort by price (cheapest first)
    return allRates.sort((a, b) => a.cost.total - b.cost.total);
  }

  /**
   * Get the cheapest shipping option
   */
  async getCheapestRate(origin, destination, packageDetails) {
    const rates = await this.getAllRates(origin, destination, packageDetails);
    return rates.length > 0 ? rates[0] : null;
  }

  /**
   * Get the fastest shipping option
   */
  async getFastestRate(origin, destination, packageDetails) {
    const rates = await this.getAllRates(origin, destination, packageDetails);
    
    // Sort by estimated delivery time (fastest first)
    const sortedBySpeed = rates.sort((a, b) => {
      const aMax = a.estimatedDays?.max || 999;
      const bMax = b.estimatedDays?.max || 999;
      return aMax - bMax;
    });

    return sortedBySpeed.length > 0 ? sortedBySpeed[0] : null;
  }

  /**
   * Create a shipment using the specified provider
   */
  async createShipment(providerName, shipmentData) {
    const service = this.getService(providerName);
    return await service.createShipment(shipmentData);
  }

  /**
   * Track a shipment using the specified provider
   */
  async trackShipment(providerName, trackingNumber) {
    const service = this.getService(providerName);
    return await service.trackShipment(trackingNumber);
  }

  /**
   * Cancel a shipment using the specified provider
   */
  async cancelShipment(providerName, shipmentId) {
    const service = this.getService(providerName);
    return await service.cancelShipment(shipmentId);
  }

  /**
   * Validate an address using the specified provider
   */
  async validateAddress(providerName, address) {
    const service = this.getService(providerName);
    return await service.validateAddress(address);
  }

  /**
   * Schedule a pickup using the specified provider
   */
  async schedulePickup(providerName, pickupData) {
    const service = this.getService(providerName);
    return await service.schedulePickup(pickupData);
  }

  /**
   * Perform health checks on all services
   */
  async performHealthChecks() {
    console.log('Performing shipping service health checks...');
    
    for (const [name, serviceData] of this.services) {
      try {
        // Simple health check - validate configuration
        const isHealthy = await serviceData.service.validateConfiguration();
        serviceData.isHealthy = isHealthy;
        serviceData.lastHealthCheck = new Date();
        
        console.log(`${serviceData.provider.displayName}: ${isHealthy ? 'Healthy' : 'Unhealthy'}`);
      } catch (error) {
        serviceData.isHealthy = false;
        serviceData.lastHealthCheck = new Date();
        console.error(`Health check failed for ${serviceData.provider.displayName}:`, error);
      }
    }
  }

  /**
   * Reload providers from database
   */
  async reloadProviders() {
    console.log('Reloading shipping providers...');
    this.services.clear();
    await this.initialize();
  }

  /**
   * Get service statistics
   */
  getStatistics() {
    const stats = {
      totalServices: this.services.size,
      healthyServices: 0,
      unhealthyServices: 0,
      services: []
    };

    for (const [name, serviceData] of this.services) {
      if (serviceData.isHealthy) {
        stats.healthyServices++;
      } else {
        stats.unhealthyServices++;
      }

      stats.services.push({
        name,
        displayName: serviceData.provider.displayName,
        isHealthy: serviceData.isHealthy,
        lastHealthCheck: serviceData.lastHealthCheck
      });
    }

    return stats;
  }
}

// Create singleton instance
const shippingFactory = new ShippingServiceFactory();

module.exports = shippingFactory;
