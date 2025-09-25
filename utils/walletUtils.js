const Wallet = require('../db/models/walletModel');

/**
 * Internal function to credit wallet (used by various services)
 */
const creditWalletInternal = async (userId, amount, currency, transactionData) => {
  try {
    console.log(`💰 Crediting wallet for user ${userId}: ${currency} ${amount}`);

    // Find or create wallet
    let wallet = await Wallet.findOne({ user: userId });

    if (!wallet) {
      console.log('📝 Creating new wallet for user');
      wallet = new Wallet({
        user: userId,
        primaryCurrency: currency,
        balances: { [currency]: 0 },
        transactions: [],
        isActive: true
      });
    }

    // Initialize balance for currency if it doesn't exist
    if (!wallet.balances) {
      wallet.balances = {};
    }
    if (!wallet.balances[currency]) {
      wallet.balances[currency] = 0;
    }

    // Add to balance
    const currentBalance = wallet.balances[currency] || 0;
    const newBalance = currentBalance + amount;
    wallet.balances[currency] = newBalance;

    // Add transaction record
    wallet.transactions.push({
      type: transactionData.type || 'sale',
      amount: amount,
      currency: currency,
      description: transactionData.description || 'Payment completion',
      transactionId: transactionData.transactionId,
      status: 'completed',
      metadata: {
        transactionType: transactionData.transactionType,
        originalAmount: amount
      }
    });

    // Update statistics
    if (!wallet.statistics) {
      wallet.statistics = {
        totalEarned: {},
        totalWithdrawn: {},
        transactionCount: 0
      };
    }

    if (!wallet.statistics.totalEarned) {
      wallet.statistics.totalEarned = {};
    }

    if (!wallet.statistics.totalEarned[currency]) {
      wallet.statistics.totalEarned[currency] = 0;
    }

    const currentEarned = wallet.statistics.totalEarned[currency] || 0;
    wallet.statistics.totalEarned[currency] = currentEarned + amount;
    wallet.statistics.transactionCount += 1;

    await wallet.save();

    console.log(`✅ Wallet credited successfully. New balance: ${currency} ${newBalance}`);

    return {
      success: true,
      newBalance: newBalance,
      currency: currency,
      amount: amount
    };

  } catch (error) {
    console.error('❌ Error crediting wallet:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Credit wallet using the Wallet model's static method (exported version)
 */
const creditWalletExternal = async (userId, amount, currency, description, relatedData = {}) => {
  try {
    console.log(`💰 Crediting wallet for user ${userId}: ${currency} ${amount}`);
    
    const wallet = await Wallet.creditWallet(userId, amount, currency, description, relatedData);
    
    console.log(`✅ Wallet credited successfully. New balance: ${currency} ${wallet.balances[currency]}`);
    
    return {
      success: true,
      wallet,
      newBalance: wallet.balances[currency]
    };
    
  } catch (error) {
    console.error('Credit wallet external error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  creditWalletInternal,
  creditWalletExternal
};
