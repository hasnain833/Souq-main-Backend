const BankAccount = require('../../../../db/models/bankAccountModel');

/**
 * Add a new bank account
 * POST /user/bank-accounts/add
 */
const addBankAccount = async (req, res) => {
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
      setAsDefault = false
    } = req.body;

    console.log('Bank account addition params:', {
      userId,
      accountHolderName,
      lastFour: accountNumber?.slice(-4),
      routingNumber,
      accountType,
      bankName
    });

    // Validate required fields
    if (!accountHolderName || !accountNumber || !routingNumber || !accountType || !bankName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required bank account details',
        details: { code: 'MISSING_FIELDS' }
      });
    }

    // Validate account number
    if (!/^\d{9,18}$/.test(accountNumber)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid account number format',
        details: { code: 'INVALID_ACCOUNT_NUMBER' }
      });
    }

    // Validate routing number
    if (!/^\d{9}$/.test(routingNumber)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid routing number format',
        details: { code: 'INVALID_ROUTING_NUMBER' }
      });
    }

    const lastFourDigits = accountNumber.slice(-4);

    // Check for duplicate bank account
    const existingAccount = await BankAccount.findOne({
      user: userId,
      lastFourDigits: lastFourDigits,
      routingNumber: routingNumber,
      isActive: true
    });

    if (existingAccount) {
      return res.status(400).json({
        success: false,
        error: 'This bank account is already added to your account',
        details: { code: 'DUPLICATE_ACCOUNT' }
      });
    }

    // Create bank account
    const bankAccount = new BankAccount({
      user: userId,
      accountHolderName,
      bankName,
      accountType: accountType.toLowerCase(),
      lastFourDigits,
      routingNumber,
      billingAddress,
      isDefault: setAsDefault,
      isVerified: false, // Bank accounts need verification
      paymentGateway: 'stripe' // Default gateway
    });

    const savedAccount = await bankAccount.save();
    console.log('✅ Bank account added successfully:', savedAccount._id);

    res.json({
      success: true,
      message: 'Bank account added successfully',
      data: {
        account: savedAccount
      }
    });

  } catch (error) {
    console.error('❌ Error adding bank account:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
};

/**
 * Get user's bank accounts
 * GET /user/bank-accounts
 */
const getUserBankAccounts = async (req, res) => {
  try {
    console.log('🔄 Get bank accounts request received');
    const userId = req.user._id;
    const { activeOnly = true } = req.query;

    console.log('Get bank accounts params:', { userId, activeOnly });

    const accounts = await BankAccount.findUserAccounts(userId, activeOnly === 'true');
    console.log('✅ Bank accounts retrieved:', accounts.length);

    res.json({
      success: true,
      message: 'Bank accounts retrieved successfully',
      data: {
        accounts: accounts,
        count: accounts.length
      }
    });

  } catch (error) {
    console.error('❌ Error getting bank accounts:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
};

/**
 * Get user's default bank account
 * GET /user/bank-accounts/default
 */
const getDefaultBankAccount = async (req, res) => {
  try {
    console.log('🔄 Get default bank account request received');
    const userId = req.user._id;

    const defaultAccount = await BankAccount.getDefaultAccount(userId);

    if (!defaultAccount) {
      return res.status(404).json({
        success: false,
        error: 'No default bank account found'
      });
    }

    res.json({
      success: true,
      message: 'Default bank account retrieved successfully',
      data: {
        account: defaultAccount
      }
    });

  } catch (error) {
    console.error('❌ Error getting default bank account:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
};

/**
 * Set bank account as default
 * PUT /user/bank-accounts/:accountId/set-default
 */
const setDefaultBankAccount = async (req, res) => {
  try {
    console.log('🔄 Set default bank account request received');
    const userId = req.user._id;
    const { accountId } = req.params;

    console.log('Set default params:', { userId, accountId });

    const account = await BankAccount.findOne({
      _id: accountId,
      user: userId,
      isActive: true
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Bank account not found'
      });
    }

    await account.setAsDefault();
    console.log('✅ Bank account set as default:', accountId);

    res.json({
      success: true,
      message: 'Bank account set as default successfully',
      data: {
        account: account
      }
    });

  } catch (error) {
    console.error('❌ Error setting default bank account:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
};

/**
 * Delete bank account
 * DELETE /user/bank-accounts/:accountId
 */
const deleteBankAccount = async (req, res) => {
  try {
    console.log('🔄 Delete bank account request received');
    const userId = req.user._id;
    const { accountId } = req.params;

    console.log('Delete bank account params:', { userId, accountId });

    const account = await BankAccount.findOne({
      _id: accountId,
      user: userId,
      isActive: true
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Bank account not found'
      });
    }

    await account.softDelete();
    console.log('✅ Bank account deleted:', accountId);

    res.json({
      success: true,
      message: 'Bank account deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting bank account:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
};

module.exports = {
  addBankAccount,
  getUserBankAccounts,
  getDefaultBankAccount,
  setDefaultBankAccount,
  deleteBankAccount
};
