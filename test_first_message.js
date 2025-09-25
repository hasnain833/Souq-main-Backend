/**
 * Simple test script to demonstrate the first message feature
 * This is not a full test suite, just a demonstration
 */

const { generateSellerWelcomeMessage } = require('./utils/chatHelpers');

// Test data - simulating different seller profiles
const testSellers = [
  {
    firstName: 'John',
    lastName: 'Doe',
    userName: 'johndoe',
    city: 'New York',
    country: 'United States',
    lastLoginAt: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
  },
  {
    firstName: 'Jane',
    lastName: 'Smith',
    userName: 'janesmith',
    city: 'London',
    country: 'United Kingdom',
    lastLoginAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
  },
  {
    firstName: null,
    lastName: null,
    userName: 'coolseller123',
    city: null,
    country: null,
    lastLoginAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
  },
  {
    firstName: 'Ahmed',
    lastName: 'Hassan',
    userName: 'ahmed_h',
    city: 'Cairo',
    country: 'Egypt',
    lastLoginAt: null // Never logged in or no data
  }
];

console.log('🧪 Testing First Message Feature\n');
console.log('=' .repeat(50));

testSellers.forEach((seller, index) => {
  console.log(`\n📝 Test Case ${index + 1}:`);
  console.log('Seller Data:', {
    name: seller.firstName && seller.lastName ? `${seller.firstName} ${seller.lastName}` : seller.userName,
    location: seller.city && seller.country ? `${seller.country}, ${seller.city}` : 'Not specified',
    lastLogin: seller.lastLoginAt ? seller.lastLoginAt.toISOString() : 'Never'
  });
  
  console.log('\n📨 Generated Welcome Message:');
  console.log('─'.repeat(30));
  const welcomeMessage = generateSellerWelcomeMessage(seller);
  console.log(welcomeMessage);
  console.log('─'.repeat(30));
});

console.log('\n✅ Test completed! The feature generates dynamic welcome messages based on seller data.');
console.log('\n🚀 To test in real application:');
console.log('1. Start the server: npm start');
console.log('2. Create a user account and login');
console.log('3. Create a product listing');
console.log('4. Use another account to click "message seller" on the product');
console.log('5. Check the chat - you should see the welcome message automatically');

// Test the time calculation function
console.log('\n⏰ Testing time calculation:');
const testTimes = [
  new Date(Date.now() - 5 * 60 * 1000),      // 5 minutes ago
  new Date(Date.now() - 45 * 60 * 1000),     // 45 minutes ago
  new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
  new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
  new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
];

testTimes.forEach((time, index) => {
  const testSeller = { ...testSellers[0], lastLoginAt: time };
  const message = generateSellerWelcomeMessage(testSeller);
  const lastSeenLine = message.split('\n').find(line => line.includes('👁'));
  console.log(`${index + 1}. ${time.toISOString()} → ${lastSeenLine}`);
});
