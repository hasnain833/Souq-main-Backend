const PayTabsService = require('./services/payment/PayTabsService');

async function testPayTabsCurrencies() {
  console.log('🔄 Testing PayTabs currency support...');
  
  const config = {
    configuration: {
      paytabs: {
        profileId: '165428',
        serverKey: 'SJJ92MDGNB-JLK69KBKN9-KHN9TLLMRK',
        region: 'ARE'
      }
    }
  };
  
  const payTabsService = new PayTabsService(config);
  
  const testCurrencies = ['SAR', 'AED', 'USD', 'EUR'];
  
  for (const currency of testCurrencies) {
    console.log(`\n🔍 Testing currency: ${currency}`);
    
    const testPaymentData = {
      orderId: `TEST_${currency}_${Date.now()}`,
      amount: 10.00,
      currency: currency,
      description: `Test payment in ${currency}`,
      customerName: 'Test Customer',
      customerEmail: 'test@example.com',
      customerPhone: '+966500000000',
      returnUrl: 'https://example.com/return',
      cancelUrl: 'https://example.com/cancel',
      callbackUrl: 'https://example.com/callback'
    };
    
    try {
      const result = await payTabsService.initializePayment(testPaymentData);
      console.log(`✅ ${currency} - Success:`, result.success);
      if (!result.success) {
        console.log(`❌ ${currency} - Error:`, result.error);
      }
    } catch (error) {
      console.log(`❌ ${currency} - Exception:`, error.message);
    }
    
    // Wait 1 second between tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n🔍 Testing completed');
}

testPayTabsCurrencies().catch(console.error);
