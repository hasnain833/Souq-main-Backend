const axios = require('axios');

class CurrencyService {
  constructor() {
    this.baseCurrency = 'USD';
    this.supportedCurrencies = ['USD', 'AED', 'EUR', 'GBP', 'SAR'];
    this.exchangeRates = new Map();
    this.lastUpdated = null;
    this.updateInterval = 60 * 60 * 1000; // 1 hour
    this.apiKey = process.env.EXCHANGE_RATE_API_KEY;
    this.apiUrl = 'https://api.exchangerate-api.com/v4/latest';
    
    // Initialize with default rates (fallback)
    this.initializeDefaultRates();
  }

  /**
   * Initialize default exchange rates as fallback
   */
  initializeDefaultRates() {
    const defaultRates = {
      'USD': 1.0,      // Base currency
      'AED': 3.6738,   // 1 USD = 3.6738 AED
      'EUR': 0.9134,   // 1 USD = 0.9134 EUR
      'GBP': 0.7918,   // 1 USD = 0.7918 GBP
      'SAR': 3.7507    // 1 USD = 3.7507 SAR
    };

    for (const [currency, rate] of Object.entries(defaultRates)) {
      this.exchangeRates.set(currency, rate);
    }

    this.lastUpdated = new Date();
    console.log('✅ Initialized default currency exchange rates');
  }

  /**
   * Fetch latest exchange rates from API
   * @returns {Promise<boolean>} Success status
   */
  async updateExchangeRates() {
    try {
      console.log('🔄 Updating currency exchange rates...');

      let apiUrl = `${this.apiUrl}/${this.baseCurrency}`;
      if (this.apiKey) {
        apiUrl += `?access_key=${this.apiKey}`;
      }

      const response = await axios.get(apiUrl, {
        timeout: 10000 // 10 seconds timeout
      });

      if (response.data && response.data.rates) {
        // Update rates for supported currencies
        for (const currency of this.supportedCurrencies) {
          if (currency === this.baseCurrency) {
            this.exchangeRates.set(currency, 1.0);
          } else if (response.data.rates[currency]) {
            this.exchangeRates.set(currency, response.data.rates[currency]);
          }
        }

        this.lastUpdated = new Date();
        console.log('✅ Currency exchange rates updated successfully');
        return true;
      }

      throw new Error('Invalid API response format');

    } catch (error) {
      console.error('❌ Failed to update exchange rates:', error.message);
      console.log('ℹ️ Using cached/default exchange rates');
      return false;
    }
  }

  /**
   * Get current exchange rate between two currencies
   * @param {string} fromCurrency - Source currency
   * @param {string} toCurrency - Target currency
   * @returns {number} Exchange rate
   */
  getExchangeRate(fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) {
      return 1.0;
    }

    const fromRate = this.exchangeRates.get(fromCurrency);
    const toRate = this.exchangeRates.get(toCurrency);

    if (!fromRate || !toRate) {
      console.warn(`⚠️ Exchange rate not found for ${fromCurrency} to ${toCurrency}`);
      return 1.0; // Fallback to 1:1 rate
    }

