require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./db');
const WithdrawalTransaction = require('./db/models/withdrawalTransactionModel');
const Wallet = require('./db/models/walletModel');
const User = require('./db/models/userModel');
const PaypalAccount = require('./db/models/paypalAccountModel');

async function testWithdrawalSystem() {
  try {
    console.log('🔄 Connecting to database...');
    await connectDB();

    // Find a test user
    const testUser = await User.findOne({ email: { $regex: /test/i } });
    if (!testUser) {
      console.log('❌ No test user found. Please create a test user first.');
      return;
    }

    console.log('👤 Using test user:', testUser.email);

    // Check if user has a wallet
    let wallet = await Wallet.findOne({ user: testUser._id });
    if (!wallet) {
      console.log('💰 Creating wallet for test user...');
      wallet = new Wallet({
        user: testUser._id,
        balances: [
          { currency: 'USD', amount: 1000.00 },
          { currency: 'AED', amount: 3673.00 }
        ]
      });
      await wallet.save();
    }

    console.log('💰 Current wallet balance:', wallet.balances);

    // Check if user has a PayPal account
    let paypalAccount = await PaypalAccount.findOne({ user: testUser._id });
    if (!paypalAccount) {
      console.log('📧 Creating PayPal account for test user...');
      paypalAccount = new PaypalAccount({
        user: testUser._id,
        email: 'test-paypal@example.com',
        accountType: 'personal',
        isVerified: true,
        isActive: true
      });
      await paypalAccount.save();
    }

    console.log('📧 PayPal account:', paypalAccount.email);

    // Create a test withdrawal transaction
    console.log('🔄 Creating test withdrawal transaction...');
    const withdrawalTransaction = new WithdrawalTransaction({
      user: testUser._id,
      amount: 100.00,
      currency: 'USD',
      withdrawalMethod: 'paypal',
      description: 'Test withdrawal',
      paymentProvider: 'paypal',
      paypalAccount: {
        accountId: paypalAccount._id,
        email: paypalAccount.email,
        accountType: paypalAccount.accountType
      },
      metadata: {
        testTransaction: true,
        createdBy: 'test-script'
      }
    });

    await withdrawalTransaction.save();

    console.log('✅ Withdrawal transaction created:', {
      transactionId: withdrawalTransaction.transactionId,
      amount: withdrawalTransaction.amount,
      netAmount: withdrawalTransaction.netAmount,
      fees: withdrawalTransaction.fees,
      status: withdrawalTransaction.status
    });

    // Test status updates
    console.log('🔄 Testing status updates...');
    
    await withdrawalTransaction.updateStatus('processing', 'Payout sent to PayPal', 'system');
    console.log('✅ Status updated to processing');

    await withdrawalTransaction.updateStatus('completed', 'Payout completed successfully', 'webhook');
    console.log('✅ Status updated to completed');

    // Test statistics
    console.log('📊 Testing withdrawal statistics...');
    const stats = await WithdrawalTransaction.getWithdrawalStats(testUser._id, '30d');
    console.log('📊 Withdrawal stats:', stats);

    // Test user withdrawals query
    console.log('📋 Testing user withdrawals query...');
    const userWithdrawals = await WithdrawalTransaction.findUserWithdrawals(testUser._id, {
      limit: 5
    });
    console.log('📋 User withdrawals:', userWithdrawals.length, 'found');

    console.log('✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the test
testWithdrawalSystem();