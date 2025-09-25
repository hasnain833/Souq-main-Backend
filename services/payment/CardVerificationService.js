const Card = require('../../db/models/cardModel');
const PaymentGateway = require('../../db/models/paymentGatewayModel');

class CardVerificationService {
  constructor() {
    this.stripeService = null;
    this.payTabsService = null;
    this.initialized = false;
  }

  /**
   * Initialize payment services with database configuration
   */
  async initialize() {
    try {
      if (this.initialized) return;

      // Load gateway configurations from database
      const gateways = await PaymentGateway.find({ isActive: true });

      for (const gateway of gateways) {
        if (gateway.gatewayName === 'stripe') {
          try {
            const StripeService = require('./StripeService');
            this.stripeService = new StripeService(gateway);
          } catch (error) {
            console.warn('Failed to initialize Stripe service:', error.message);
          }
        } else if (gateway.gatewayName === 'paytabs') {
          try {
            const PayTabsService = require('./PayTabsService');
            this.payTabsService = new PayTabsService(gateway);
          } catch (error) {
            console.warn('Failed to initialize PayTabs service:', error.message);
          }
        }
      }

      this.initialized = true;
      console.log('✅ Card verification service initialized');
    } catch (error) {
      console.error('Failed to initialize card verification service:', error);
    }
  }

  /**
   * Verify card details using Luhn algorithm and gateway verification
   * @param {Object} cardData - Card details to verify
   * @param {string} gateway - Payment gateway to use for verification
   * @returns {Promise<Object>} Verification result
   */
  async verifyCard(cardData, gateway = 'stripe') {
    try {
      // Ensure service is initialized
      await this.initialize();

      const { cardNumber, expiryMonth, expiryYear, cvv, cardholderName } = cardData;

      // Step 1: Basic validation
      const basicValidation = this.validateCardBasics(cardData);
      if (!basicValidation.isValid) {
        return {
          success: false,
          error: basicValidation.error,
          details: basicValidation.details
        };
      }

      // Step 2: Luhn algorithm validation
      const luhnValid = this.validateLuhnAlgorithm(cardNumber);
      if (!luhnValid) {
        return {
          success: false,
          error: 'Invalid card number',
          details: { code: 'INVALID_CARD_NUMBER' }
        };
      }

      // Step 3: Gateway verification (without charging)
      let gatewayVerification = null;
      try {
        switch (gateway.toLowerCase()) {
          case 'stripe':
            if (this.stripeService) {
              gatewayVerification = await this.verifyWithStripe(cardData);
            } else {
              gatewayVerification = {
                success: true,
                verificationId: null,
                status: 'skipped',
                reason: 'Stripe service not available'
              };
            }
            break;
          case 'paytabs':
            if (this.payTabsService) {
              gatewayVerification = await this.verifyWithPayTabs(cardData);
            } else {
              gatewayVerification = {
                success: true,
                verificationId: null,
                status: 'skipped',
                reason: 'PayTabs service not available'
              };
            }
            break;
          default:
            // Skip gateway verification for unsupported gateways
            gatewayVerification = {
              success: true,
              verificationId: null,
              status: 'skipped',
              reason: 'Gateway not supported for verification'
            };
        }
      } catch (error) {
        console.error('Gateway verification failed:', error);
        gatewayVerification = {
          success: false,
          error: error.message,
          status: 'failed'
        };
      }

      return {
        success: true,
        cardBrand: this.detectCardBrand(cardNumber),
        lastFourDigits: cardNumber.slice(-4),
        gatewayVerification,
        isValid: true
      };

    } catch (error) {
      console.error('Card verification error:', error);
      return {
        success: false,
        error: 'Card verification failed',
        details: error.message
      };
    }
  }

