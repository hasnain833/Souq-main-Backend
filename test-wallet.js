const mongoose = require('mongoose');
const Wallet = require('./db/models/walletModel');

// Test wallet functionality
async function testWallet() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/souq-test', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Test user ID (replace with actual user ID)
    const testUserId = new mongoose.Types.ObjectId();

    // Test 1: Create wallet
    console.log('\n1. Creating wallet...');
    const wallet = await Wallet.findOrCreateWallet(testUserId);
    console.log('Wallet created:', wallet._id);

    // Test 2: Credit wallet
    console.log('\n2. Crediting wallet...');
    await Wallet.creditWallet(
      testUserId,
      100,
      'USD',
      'Test payment for product sale',
      {
        relatedProduct: new mongoose.Types.ObjectId(),
        metadata: { test: true }
      }
    );

    // Test 3: Get updated wallet
    console.log('\n3. Getting updated wallet...');
    const updatedWallet = await Wallet.findOne({ user: testUserId });
    console.log('USD Balance:', updatedWallet.balances.USD);
    console.log('Total Transactions:', updatedWallet.transactions.length);
    console.log('Latest Transaction:', updatedWallet.transactions[0]);

    // Test 4: Test withdrawal check
    console.log('\n4. Testing withdrawal check...');
    const canWithdraw = updatedWallet.canWithdraw(50, 'USD');
    console.log('Can withdraw $50:', canWithdraw);

    // Test 5: Add another transaction
    console.log('\n5. Adding another transaction...');
    await updatedWallet.addTransaction({
      type: 'credit',
      amount: 25,
      currency: 'USD',
      description: 'Bonus payment',
      metadata: { bonus: true }
    });

    console.log('Final USD Balance:', updatedWallet.balances.USD);
    console.log('Total Earned:', updatedWallet.statistics.totalEarned);

    console.log('\n✅ All wallet tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the test
testWallet();