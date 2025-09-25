const mongoose = require('mongoose');
require('dotenv').config();

async function testUserIsolation() {
  try {
    console.log('🧪 Testing wallet user isolation...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/souq');
    console.log('✅ Connected to MongoDB');
    
    // Import models
    const Wallet = require('./db/models/walletModel');
    const User = require('./db/models/userModel');
    
    // Get all users and wallets
    const allUsers = await User.find({}).select('_id firstName lastName email');
    const allWallets = await Wallet.find({}).populate('user', 'firstName lastName email');
    
    console.log(`\n📊 Database Overview:`);
    console.log(`   - Total users: ${allUsers.length}`);
    console.log(`   - Total wallets: ${allWallets.length}`);
    
    console.log(`\n👥 All Users in System:`);
    allUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user._id} - ${user.firstName} ${user.lastName} (${user.email})`);
    });
    
    console.log(`\n💰 All Wallets in System:`);
    allWallets.forEach((wallet, index) => {
      const user = wallet.user;
      const balanceStr = Object.entries(wallet.balances || {})
        .map(([currency, amount]) => `${currency}: ${amount}`)
        .join(', ') || 'No balance';
      
      console.log(`   ${index + 1}. Wallet ${wallet._id}`);
      console.log(`      - User: ${user._id} (${user.firstName} ${user.lastName})`);
      console.log(`      - Email: ${user.email}`);
      console.log(`      - Balance: ${balanceStr}`);
      console.log(`      - Transactions: ${wallet.transactions.length}`);
    });
    
    // Test wallet isolation for each user
    console.log(`\n🔍 Testing Wallet Isolation:`);
    
    for (const user of allUsers) {
      console.log(`\n   Testing user: ${user.firstName} ${user.lastName} (${user._id})`);
      
      // Find wallet for this specific user
      const userWallet = await Wallet.findOne({ user: user._id });
      
      if (userWallet) {
        console.log(`   ✅ User has wallet: ${userWallet._id}`);
        console.log(`      - Balance: ${JSON.stringify(userWallet.balances)}`);
        console.log(`      - Transactions: ${userWallet.transactions.length}`);
        
        // Verify wallet belongs to correct user
        if (userWallet.user.toString() === user._id.toString()) {
          console.log(`   ✅ Wallet correctly belongs to user`);
        } else {
          console.log(`   ❌ Wallet ownership mismatch!`);
          console.log(`      - Wallet user: ${userWallet.user}`);
          console.log(`      - Expected user: ${user._id}`);
        }
      } else {
        console.log(`   ⚠️ User has no wallet`);
      }
    }
    
    // Check for any orphaned wallets
    console.log(`\n🔍 Checking for Orphaned Wallets:`);
    const orphanedWallets = [];
    
    for (const wallet of allWallets) {
      const userExists = allUsers.some(user => user._id.toString() === wallet.user._id.toString());
      if (!userExists) {
        orphanedWallets.push(wallet);
      }
    }
    
    if (orphanedWallets.length > 0) {
      console.log(`   ❌ Found ${orphanedWallets.length} orphaned wallets:`);
      orphanedWallets.forEach(wallet => {
        console.log(`      - Wallet ${wallet._id} belongs to non-existent user ${wallet.user._id}`);
      });
    } else {
      console.log(`   ✅ No orphaned wallets found`);
    }
    
    // Test creating wallets for users without them
    console.log(`\n🔧 Testing Wallet Creation:`);
    
    for (const user of allUsers) {
      const existingWallet = await Wallet.findOne({ user: user._id });
      
      if (!existingWallet) {
        console.log(`   Creating wallet for user: ${user.firstName} ${user.lastName}`);
        
        try {
          const newWallet = await Wallet.findOrCreateWallet(user._id);
          console.log(`   ✅ Wallet created: ${newWallet._id}`);
          
          // Verify the wallet was created correctly
          if (newWallet.user.toString() === user._id.toString()) {
            console.log(`   ✅ Wallet correctly assigned to user`);
          } else {
            console.log(`   ❌ Wallet assignment error!`);
          }
        } catch (createError) {
          console.log(`   ❌ Failed to create wallet: ${createError.message}`);
        }
      }
    }
    
    // Final verification
    console.log(`\n🎯 Final Verification:`);
    const finalWallets = await Wallet.find({}).populate('user', 'firstName lastName email');
    const finalUsers = await User.find({}).select('_id firstName lastName email');
    
    console.log(`   - Users: ${finalUsers.length}`);
    console.log(`   - Wallets: ${finalWallets.length}`);
    
    // Check if each user has exactly one wallet
    let isolationPassed = true;
    
    for (const user of finalUsers) {
      const userWallets = finalWallets.filter(w => w.user._id.toString() === user._id.toString());
      
      if (userWallets.length === 0) {
        console.log(`   ❌ User ${user.firstName} ${user.lastName} has no wallet`);
        isolationPassed = false;
      } else if (userWallets.length > 1) {
        console.log(`   ❌ User ${user.firstName} ${user.lastName} has multiple wallets (${userWallets.length})`);
        isolationPassed = false;
      } else {
        console.log(`   ✅ User ${user.firstName} ${user.lastName} has exactly one wallet`);
      }
    }
    
    if (isolationPassed) {
      console.log(`\n🎉 User isolation test PASSED - Each user has their own wallet`);
    } else {
      console.log(`\n❌ User isolation test FAILED - Issues found with wallet assignment`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack:', error.stack);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('🔌 Disconnected from MongoDB');
    }
  }
}

// Run the test
console.log('🚀 Starting user isolation test...');
testUserIsolation()
  .then(() => {
    console.log('✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