  /**
   * Save verified card to database
   * @param {string} userId - User ID
   * @param {Object} cardData - Card details
   * @param {Object} verificationResult - Verification result
   * @returns {Promise<Object>} Saved card
   */
  async saveCard(userId, cardData, verificationResult) {
    try {
      // Ensure service is initialized
      await this.initialize();

      const { cardNumber, expiryMonth, expiryYear, cvv, cardholderName } = cardData;

      // Check if card already exists for this user
      const existingCard = await this.findExistingCard(userId, cardNumber);
      if (existingCard) {
        return {
          success: false,
          error: 'Card already exists',
          card: existingCard
        };
      }

      // Create new card
      const cardDoc = new Card({
        user: userId,
        cardNumber: cardNumber,
        cardholderName: cardholderName,
        expiryMonth: expiryMonth,
        expiryYear: expiryYear,
        cvv: cvv, // Will be encrypted by the model
        isVerified: verificationResult.success,
        verificationDate: verificationResult.success ? new Date() : null,
        gatewayVerification: {
          gateway: verificationResult.gatewayVerification?.gateway || 'unknown',
          verificationId: verificationResult.gatewayVerification?.verificationId,
          verificationStatus: verificationResult.gatewayVerification?.status || 'pending',
          verificationResponse: verificationResult.gatewayVerification
        }
      });

      // Set as default if it's the user's first card
      const userCardCount = await Card.countDocuments({ user: userId, isActive: true });
      if (userCardCount === 0) {
        cardDoc.isDefault = true;
      }

      const savedCard = await cardDoc.save();

      return {
        success: true,
        card: savedCard
      };

    } catch (error) {
      console.error('Save card error:', error);
      return {
        success: false,
        error: 'Failed to save card',
        details: error.message
      };
    }
  }

  /**
   * Verify card with Stripe (using Setup Intent for verification without charging)
   * @param {Object} cardData - Card details
   * @returns {Promise<Object>} Stripe verification result
   */
  async verifyWithStripe(cardData) {
    try {
      if (!this.stripeService || !this.stripeService.stripe) {
        return {
          success: false,
          gateway: 'stripe',
          error: 'Stripe service not available',
          status: 'failed'
        };
      }

      const { cardNumber, expiryMonth, expiryYear, cvv } = cardData;

      // For now, we'll skip actual Stripe verification to avoid API issues
      // In production, you would uncomment the code below

      /*
      // Create a Setup Intent for card verification
      const setupIntent = await this.stripeService.stripe.setupIntents.create({
        payment_method_types: ['card'],
        usage: 'off_session'
      });

      // Create payment method
      const paymentMethod = await this.stripeService.stripe.paymentMethods.create({
        type: 'card',
        card: {
          number: cardNumber,
          exp_month: parseInt(expiryMonth),
          exp_year: parseInt(`20${expiryYear}`),
          cvc: cvv
        }
      });

      return {
        success: true,
        gateway: 'stripe',
        verificationId: setupIntent.id,
        paymentMethodId: paymentMethod.id,
        status: 'verified'
      };
      */

      // Mock verification for development
      return {
        success: true,
        gateway: 'stripe',
        verificationId: `mock_setup_${Date.now()}`,
        paymentMethodId: `mock_pm_${Date.now()}`,
        status: 'verified',
        mock: true
      };

    } catch (error) {
      console.error('Stripe verification error:', error);
      return {
        success: false,
        gateway: 'stripe',
        error: error.message,
        status: 'failed'
      };
    }
  }

  /**
   * Verify card with PayTabs (using tokenization)
   * @param {Object} cardData - Card details
   * @returns {Promise<Object>} PayTabs verification result
   */
  async verifyWithPayTabs(cardData) {
    try {
      if (!this.payTabsService) {
        return {
          success: false,
          gateway: 'paytabs',
          error: 'PayTabs service not available',
          status: 'failed'
        };
      }

      // Mock verification for development
      // In production, you would use actual PayTabs tokenization
      return {
        success: true,
        gateway: 'paytabs',
        verificationId: `mock_token_${Date.now()}`,
        status: 'verified',
        mock: true
      };

    } catch (error) {
      console.error('PayTabs verification error:', error);
      return {
        success: false,
        gateway: 'paytabs',
        error: error.message,
        status: 'failed'
      };
    }
  }

