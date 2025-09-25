const PaymentMethod = require('../../../../db/models/paymentMethodModel');
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');
const crypto = require('crypto');

// Encryption key (should be in environment variables)
const ENCRYPTION_KEY = process.env.PAYMENT_ENCRYPTION_KEY || 'your-32-character-secret-key-here';

/**
 * Encrypt sensitive data
 */
const encrypt = (text) => {
  const cipher = crypto.createCipher('aes-256-cbc', ENCRYPTION_KEY);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
};

/**
 * Decrypt sensitive data
 */
const decrypt = (encryptedText) => {
  const decipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

/**
 * Get card brand from card number
 */
const getCardBrand = (cardNumber) => {
  const firstDigit = cardNumber.charAt(0);
  const firstTwoDigits = cardNumber.substring(0, 2);
  const firstFourDigits = cardNumber.substring(0, 4);

  if (firstDigit === '4') return 'visa';
  if (['51', '52', '53', '54', '55'].includes(firstTwoDigits)) return 'mastercard';
  if (['34', '37'].includes(firstTwoDigits)) return 'amex';
  if (firstFourDigits === '6011') return 'discover';
  return 'other';
};

/**
 * Create card fingerprint for duplicate detection
 */
const createCardFingerprint = (cardNumber, expiryMonth, expiryYear) => {
  const data = `${cardNumber}-${expiryMonth}-${expiryYear}`;
  return crypto.createHash('sha256').update(data).digest('hex');
};

/**
 * Add a new card
 */
exports.addCard = async (req, res) => {
  try {
    console.log('🔄 Add card request received');
    const userId = req.user._id;
    const {
      cardholderName,
      cardNumber,
      expiryMonth,
      expiryYear,
      cvv,
      billingAddress,
      isDefault = false
    } = req.body;

    console.log('Card addition params:', {
      userId,
      cardholderName,
      lastFour: cardNumber.slice(-4),
      expiryMonth,
      expiryYear
    });

    // Validate required fields
    if (!cardholderName || !cardNumber || !expiryMonth || !expiryYear || !cvv) {
      return errorResponse(res, 'Missing required card details', 400);
    }

    // Validate card number (basic validation)
    if (!/^\d{13,19}$/.test(cardNumber)) {
      return errorResponse(res, 'Invalid card number format', 400);
    }

    // Get card brand
    const cardBrand = getCardBrand(cardNumber);
    const lastFourDigits = cardNumber.slice(-4);
    const fingerprint = createCardFingerprint(cardNumber, expiryMonth, expiryYear);

    // Check for duplicate card
    const existingCard = await PaymentMethod.findOne({
      user: userId,
      type: 'card',
      fingerprint: fingerprint,
      isActive: true
    });

    if (existingCard) {
      return errorResponse(res, 'This card is already added to your account', 400);
    }

    // Encrypt card number
    const encryptedCardNumber = encrypt(cardNumber);

    // Create payment method
    const paymentMethod = new PaymentMethod({
      user: userId,
      type: 'card',
      cardDetails: {
        cardholderName,
        lastFourDigits,
        cardBrand,
        expiryMonth,
        expiryYear,
        encryptedCardNumber,
        fingerprint
      },
      billingAddress,
      isDefault,
      isVerified: false, // Cards need verification
      paymentGateway: 'stripe' // Default gateway
    });

    const savedPaymentMethod = await paymentMethod.save();
    console.log('✅ Card added successfully:', savedPaymentMethod._id);

    return successResponse(res, 'Card added successfully', {
      paymentMethod: savedPaymentMethod
    });

  } catch (error) {
    console.error('❌ Error adding card:', error);
    return errorResponse(res, `Failed to add card: ${error.message}`, 500);
  }
};

/**
 * Add a new bank account
 */
exports.addBankAccount = async (req, res) => {
  try {
    console.log('🔄 Add bank account request received');
    const userId = req.user._id;
    const {
      accountHolderName,
      accountNumber,
      routingNumber,
      accountType,
      bankName,
      billingAddress,
      isDefault = false
    } = req.body;

    console.log('Bank account addition params:', {
      userId,
      accountHolderName,
      lastFour: accountNumber.slice(-4),
      routingNumber,
      accountType
    });

    // Validate required fields
    if (!accountHolderName || !accountNumber || !routingNumber || !accountType) {
      return errorResponse(res, 'Missing required bank account details', 400);
    }

    // Validate account number
    if (!/^\d{9,18}$/.test(accountNumber)) {
      return errorResponse(res, 'Invalid account number format', 400);
    }

    // Validate routing number
    if (!/^\d{9}$/.test(routingNumber)) {
      return errorResponse(res, 'Invalid routing number format', 400);
    }

    const lastFourDigits = accountNumber.slice(-4);

    // Check for duplicate bank account
    const existingAccount = await PaymentMethod.findOne({
      user: userId,
      type: 'bank_account',
      'bankDetails.lastFourDigits': lastFourDigits,
      'bankDetails.routingNumber': routingNumber,
      isActive: true
    });

    if (existingAccount) {
      return errorResponse(res, 'This bank account is already added to your account', 400);
    }

    // Encrypt account number
    const encryptedAccountNumber = encrypt(accountNumber);

    // Create payment method
    const paymentMethod = new PaymentMethod({
      user: userId,
      type: 'bank_account',
      bankDetails: {
        accountHolderName,
        bankName,
        accountType: accountType.toLowerCase(),
        encryptedAccountNumber,
        lastFourDigits,
        routingNumber
      },
      billingAddress,
      isDefault,
      isVerified: false, // Bank accounts need verification
      paymentGateway: 'stripe' // Default gateway
    });

    const savedPaymentMethod = await paymentMethod.save();
    console.log('✅ Bank account added successfully:', savedPaymentMethod._id);

    return successResponse(res, 'Bank account added successfully', {
      paymentMethod: savedPaymentMethod
    });

  } catch (error) {
    console.error('❌ Error adding bank account:', error);
    return errorResponse(res, `Failed to add bank account: ${error.message}`, 500);
  }
};

/**
 * Get user's payment methods
 */
exports.getPaymentMethods = async (req, res) => {
  try {
    console.log('🔄 Get payment methods request received');
    const userId = req.user._id;
    const { type } = req.query; // 'card' or 'bank_account'

    console.log('Get payment methods params:', { userId, type });

    const paymentMethods = await PaymentMethod.getUserPaymentMethods(userId, type);
    console.log('✅ Payment methods retrieved:', paymentMethods.length);

    return successResponse(res, 'Payment methods retrieved successfully', {
      paymentMethods
    });

  } catch (error) {
    console.error('❌ Error getting payment methods:', error);
    return errorResponse(res, `Failed to get payment methods: ${error.message}`, 500);
  }
};

/**
 * Set payment method as default
 */
exports.setDefaultPaymentMethod = async (req, res) => {
  try {
    console.log('🔄 Set default payment method request received');
    const userId = req.user._id;
    const { paymentMethodId } = req.params;

    console.log('Set default params:', { userId, paymentMethodId });

    const paymentMethod = await PaymentMethod.findOne({
      _id: paymentMethodId,
      user: userId,
      isActive: true
    });

    if (!paymentMethod) {
      return errorResponse(res, 'Payment method not found', 404);
    }

    await paymentMethod.setAsDefault();
    console.log('✅ Payment method set as default:', paymentMethodId);

    return successResponse(res, 'Payment method set as default successfully', {
      paymentMethod
    });

  } catch (error) {
    console.error('❌ Error setting default payment method:', error);
    return errorResponse(res, `Failed to set default payment method: ${error.message}`, 500);
  }
};

/**
 * Delete payment method
 */
exports.deletePaymentMethod = async (req, res) => {
  try {
    console.log('🔄 Delete payment method request received');
    const userId = req.user._id;
    const { paymentMethodId } = req.params;

    console.log('Delete payment method params:', { userId, paymentMethodId });

    const paymentMethod = await PaymentMethod.findOne({
      _id: paymentMethodId,
      user: userId,
      isActive: true
    });

    if (!paymentMethod) {
      return errorResponse(res, 'Payment method not found', 404);
    }

    await paymentMethod.softDelete();
    console.log('✅ Payment method deleted:', paymentMethodId);

    return successResponse(res, 'Payment method deleted successfully');

  } catch (error) {
    console.error('❌ Error deleting payment method:', error);
    return errorResponse(res, `Failed to delete payment method: ${error.message}`, 500);
  }
};
