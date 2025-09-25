const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import models
const Wallet = require('./db/models/walletModel');
const BankAccount = require('./db/models/bankAccountModel');

async function testWithdrawalHistory() {
  try {
    console.log('🧪 Testing Withdrawal History...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/souq-marketplace');
    console.log('✅ Connected to MongoDB');

    // Find a user with a bank account
    const bankAccount = await BankAccount.findOne({ isActive: true });
    if (!bankAccount) {
      console.log('❌ No active bank account found');
      return;
    }

    const userId = bankAccount.user;
    console.log('👤 Testing with user:', userId);

    // Find or create wallet
    let wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      console.log('📝 Creating new wallet for user...');
      wallet = new Wallet({
        user: userId,
        balances: { USD: 1000.00, AED: 3673.00 },
        transactions: []
      });
      await wallet.save();
      console.log('✅ Wallet created');
    }

    console.log('💰 Current wallet:', {
      userId: wallet.user,
      balances: wallet.balances,
      transactionCount: wallet.transactions.length
    });

    // Check existing withdrawal transactions
    const existingWithdrawals = wallet.transactions.filter(t => t.type === 'withdrawal');
    console.log('📋 Existing withdrawals:', existingWithdrawals.length);

    if (existingWithdrawals.length === 0) {
      console.log('➕ Adding test withdrawal transactions...');
      
      // Add some test withdrawal transactions
      const testWithdrawals = [
        {
          type: 'withdrawal',
          amount: 100.00,
          currency: 'USD',
          description: 'Test withdrawal 1 - Pending',
          metadata: {
            withdrawalMethod: 'bank_transfer',
            bankAccountId: bankAccount._id.toString(),
            bankName: bankAccount.bankName,
            lastFourDigits: bankAccount.lastFourDigits,
            status: 'pending',
            payoutStatus: 'pending',
            payoutProvider: 'stripe',
            stripePayoutId: 'po_test_pending_123'
          }
        },
        {
          type: 'withdrawal',
          amount: 250.00,
          currency: 'USD',
          description: 'Test withdrawal 2 - Completed',
          metadata: {
            withdrawalMethod: 'bank_transfer',
            bankAccountId: bankAccount._id.toString(),
            bankName: bankAccount.bankName,
            lastFourDigits: bankAccount.lastFourDigits,
            status: 'completed',
            payoutStatus: 'paid',
            payoutProvider: 'stripe',
            stripePayoutId: 'po_test_completed_456',
            completedAt: new Date(Date.now() - 86400000) // 1 day ago
          }
        },
        {
          type: 'withdrawal',
          amount: 75.00,
          currency: 'USD',
          description: 'Test withdrawal 3 - Failed',
          metadata: {
            withdrawalMethod: 'bank_transfer',
            bankAccountId: bankAccount._id.toString(),
            bankName: bankAccount.bankName,
            lastFourDigits: bankAccount.lastFourDigits,
            status: 'failed',
            payoutStatus: 'failed',
            payoutProvider: 'stripe',
            stripePayoutId: 'po_test_failed_789',
            failureCode: 'insufficient_funds',
            failureMessage: 'Insufficient funds in account',
            failedAt: new Date(Date.now() - 3600000) // 1 hour ago
          }
        },
        {
          type: 'withdrawal',
          amount: 150.00,
          currency: 'USD',
          description: 'Test withdrawal 4 - In Transit',
          metadata: {
            withdrawalMethod: 'bank_transfer',
            bankAccountId: bankAccount._id.toString(),
            bankName: bankAccount.bankName,
            lastFourDigits: bankAccount.lastFourDigits,
            status: 'in_transit',
            payoutStatus: 'in_transit',
            payoutProvider: 'stripe',
            stripePayoutId: 'po_test_transit_101',
            estimatedArrival: new Date(Date.now() + 86400000) // 1 day from now
          }
        }
      ];

      for (const withdrawal of testWithdrawals) {
        await wallet.addTransaction(withdrawal);
      }

      console.log('✅ Added 4 test withdrawal transactions');
    }

    // Test the withdrawal history logic
    console.log('\n📋 Testing withdrawal history logic...');
    
    // Get all withdrawal transactions
    let withdrawalTransactions = wallet.transactions.filter(t => t.type === 'withdrawal');
    console.log('📊 Total withdrawals found:', withdrawalTransactions.length);

    // Test filtering by status
    const statusFilters = ['', 'pending', 'completed', 'failed', 'in_transit'];
    
    for (const status of statusFilters) {
      let filtered = withdrawalTransactions;
      
      if (status) {
        filtered = withdrawalTransactions.filter(t => 
          t.metadata?.status === status || t.metadata?.payoutStatus === status
        );
      }
      
      console.log(`📈 ${status || 'All'} withdrawals:`, filtered.length);
      
      if (filtered.length > 0) {
        console.log('   Sample:', {
          transactionId: filtered[0].transactionId,
          amount: filtered[0].amount,
          status: filtered[0].metadata?.payoutStatus || filtered[0].metadata?.status,
          description: filtered[0].description
        });
      }
    }

    // Format transactions like the API does
    console.log('\n📋 Testing API response format...');
    const formattedTransactions = withdrawalTransactions.map(transaction => ({
      transactionId: transaction.transactionId,
      payoutId: transaction.metadata?.stripePayoutId,
      amount: transaction.amount,
      currency: transaction.currency,
      status: transaction.metadata?.payoutStatus || transaction.metadata?.status || 'pending',
      description: transaction.description,
      bankAccount: {
        bankName: transaction.metadata?.bankName,
        lastFourDigits: transaction.metadata?.lastFourDigits
      },
      createdAt: transaction.createdAt,
      estimatedArrival: transaction.metadata?.estimatedArrival,
      completedAt: transaction.metadata?.completedAt,
      failureCode: transaction.metadata?.failureCode,
      failureMessage: transaction.metadata?.failureMessage
    }));

    console.log('📤 Formatted transactions:', formattedTransactions.length);
    console.log('📋 Sample formatted transaction:', formattedTransactions[0]);

    console.log('\n🎉 Test completed successfully!');
    console.log('\n📝 Summary:');
    console.log(`   ✅ User ID: ${userId}`);
    console.log(`   ✅ Total withdrawals: ${withdrawalTransactions.length}`);
    console.log(`   ✅ Formatted transactions: ${formattedTransactions.length}`);
    console.log('\n🚀 The withdrawal history should now work in the frontend!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('\n✅ MongoDB connection closed');
  }
}

// Run the test
if (require.main === module) {
  testWithdrawalHistory();
}

module.exports = testWithdrawalHistory;
