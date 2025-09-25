/**
 * Base class for all shipping service providers
 * Defines the common interface that all shipping providers must implement
 */
class BaseShippingService {
  constructor(config) {
    this.config = config;
    this.providerName = '';
    this.isConfigured = false;
  }

  /**
   * Initialize the shipping service with configuration
   * @param {Object} config - Provider-specific configuration
   */
  async initialize(config) {
    this.config = { ...this.config, ...config };
    this.isConfigured = await this.validateConfiguration();
    return this.isConfigured;
  }

  /**
   * Validate the provider configuration
   * @returns {boolean} - True if configuration is valid
   */
  async validateConfiguration() {
    throw new Error('validateConfiguration method must be implemented by subclass');
  }

  /**
   * Get available shipping services for a route
   * @param {Object} origin - Origin address
   * @param {Object} destination - Destination address
   * @param {Object} packageDetails - Package weight, dimensions, value
   * @returns {Array} - Array of available services with rates
   */
  async getShippingRates(origin, destination, packageDetails) {
    throw new Error('getShippingRates method must be implemented by subclass');
  }

  /**
   * Create a shipment
   * @param {Object} shipmentData - Complete shipment information
   * @returns {Object} - Shipment creation response with tracking number
   */
  async createShipment(shipmentData) {
    throw new Error('createShipment method must be implemented by subclass');
  }

  /**
   * Track a shipment
   * @param {string} trackingNumber - Tracking number
   * @returns {Object} - Tracking information
   */
  async trackShipment(trackingNumber) {
    throw new Error('trackShipment method must be implemented by subclass');
  }

  /**
   * Cancel a shipment
   * @param {string} shipmentId - Provider shipment ID
   * @returns {Object} - Cancellation response
   */
  async cancelShipment(shipmentId) {
    throw new Error('cancelShipment method must be implemented by subclass');
  }

  /**
   * Get shipping label
   * @param {string} shipmentId - Provider shipment ID
   * @param {string} format - Label format (PDF, PNG, etc.)
   * @returns {Object} - Label data
   */
  async getShippingLabel(shipmentId, format = 'PDF') {
    throw new Error('getShippingLabel method must be implemented by subclass');
  }

  /**
   * Validate an address
   * @param {Object} address - Address to validate
   * @returns {Object} - Validation result
   */
  async validateAddress(address) {
    throw new Error('validateAddress method must be implemented by subclass');
  }

  /**
   * Get delivery time estimate
   * @param {Object} origin - Origin address
   * @param {Object} destination - Destination address
   * @param {string} serviceCode - Service code
   * @returns {Object} - Delivery time estimate
   */
  async getDeliveryTimeEstimate(origin, destination, serviceCode) {
    throw new Error('getDeliveryTimeEstimate method must be implemented by subclass');
  }

  /**
   * Get pickup availability
   * @param {Object} address - Pickup address
   * @param {Date} date - Preferred pickup date
   * @returns {Object} - Pickup availability
   */
  async getPickupAvailability(address, date) {
    throw new Error('getPickupAvailability method must be implemented by subclass');
  }

  /**
   * Schedule a pickup
   * @param {Object} pickupData - Pickup details
   * @returns {Object} - Pickup confirmation
   */
  async schedulePickup(pickupData) {
    throw new Error('schedulePickup method must be implemented by subclass');
  }

  /**
   * Get provider-specific service codes
   * @returns {Array} - Array of service codes
   */
  getServiceCodes() {
    throw new Error('getServiceCodes method must be implemented by subclass');
  }

  /**
   * Format address for provider API
   * @param {Object} address - Standard address object
   * @returns {Object} - Provider-formatted address
   */
  formatAddress(address) {
    return {
      name: address.fullName || address.name,
      company: address.company || '',
      street1: address.street1,
      street2: address.street2 || '',
      city: address.city,
      state: address.state || '',
      zipCode: address.zipCode,
      country: address.country,
      phone: address.phoneNumber || address.phone,
      email: address.email || ''
    };
  }

  /**
   * Format package details for provider API
   * @param {Object} packageDetails - Standard package object
   * @returns {Object} - Provider-formatted package
   */
  formatPackage(packageDetails) {
    return {
      weight: packageDetails.weight || 1,
      dimensions: {
        length: packageDetails.dimensions?.length || 10,
        width: packageDetails.dimensions?.width || 10,
        height: packageDetails.dimensions?.height || 10,
        unit: packageDetails.dimensions?.unit || 'cm'
      },
      value: packageDetails.value || 0,
      currency: packageDetails.currency || 'USD',
      description: packageDetails.description || 'General merchandise'
    };
  }

  /**
   * Handle API errors consistently
   * @param {Error} error - Original error
   * @param {string} operation - Operation that failed
   * @returns {Error} - Formatted error
   */
  handleError(error, operation) {
    const formattedError = new Error(`${this.providerName} ${operation} failed: ${error.message}`);
    formattedError.provider = this.providerName;
    formattedError.operation = operation;
    formattedError.originalError = error;
    return formattedError;
  }

  /**
   * Log provider operations for debugging
   * @param {string} operation - Operation name
   * @param {Object} data - Operation data
   * @param {string} level - Log level
   */
  log(operation, data, level = 'info') {
    console.log(`[${this.providerName}] ${operation}:`, JSON.stringify(data, null, 2));
  }
}

module.exports = BaseShippingService;