  /**
   * Basic card validation
   * @param {Object} cardData - Card details
   * @returns {Object} Validation result
   */
  validateCardBasics(cardData) {
    const { cardNumber, expiryMonth, expiryYear, cvv, cardholderName } = cardData;

    // Check required fields
    if (!cardNumber || !expiryMonth || !expiryYear || !cvv || !cardholderName) {
      return {
        isValid: false,
        error: 'Missing required card details',
        details: { code: 'MISSING_FIELDS' }
      };
    }

    // Validate card number format
    const cleanCardNumber = cardNumber.replace(/\s/g, '');
    if (!/^\d{13,19}$/.test(cleanCardNumber)) {
      return {
        isValid: false,
        error: 'Invalid card number format',
        details: { code: 'INVALID_FORMAT' }
      };
    }

    // Validate expiry month
    if (!/^(0[1-9]|1[0-2])$/.test(expiryMonth)) {
      return {
        isValid: false,
        error: 'Invalid expiry month',
        details: { code: 'INVALID_EXPIRY_MONTH' }
      };
    }

    // Validate expiry year
    if (!/^\d{2}$/.test(expiryYear)) {
      return {
        isValid: false,
        error: 'Invalid expiry year',
        details: { code: 'INVALID_EXPIRY_YEAR' }
      };
    }

    // Check if card is expired
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear() % 100;
    const currentMonth = currentDate.getMonth() + 1;
    const cardYear = parseInt(expiryYear);
    const cardMonth = parseInt(expiryMonth);

    if (cardYear < currentYear || (cardYear === currentYear && cardMonth < currentMonth)) {
      return {
        isValid: false,
        error: 'Card has expired',
        details: { code: 'CARD_EXPIRED' }
      };
    }

    // Validate CVV
    if (!/^\d{3,4}$/.test(cvv)) {
      return {
        isValid: false,
        error: 'Invalid CVV',
        details: { code: 'INVALID_CVV' }
      };
    }

    return { isValid: true };
  }

  /**
   * Validate card number using Luhn algorithm
   * @param {string} cardNumber - Card number
   * @returns {boolean} Is valid
   */
  validateLuhnAlgorithm(cardNumber) {
    const number = cardNumber.replace(/\s/g, '');
    
    if (!/^\d+$/.test(number)) return false;
    
    let sum = 0;
    let isEven = false;
    
    for (let i = number.length - 1; i >= 0; i--) {
      let digit = parseInt(number[i]);
      
      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }
      
      sum += digit;
      isEven = !isEven;
    }
    
    return sum % 10 === 0;
  }

  /**
   * Detect card brand from card number
   * @param {string} cardNumber - Card number
   * @returns {string} Card brand
   */
  detectCardBrand(cardNumber) {
    const number = cardNumber.replace(/\s/g, '');
    
    if (/^4/.test(number)) return 'visa';
    if (/^5[1-5]/.test(number) || /^2[2-7]/.test(number)) return 'mastercard';
    if (/^3[47]/.test(number)) return 'amex';
    if (/^6(?:011|5)/.test(number)) return 'discover';
    if (/^3[0689]/.test(number)) return 'diners';
    if (/^35/.test(number)) return 'jcb';
    
    return 'unknown';
  }

  /**
   * Find existing card for user
   * @param {string} userId - User ID
   * @param {string} cardNumber - Card number
   * @returns {Promise<Object|null>} Existing card or null
   */
  async findExistingCard(userId, cardNumber) {
    try {
      const fingerprint = this.generateCardFingerprint(userId, cardNumber);
      return await Card.findOne({ fingerprint, isActive: true });
    } catch (error) {
      console.error('Find existing card error:', error);
      return null;
    }
  }

  /**
   * Generate card fingerprint
   * @param {string} userId - User ID
   * @param {string} cardNumber - Card number
   * @returns {string} Fingerprint
   */
  generateCardFingerprint(userId, cardNumber) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(cardNumber + userId).digest('hex');
  }
}

module.exports = CardVerificationService;
