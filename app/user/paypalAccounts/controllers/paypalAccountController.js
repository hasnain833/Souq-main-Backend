const PaypalAccount = require('../../../../db/models/paypalAccountModel');

/**
 * Add a new PayPal account
 * POST /user/paypal-accounts/add
 */
const addPaypalAccount = async (req, res) => {
  try {
    console.log('🔄 Add PayPal account request received');
    const userId = req.user._id;
    const {
      email,
      accountType = 'personal',
      setAsDefault = false
    } = req.body;

    console.log('PayPal account addition params:', {
      userId,
      email,
      accountType,
      setAsDefault
    });

    // Validate required fields
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
        details: { code: 'MISSING_EMAIL' }
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format',
        details: { code: 'INVALID_EMAIL' }
      });
    }

    // Check for duplicate PayPal account
    const existingAccount = await PaypalAccount.findOne({
      user: userId,
      email: email.toLowerCase(),
      isActive: true
    });

    if (existingAccount) {
      return res.status(400).json({
        success: false,
        error: 'This PayPal account is already added to your account',
        details: { code: 'DUPLICATE_ACCOUNT' }
      });
    }

    // Create PayPal account
    const paypalAccount = new PaypalAccount({
      user: userId,
      email: email.toLowerCase(),
      accountType: accountType.toLowerCase(),
      isDefault: setAsDefault,
      isVerified: false, // PayPal accounts need verification
      verificationStatus: 'unverified'
    });

    const savedAccount = await paypalAccount.save();
    console.log('✅ PayPal account added successfully:', savedAccount._id);

    res.json({
      success: true,
      message: 'PayPal account added successfully',
      data: {
        account: savedAccount
      }
    });

  } catch (error) {
    console.error('❌ Error adding PayPal account:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
};

/**
 * Get user's PayPal accounts
 * GET /user/paypal-accounts
 */
const getUserPaypalAccounts = async (req, res) => {
  try {
    console.log('🔄 Get PayPal accounts request received');
    const userId = req.user._id;
    const { activeOnly = true } = req.query;

    console.log('Get PayPal accounts params:', { userId, activeOnly });

    const accounts = await PaypalAccount.findUserAccounts(userId, activeOnly === 'true');
    console.log('✅ PayPal accounts retrieved:', accounts.length);

    res.json({
      success: true,
      message: 'PayPal accounts retrieved successfully',
      data: {
        accounts: accounts,
        count: accounts.length
      }
    });

  } catch (error) {
    console.error('❌ Error getting PayPal accounts:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
};

/**
 * Get user's default PayPal account
 * GET /user/paypal-accounts/default
 */
const getDefaultPaypalAccount = async (req, res) => {
  try {
    console.log('🔄 Get default PayPal account request received');
    const userId = req.user._id;

    const defaultAccount = await PaypalAccount.getDefaultAccount(userId);

    if (!defaultAccount) {
      return res.status(404).json({
        success: false,
        error: 'No default PayPal account found'
      });
    }

    res.json({
      success: true,
      message: 'Default PayPal account retrieved successfully',
      data: {
        account: defaultAccount
      }
    });

  } catch (error) {
    console.error('❌ Error getting default PayPal account:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
};

/**
 * Set PayPal account as default
 * PUT /user/paypal-accounts/:accountId/set-default
 */
const setDefaultPaypalAccount = async (req, res) => {
  try {
    console.log('🔄 Set default PayPal account request received');
    const userId = req.user._id;
    const { accountId } = req.params;

    console.log('Set default params:', { userId, accountId });

    const account = await PaypalAccount.findOne({
      _id: accountId,
      user: userId,
      isActive: true
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'PayPal account not found'
      });
    }

    await account.setAsDefault();
    console.log('✅ PayPal account set as default:', accountId);

    res.json({
      success: true,
      message: 'PayPal account set as default successfully',
      data: {
        account: account
      }
    });

  } catch (error) {
    console.error('❌ Error setting default PayPal account:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
};

/**
 * Verify PayPal account
 * POST /user/paypal-accounts/:accountId/verify
 */
const verifyPaypalAccount = async (req, res) => {
  try {
    console.log('🔄 Verify PayPal account request received');
    const userId = req.user._id;
    const { accountId } = req.params;

    console.log('Verify PayPal account params:', { userId, accountId });

    const account = await PaypalAccount.findOne({
      _id: accountId,
      user: userId,
      isActive: true
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'PayPal account not found'
      });
    }

    // Simulate PayPal verification process
    // In a real implementation, this would:
    // 1. Make API call to PayPal to verify account
    // 2. Check account status and capabilities
    // 3. Verify email ownership
    // 4. Check if account can receive payments

    console.log('🔍 Simulating PayPal verification for:', account.email);
    
    // Simulate verification delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // For demo purposes, verify all accounts except those with 'test-fail' in email
    const shouldFail = account.email.includes('test-fail');
    
    if (shouldFail) {
      await account.updateVerificationStatus('failed', 'api_verification');
      console.log('❌ PayPal account verification failed:', accountId);
      
      return res.status(400).json({
        success: false,
        error: 'PayPal account verification failed. Please ensure your account is in good standing and can receive payments.'
      });
    }

    // Update verification status
    await account.updateVerificationStatus('verified', 'api_verification');
    
    // Update metadata with mock verification info
    account.metadata = {
      ...account.metadata,
      verifiedAt: new Date().toISOString(),
      verificationMethod: 'api_verification',
      accountStatus: 'verified',
      canReceivePayments: true,
      country: 'US', // Mock country
      currency: 'USD' // Mock primary currency
    };
    
    await account.save();
    
    console.log('✅ PayPal account verified:', accountId);

    res.json({
      success: true,
      message: 'PayPal account verified successfully',
      data: {
        account: account,
        verificationDetails: {
          verifiedAt: account.metadata.verifiedAt,
          method: account.metadata.verificationMethod,
          canReceivePayments: account.metadata.canReceivePayments
        }
      }
    });

  } catch (error) {
    console.error('❌ Error verifying PayPal account:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
};

/**
 * Get PayPal connection status
 * GET /user/paypal-accounts/connection-status
 */
const getConnectionStatus = async (req, res) => {
  try {
    console.log('🔄 Get PayPal connection status request received');
    const userId = req.user._id;

    const accounts = await PaypalAccount.findUserAccounts(userId, true);
    const verifiedAccounts = accounts.filter(acc => acc.isVerified);
    const defaultAccount = accounts.find(acc => acc.isDefault);

    const connectionStatus = {
      isConnected: accounts.length > 0,
      hasVerifiedAccount: verifiedAccounts.length > 0,
      hasDefaultAccount: !!defaultAccount,
      totalAccounts: accounts.length,
      verifiedAccounts: verifiedAccounts.length,
      canWithdraw: verifiedAccounts.length > 0,
      defaultAccount: defaultAccount ? {
        id: defaultAccount._id,
        email: defaultAccount.email,
        isVerified: defaultAccount.isVerified,
        verificationStatus: defaultAccount.verificationStatus
      } : null
    };

    console.log('✅ PayPal connection status retrieved:', connectionStatus);

    res.json({
      success: true,
      message: 'PayPal connection status retrieved successfully',
      data: connectionStatus
    });

  } catch (error) {
    console.error('❌ Error getting PayPal connection status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
};

/**
 * Delete PayPal account
 * DELETE /user/paypal-accounts/:accountId
 */
const deletePaypalAccount = async (req, res) => {
  try {
    console.log('🔄 Delete PayPal account request received');
    const userId = req.user._id;
    const { accountId } = req.params;

    console.log('Delete PayPal account params:', { userId, accountId });

    const account = await PaypalAccount.findOne({
      _id: accountId,
      user: userId,
      isActive: true
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'PayPal account not found'
      });
    }

    await account.softDelete();
    console.log('✅ PayPal account deleted:', accountId);

    res.json({
      success: true,
      message: 'PayPal account deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting PayPal account:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
};

module.exports = {
  addPaypalAccount,
  getUserPaypalAccounts,
  getDefaultPaypalAccount,
  setDefaultPaypalAccount,
  verifyPaypalAccount,
  getConnectionStatus,
  deletePaypalAccount
};