    // Convert via base currency (AED)
    if (fromCurrency === this.baseCurrency) {
      return toRate;
    } else if (toCurrency === this.baseCurrency) {
      return 1 / fromRate;
    } else {
      return toRate / fromRate;
    }
  }

  /**
   * Convert amount from one currency to another
   * @param {number} amount - Amount to convert
   * @param {string} fromCurrency - Source currency
   * @param {string} toCurrency - Target currency
   * @returns {Object} Conversion result
   */
  convertCurrency(amount, fromCurrency, toCurrency) {
    if (!this.isCurrencySupported(fromCurrency) || !this.isCurrencySupported(toCurrency)) {
      return {
        success: false,
        error: 'Unsupported currency',
        originalAmount: amount,
        originalCurrency: fromCurrency,
        targetCurrency: toCurrency
      };
    }

    const exchangeRate = this.getExchangeRate(fromCurrency, toCurrency);
    const convertedAmount = amount * exchangeRate;

    return {
      success: true,
      originalAmount: amount,
      originalCurrency: fromCurrency,
      convertedAmount: Math.round(convertedAmount * 100) / 100, // Round to 2 decimal places
      targetCurrency: toCurrency,
      exchangeRate: exchangeRate,
      lastUpdated: this.lastUpdated
    };
  }

  /**
   * Check if currency is supported
   * @param {string} currency - Currency code
   * @returns {boolean} Support status
   */
  isCurrencySupported(currency) {
    return this.supportedCurrencies.includes(currency.toUpperCase());
  }

  /**
   * Get all supported currencies with their current rates
   * @returns {Object} Supported currencies and rates
   */
  getSupportedCurrencies() {
    const currencies = {};
    
    for (const currency of this.supportedCurrencies) {
      currencies[currency] = {
        code: currency,
        name: this.getCurrencyName(currency),
        symbol: this.getCurrencySymbol(currency),
        rate: this.exchangeRates.get(currency) || 1.0
      };
    }

    return {
      baseCurrency: this.baseCurrency,
      currencies,
      lastUpdated: this.lastUpdated
    };
  }

  /**
   * Get currency name
   * @param {string} currency - Currency code
   * @returns {string} Currency name
   */
  getCurrencyName(currency) {
    const names = {
      'AED': 'UAE Dirham',
      'USD': 'US Dollar',
      'EUR': 'Euro',
      'GBP': 'British Pound',
      'SAR': 'Saudi Riyal'
    };

    return names[currency] || currency;
  }

  /**
   * Get currency symbol
   * @param {string} currency - Currency code
   * @returns {string} Currency symbol
   */
  getCurrencySymbol(currency) {
    const symbols = {
      'AED': 'د.إ',
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'SAR': 'ر.س'
    };

    return symbols[currency] || currency;
  }

  /**
   * Format amount with currency
   * @param {number} amount - Amount to format
   * @param {string} currency - Currency code
   * @returns {string} Formatted amount
   */
  formatAmount(amount, currency) {
    const symbol = this.getCurrencySymbol(currency);
    const formattedAmount = amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    // For Arabic currencies, put symbol after amount
    if (['AED', 'SAR'].includes(currency)) {
      return `${formattedAmount} ${symbol}`;
    } else {
      return `${symbol}${formattedAmount}`;
    }
  }

  /**
   * Get currency conversion rates for multiple currencies
   * @param {string} baseCurrency - Base currency for conversion
   * @param {Array<string>} targetCurrencies - Target currencies
   * @returns {Object} Conversion rates
   */
  getConversionRates(baseCurrency, targetCurrencies = this.supportedCurrencies) {
    const rates = {};

    for (const targetCurrency of targetCurrencies) {
      if (this.isCurrencySupported(targetCurrency)) {
        rates[targetCurrency] = this.getExchangeRate(baseCurrency, targetCurrency);
      }
    }

    return {
      baseCurrency,
      rates,
      lastUpdated: this.lastUpdated
    };
  }

  /**
   * Check if exchange rates need updating
   * @returns {boolean} Update needed status
   */
  needsUpdate() {
    if (!this.lastUpdated) return true;
    
    const timeSinceUpdate = Date.now() - this.lastUpdated.getTime();
    return timeSinceUpdate > this.updateInterval;
  }

  /**
   * Auto-update exchange rates if needed
   * @returns {Promise<boolean>} Update status
   */
  async autoUpdate() {
    if (this.needsUpdate()) {
      return await this.updateExchangeRates();
    }
    return true;
  }

  /**
   * Get currency statistics
   * @returns {Object} Currency service statistics
   */
  getStatistics() {
    return {
      baseCurrency: this.baseCurrency,
      supportedCurrenciesCount: this.supportedCurrencies.length,
      supportedCurrencies: this.supportedCurrencies,
      lastUpdated: this.lastUpdated,
      updateInterval: this.updateInterval,
      needsUpdate: this.needsUpdate(),
      exchangeRatesCount: this.exchangeRates.size
    };
  }

  /**
   * Validate currency amount
   * @param {number} amount - Amount to validate
   * @param {string} currency - Currency code
   * @returns {Object} Validation result
   */
  validateAmount(amount, currency) {
    const errors = [];

    if (typeof amount !== 'number' || isNaN(amount)) {
      errors.push('Amount must be a valid number');
    }

    if (amount < 0) {
      errors.push('Amount cannot be negative');
    }

    if (amount > 999999999) {
      errors.push('Amount exceeds maximum limit');
    }

    if (!this.isCurrencySupported(currency)) {
      errors.push(`Currency ${currency} is not supported`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      amount,
      currency
    };
  }

  /**
   * Start automatic rate updates
   */
  startAutoUpdate() {
    // Update immediately
    this.updateExchangeRates();

    // Set up periodic updates
    this.updateTimer = setInterval(async () => {
      await this.updateExchangeRates();
    }, this.updateInterval);

    console.log('✅ Currency auto-update started');
  }

  /**
   * Stop automatic rate updates
   */
  stopAutoUpdate() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
      console.log('✅ Currency auto-update stopped');
    }
  }
}

// Create singleton instance
const currencyService = new CurrencyService();

module.exports = currencyService;
