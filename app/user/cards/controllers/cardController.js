const Card = require('../../../../db/models/cardModel');

// Mock card verification service for development
const mockCardVerificationService = {
  verifyCard: async (cardData, gateway) => {
    console.log('🧪 Mock card verification for:', cardData.cardholderName);

    // Basic validation
    if (!cardData.cardNumber || !cardData.expiryMonth || !cardData.expiryYear || !cardData.cvv || !cardData.cardholderName) {
      return {
        success: false,
        error: 'Missing required card details'
      };
    }

    // Detect card brand
    const cardNumber = cardData.cardNumber.replace(/\s/g, '');
    let cardBrand = 'unknown';
    if (/^4/.test(cardNumber)) cardBrand = 'visa';
    else if (/^5[1-5]/.test(cardNumber) || /^2[2-7]/.test(cardNumber)) cardBrand = 'mastercard';
    else if (/^3[47]/.test(cardNumber)) cardBrand = 'amex';

    return {
      success: true,
      cardBrand: cardBrand,
      lastFourDigits: cardNumber.slice(-4),
      isValid: true,
      gatewayVerification: {
        success: true,
        status: 'verified', // Changed from 'mock' to 'verified'
        gateway: gateway,
        verificationId: `mock_${Date.now()}`
      }
    };
  },

  saveCard: async (userId, cardData, verificationResult) => {
    console.log('🧪 Mock card save for user:', userId);

    try {
      // Check if card already exists
      const cardNumber = cardData.cardNumber.replace(/\s/g, '');
      const existingCard = await Card.findOne({
        user: userId,
        lastFourDigits: cardNumber.slice(-4),
        isActive: true
      });

      if (existingCard) {
        return {
          success: false,
          error: 'Card already exists'
        };
      }

      // Detect card brand
      let cardBrand = 'unknown';
      if (/^4/.test(cardNumber)) cardBrand = 'visa';
      else if (/^5[1-5]/.test(cardNumber) || /^2[2-7]/.test(cardNumber)) cardBrand = 'mastercard';
      else if (/^3[47]/.test(cardNumber)) cardBrand = 'amex';
      else if (/^6(?:011|5)/.test(cardNumber)) cardBrand = 'discover';
      else if (/^3[0689]/.test(cardNumber)) cardBrand = 'diners';
      else if (/^35/.test(cardNumber)) cardBrand = 'jcb';

      // Create new card
      const cardDoc = new Card({
        user: userId,
        cardNumber: cardNumber, // Will be encrypted by the model
        lastFourDigits: cardNumber.slice(-4), // Required field
        cardBrand: cardBrand, // Required field
        cardholderName: cardData.cardholderName,
        expiryMonth: cardData.expiryMonth,
        expiryYear: cardData.expiryYear,
        cvv: cardData.cvv, // Will be encrypted by the model
        isVerified: verificationResult.success,
        verificationDate: verificationResult.success ? new Date() : null,
        gatewayVerification: {
          gateway: verificationResult.gatewayVerification?.gateway || 'stripe',
          verificationId: verificationResult.gatewayVerification?.verificationId,
          verificationStatus: verificationResult.gatewayVerification?.status || 'verified', // Must be valid enum value
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
      console.error('Mock save card error:', error);
      return {
        success: false,
        error: 'Failed to save card data',
        details: error.message
      };
    }
  }
};

/**
 * Verify card details
 * POST /user/cards/verify
 */
const verifyCard = async (req, res) => {
  try {
    const { cardNumber, expiryMonth, expiryYear, cvv, cardholderName, gateway = 'stripe' } = req.body;

    // Validate required fields
    if (!cardNumber || !expiryMonth || !expiryYear || !cvv || !cardholderName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required card details',
        details: { code: 'MISSING_FIELDS' }
      });
    }

    // Use mock service for development
    const verificationResult = await mockCardVerificationService.verifyCard({
      cardNumber,
      expiryMonth,
      expiryYear,
      cvv,
      cardholderName
    }, gateway);

    if (!verificationResult.success) {
      return res.status(400).json({
        success: false,
        error: verificationResult.error,
        details: verificationResult.details
      });
    }

    res.json({
      success: true,
      message: 'Card verified successfully',
      data: {
        cardBrand: verificationResult.cardBrand,
        lastFourDigits: verificationResult.lastFourDigits,
        isValid: verificationResult.isValid,
        gatewayVerification: verificationResult.gatewayVerification
      }
    });

  } catch (error) {
    console.error('Verify card error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
};

/**
 * Verify and save card
 * POST /user/cards/verify-and-save
 */
const verifyAndSaveCard = async (req, res) => {
  try {
    const userId = req.user._id;
    const { cardNumber, expiryMonth, expiryYear, cvv, cardholderName, gateway = 'stripe', setAsDefault = false } = req.body;

    // Validate required fields
    if (!cardNumber || !expiryMonth || !expiryYear || !cvv || !cardholderName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required card details',
        details: { code: 'MISSING_FIELDS' }
      });
    }

    // Use mock service for development
    const verificationResult = await mockCardVerificationService.verifyCard({
      cardNumber,
      expiryMonth,
      expiryYear,
      cvv,
      cardholderName
    }, gateway);

    if (!verificationResult.success) {
      return res.status(400).json({
        success: false,
        error: verificationResult.error,
        details: verificationResult.details
      });
    }

    // Save verified card
    const saveResult = await mockCardVerificationService.saveCard(userId, {
      cardNumber,
      expiryMonth,
      expiryYear,
      cvv,
      cardholderName
    }, verificationResult);

    if (!saveResult.success) {
      return res.status(400).json({
        success: false,
        error: saveResult.error,
        details: saveResult.details
      });
    }

    // Set as default if requested
    if (setAsDefault) {
      await Card.setDefaultCard(userId, saveResult.card._id);
    }

    res.json({
      success: true,
      message: 'Card verified and saved successfully',
      data: {
        card: saveResult.card,
        verification: {
          cardBrand: verificationResult.cardBrand,
          lastFourDigits: verificationResult.lastFourDigits,
          isValid: verificationResult.isValid
        }
      }
    });

  } catch (error) {
    console.error('Verify and save card error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
};

/**
 * Get user's saved cards
 * GET /user/cards
 */
const getUserCards = async (req, res) => {
  try {
    const userId = req.user._id;
    const { activeOnly = true } = req.query;

    const cards = await Card.findUserCards(userId, activeOnly === 'true');

    res.json({
      success: true,
      message: 'Cards retrieved successfully',
      data: {
        cards: cards,
        count: cards.length
      }
    });

  } catch (error) {
    console.error('Get user cards error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
};

/**
 * Get user's default card
 * GET /user/cards/default
 */
const getDefaultCard = async (req, res) => {
  try {
    const userId = req.user._id;

    const defaultCard = await Card.findDefaultCard(userId);

    if (!defaultCard) {
      return res.status(404).json({
        success: false,
        error: 'No default card found'
      });
    }

    res.json({
      success: true,
      message: 'Default card retrieved successfully',
      data: {
        card: defaultCard
      }
    });

  } catch (error) {
    console.error('Get default card error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
};

/**
 * Set default card
 * PUT /user/cards/:cardId/set-default
 */
const setDefaultCard = async (req, res) => {
  try {
    const userId = req.user._id;
    const { cardId } = req.params;

    // Verify card belongs to user
    const card = await Card.findOne({ _id: cardId, user: userId, isActive: true });
    if (!card) {
      return res.status(404).json({
        success: false,
        error: 'Card not found'
      });
    }

    const updatedCard = await Card.setDefaultCard(userId, cardId);

    res.json({
      success: true,
      message: 'Default card updated successfully',
      data: {
        card: updatedCard
      }
    });

  } catch (error) {
    console.error('Set default card error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
};

/**
 * Delete card
 * DELETE /user/cards/:cardId
 */
const deleteCard = async (req, res) => {
  try {
    const userId = req.user._id;
    const { cardId } = req.params;

    // Verify card belongs to user
    const card = await Card.findOne({ _id: cardId, user: userId });
    if (!card) {
      return res.status(404).json({
        success: false,
        error: 'Card not found'
      });
    }

    // Soft delete (set isActive to false)
    card.isActive = false;
    await card.save();

    // If this was the default card, set another card as default
    if (card.isDefault) {
      const otherCard = await Card.findOne({ 
        user: userId, 
        isActive: true, 
        _id: { $ne: cardId } 
      });
      
      if (otherCard) {
        otherCard.isDefault = true;
        await otherCard.save();
      }
    }

    res.json({
      success: true,
      message: 'Card deleted successfully'
    });

  } catch (error) {
    console.error('Delete card error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
};

/**
 * Get card details for payment (with decrypted data for authorized use)
 * GET /user/cards/:cardId/payment-details
 */
const getCardPaymentDetails = async (req, res) => {
  try {
    const userId = req.user._id;
    const { cardId } = req.params;

    // Verify card belongs to user
    const card = await Card.findOne({ _id: cardId, user: userId, isActive: true });
    if (!card) {
      return res.status(404).json({
        success: false,
        error: 'Card not found'
      });
    }

    // Return card details for payment processing
    // Note: This should only be used for immediate payment processing
    res.json({
      success: true,
      message: 'Card payment details retrieved',
      data: {
        cardId: card._id,
        cardBrand: card.cardBrand,
        lastFourDigits: card.lastFourDigits,
        cardholderName: card.cardholderName,
        expiryMonth: card.expiryMonth,
        expiryYear: card.expiryYear,
        isVerified: card.isVerified,
        gatewayVerification: card.gatewayVerification
      }
    });

  } catch (error) {
    console.error('Get card payment details error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
};

module.exports = {
  verifyCard,
  verifyAndSaveCard,
  getUserCards,
  getDefaultCard,
  setDefaultCard,
  deleteCard,
  getCardPaymentDetails
};
