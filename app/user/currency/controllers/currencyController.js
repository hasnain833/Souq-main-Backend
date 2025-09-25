const currencyService = require('../../../../services/currency/CurrencyService');
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');

/**
 * Get supported currencies
 */
exports.getSupportedCurrencies = async (req, res) => {
  try {
    // Auto-update rates if needed
    await currencyService.autoUpdate();

    const currencies = currencyService.getSupportedCurrencies();

    return successResponse(res, 'Supported currencies retrieved successfully', currencies);

  } catch (error) {
    console.error('Get supported currencies error:', error);
    return errorResponse(res, 'Failed to retrieve supported currencies', 500);
  }
};

/**
 * Convert currency
 */
exports.convertCurrency = async (req, res) => {
  try {
    const { amount, fromCurrency, toCurrency } = req.body;

    // Validate input
    if (!amount || !fromCurrency || !toCurrency) {
      return errorResponse(res, 'Amount, fromCurrency, and toCurrency are required', 400);
    }

    // Validate amount
    const validation = currencyService.validateAmount(parseFloat(amount), fromCurrency);
    if (!validation.isValid) {
      return errorResponse(res, 'Validation failed', 400, { errors: validation.errors });
    }

    // Auto-update rates if needed
    await currencyService.autoUpdate();

    // Convert currency
    const conversion = currencyService.convertCurrency(
      parseFloat(amount),
      fromCurrency.toUpperCase(),
      toCurrency.toUpperCase()
    );

    if (!conversion.success) {
      return errorResponse(res, conversion.error || 'Currency conversion failed', 400);
    }

    return successResponse(res, 'Currency converted successfully', conversion);

  } catch (error) {
    console.error('Convert currency error:', error);
    return errorResponse(res, 'Failed to convert currency', 500);
  }
};

/**
 * Get exchange rates
 */
exports.getExchangeRates = async (req, res) => {
  try {
    const { baseCurrency, targetCurrencies } = req.query;

    // Auto-update rates if needed
    await currencyService.autoUpdate();

    const base = baseCurrency ? baseCurrency.toUpperCase() : 'AED';
    const targets = targetCurrencies 
      ? targetCurrencies.split(',').map(c => c.toUpperCase())
      : undefined;

    const rates = currencyService.getConversionRates(base, targets);

    return successResponse(res, 'Exchange rates retrieved successfully', rates);

  } catch (error) {
    console.error('Get exchange rates error:', error);
    return errorResponse(res, 'Failed to retrieve exchange rates', 500);
  }
};

/**
 * Format currency amount
 */
exports.formatCurrency = async (req, res) => {
  try {
    const { amount, currency } = req.body;

    if (!amount || !currency) {
      return errorResponse(res, 'Amount and currency are required', 400);
    }

    // Validate amount
    const validation = currencyService.validateAmount(parseFloat(amount), currency);
    if (!validation.isValid) {
      return errorResponse(res, 'Validation failed', 400, { errors: validation.errors });
    }

    const formattedAmount = currencyService.formatAmount(
      parseFloat(amount),
      currency.toUpperCase()
    );

    return successResponse(res, 'Currency formatted successfully', {
      originalAmount: parseFloat(amount),
      currency: currency.toUpperCase(),
      formattedAmount,
      symbol: currencyService.getCurrencySymbol(currency.toUpperCase()),
      name: currencyService.getCurrencyName(currency.toUpperCase())
    });

  } catch (error) {
    console.error('Format currency error:', error);
    return errorResponse(res, 'Failed to format currency', 500);
  }
};

/**
 * Get currency statistics
 */
exports.getCurrencyStatistics = async (req, res) => {
  try {
    const statistics = currencyService.getStatistics();

    return successResponse(res, 'Currency statistics retrieved successfully', statistics);

  } catch (error) {
    console.error('Get currency statistics error:', error);
    return errorResponse(res, 'Failed to retrieve currency statistics', 500);
  }
};

/**
 * Update exchange rates manually
 */
exports.updateExchangeRates = async (req, res) => {
  try {
    const updateResult = await currencyService.updateExchangeRates();

    if (updateResult) {
      const currencies = currencyService.getSupportedCurrencies();
      return successResponse(res, 'Exchange rates updated successfully', currencies);
    } else {
      return errorResponse(res, 'Failed to update exchange rates from external API', 500);
    }

  } catch (error) {
    console.error('Update exchange rates error:', error);
    return errorResponse(res, 'Failed to update exchange rates', 500);
  }
};

/**
 * Validate currency and amount
 */
exports.validateCurrency = async (req, res) => {
  try {
    const { amount, currency } = req.body;

    if (!amount || !currency) {
      return errorResponse(res, 'Amount and currency are required', 400);
    }

    const validation = currencyService.validateAmount(parseFloat(amount), currency.toUpperCase());

    return successResponse(res, 'Currency validation completed', validation);

  } catch (error) {
    console.error('Validate currency error:', error);
    return errorResponse(res, 'Failed to validate currency', 500);
  }
};

/**
 * Get currency by code
 */
exports.getCurrency = async (req, res) => {
  try {
    const { currencyCode } = req.params;

    if (!currencyCode) {
      return errorResponse(res, 'Currency code is required', 400);
    }

    const code = currencyCode.toUpperCase();

    if (!currencyService.isCurrencySupported(code)) {
      return errorResponse(res, 'Currency not supported', 404);
    }

    // Auto-update rates if needed
    await currencyService.autoUpdate();

    const currency = {
      code,
      name: currencyService.getCurrencyName(code),
      symbol: currencyService.getCurrencySymbol(code),
      rate: currencyService.getExchangeRate('AED', code),
      isSupported: true
    };

    return successResponse(res, 'Currency information retrieved successfully', currency);

  } catch (error) {
    console.error('Get currency error:', error);
    return errorResponse(res, 'Failed to retrieve currency information', 500);
  }
};

/**
 * Convert multiple amounts
 */
exports.convertMultiple = async (req, res) => {
  try {
    const { conversions } = req.body;

    if (!conversions || !Array.isArray(conversions)) {
      return errorResponse(res, 'Conversions array is required', 400);
    }

    // Auto-update rates if needed
    await currencyService.autoUpdate();

    const results = [];

    for (const conversion of conversions) {
      const { amount, fromCurrency, toCurrency } = conversion;

      if (!amount || !fromCurrency || !toCurrency) {
        results.push({
          success: false,
          error: 'Missing required fields',
          originalData: conversion
        });
        continue;
      }

      const validation = currencyService.validateAmount(parseFloat(amount), fromCurrency);
      if (!validation.isValid) {
        results.push({
          success: false,
          error: 'Validation failed',
          errors: validation.errors,
          originalData: conversion
        });
        continue;
      }

      const result = currencyService.convertCurrency(
        parseFloat(amount),
        fromCurrency.toUpperCase(),
        toCurrency.toUpperCase()
      );

      results.push(result);
    }

    return successResponse(res, 'Multiple currency conversions completed', {
      results,
      totalConversions: conversions.length,
      successfulConversions: results.filter(r => r.success).length,
      failedConversions: results.filter(r => !r.success).length
    });

  } catch (error) {
    console.error('Convert multiple currencies error:', error);
    return errorResponse(res, 'Failed to convert multiple currencies', 500);
  }
};

module.exports = exports;
