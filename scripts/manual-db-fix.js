// Manual MongoDB fix script
// Run this in MongoDB shell or MongoDB Compass

// 1. Connect to your database
use souq

// 2. Check current indexes on wallets collection
print("Current indexes on wallets collection:");
db.wallets.getIndexes().forEach(function(index) {
  print("- " + JSON.stringify(index.key) + " (" + index.name + ")" + 
        (index.sparse ? " [SPARSE]" : "") + 
        (index.unique ? " [UNIQUE]" : ""));
});

// 3. Drop problematic indexes
print("\nDropping problematic indexes...");
try {
  db.wallets.dropIndex("transactions.transactionId_1");
  print("✅ Dropped transactions.transactionId_1");
} catch (e) {
  print("ℹ️ Index transactions.transactionId_1 not found: " + e.message);
}

try {
  db.wallets.dropIndex("transactions.transactionId_1_sparse");
  print("✅ Dropped transactions.transactionId_1_sparse");
} catch (e) {
  print("ℹ️ Index transactions.transactionId_1_sparse not found: " + e.message);
}

// 4. Create new sparse index
print("\nCreating new sparse index...");
try {
  db.wallets.createIndex(
    { "transactions.transactionId": 1 }, 
    { 
      sparse: true,
      name: "transactions_transactionId_sparse"
    }
  );
  print("✅ Created sparse index successfully");
} catch (e) {
  print("⚠️ Error creating sparse index: " + e.message);
}

// 5. Verify updated indexes
print("\nUpdated indexes on wallets collection:");
db.wallets.getIndexes().forEach(function(index) {
  print("- " + JSON.stringify(index.key) + " (" + index.name + ")" + 
        (index.sparse ? " [SPARSE]" : "") + 
        (index.unique ? " [UNIQUE]" : ""));
});

// 6. Count wallets to verify collection is accessible
print("\nWallet collection stats:");
print("Total wallets: " + db.wallets.countDocuments());
print("Wallets with empty transactions: " + db.wallets.countDocuments({
  $or: [
    { transactions: { $exists: false } },
    { transactions: { $size: 0 } }
  ]
}));
print("Wallets with transactions: " + db.wallets.countDocuments({
  transactions: { $exists: true, $not: { $size: 0 } }
}));

print("\n🎉 Manual database fix completed!");
print("💡 You can now test the wallet API: GET /api/user/wallet");
