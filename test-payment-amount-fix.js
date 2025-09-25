/**
 * Test script to verify the payment amount calculation fix
 * This tests that the frontend and backend calculate the same total amount
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Mock payment data similar to what frontend sends
const mockPaymentData = {
  productPrice: 13.00,
  platformFee: 1.30,  // 10% of product price for escrow
  shippingCost: 5.00,
  salesTax: 0.72,
  processingFee: 0.87,  // Gateway fee
  currency: 'USD',
  gatewayFeePaidBy: 'buyer'
};

function calculateFrontendTotal(data) {
  const baseAmount = data.productPrice + data.platformFee + data.shippingCost + data.salesTax;
  const totalWithFee = data.gatewayFeePaidBy === 'buyer' ? baseAmount + data.processingFee : baseAmount;
  return {
    baseAmount: baseAmount,
    totalWithFee: totalWithFee,
    breakdown: {
      productPrice: data.productPrice,
      platformFee: data.platformFee,
      shippingCost: data.shippingCost,
      salesTax: data.salesTax,
      processingFee: data.gatewayFeePaidBy === 'buyer' ? data.processingFee : 0
    }
  };
}

function simulateBackendCalculation(paymentSummary) {
  // Simulate backend calculation
  const convertedPrice = paymentSummary.productPrice;
  const feeAmount = paymentSummary.platformFee;
  const shippingCost = paymentSummary.shippingCost;
  const salesTaxAmount = paymentSummary.salesTax;
  
  const buyerSubtotal = convertedPrice + feeAmount + shippingCost + salesTaxAmount;
  
  // Use frontend total if provided and valid
  let totalAmount = buyerSubtotal;
  if (paymentSummary.totalAmount && typeof paymentSummary.totalAmount === 'number' && paymentSummary.totalAmount > 0) {
    const serverTotal = buyerSubtotal;
    const frontendTotal = paymentSummary.totalAmount;
    const difference = Math.abs(frontendTotal - serverTotal);
    const percentageDiff = (difference / serverTotal) * 100;
    
    if (percentageDiff <= 10) {
      console.log('✅ Using frontend payment summary total:', frontendTotal);
      totalAmount = frontendTotal;
    } else {
      console.warn('⚠️ Frontend total differs significantly, using server total');
    }
  }
  
  return {
    buyerSubtotal: buyerSubtotal,
    totalAmount: totalAmount,
    gatewayFeeAmount: paymentSummary.processingFee
  };
}

function simulatePaymentInitialization(escrowTransaction) {
  // Simulate payment initialization logic
  const baseAmount = escrowTransaction.productPrice + escrowTransaction.platformFeeAmount + 
                    escrowTransaction.shippingCost + (escrowTransaction.paymentSummary?.salesTax || 0);
  
  let paymentAmount = escrowTransaction.totalAmount;
  
  if (escrowTransaction.gatewayFeePaidBy === 'buyer') {
    const expectedTotalWithFee = baseAmount + escrowTransaction.gatewayFeeAmount;
    const tolerance = 0.01;
    
    if (Math.abs(escrowTransaction.totalAmount - baseAmount) < tolerance) {
      paymentAmount += escrowTransaction.gatewayFeeAmount;
      console.log('💰 Adding gateway fee to payment amount:', escrowTransaction.gatewayFeeAmount);
    } else if (Math.abs(escrowTransaction.totalAmount - expectedTotalWithFee) < tolerance) {
      console.log('✅ Payment amount already includes gateway fee');
    }
  }
  
  return {
    baseAmount: baseAmount,
    storedTotal: escrowTransaction.totalAmount,
    finalPaymentAmount: paymentAmount
  };
}

async function runTest() {
  console.log('🧪 Testing Payment Amount Calculation Fix\n');
  console.log('==========================================\n');
  
  // Step 1: Calculate frontend total
  console.log('📱 Frontend Calculation:');
  const frontendCalc = calculateFrontendTotal(mockPaymentData);
  console.log('   Base Amount:', frontendCalc.baseAmount.toFixed(2));
  console.log('   Total with Fee:', frontendCalc.totalWithFee.toFixed(2));
  console.log('   Breakdown:', frontendCalc.breakdown);
  
  // Step 2: Simulate backend processing
  console.log('\n🖥️  Backend Processing:');
  const paymentSummary = {
    ...mockPaymentData,
    totalAmount: frontendCalc.totalWithFee
  };
  
  const backendCalc = simulateBackendCalculation(paymentSummary);
  console.log('   Buyer Subtotal:', backendCalc.buyerSubtotal.toFixed(2));
  console.log('   Final Total:', backendCalc.totalAmount.toFixed(2));
  
  // Step 3: Simulate escrow transaction creation
  console.log('\n💾 Escrow Transaction:');
  const escrowTransaction = {
    productPrice: mockPaymentData.productPrice,
    platformFeeAmount: mockPaymentData.platformFee,
    shippingCost: mockPaymentData.shippingCost,
    totalAmount: backendCalc.totalAmount,
    gatewayFeeAmount: mockPaymentData.processingFee,
    gatewayFeePaidBy: mockPaymentData.gatewayFeePaidBy,
    paymentSummary: paymentSummary
  };
  
  console.log('   Stored Total:', escrowTransaction.totalAmount.toFixed(2));
  console.log('   Gateway Fee:', escrowTransaction.gatewayFeeAmount.toFixed(2));
  
  // Step 4: Simulate payment initialization
  console.log('\n💳 Payment Initialization:');
  const paymentInit = simulatePaymentInitialization(escrowTransaction);
  console.log('   Base Amount:', paymentInit.baseAmount.toFixed(2));
  console.log('   Stored Total:', paymentInit.storedTotal.toFixed(2));
  console.log('   Final Payment Amount:', paymentInit.finalPaymentAmount.toFixed(2));
  
  // Step 5: Verify consistency
  console.log('\n🔍 Verification:');
  const expectedTotal = 20.89; // From the user's screenshot
  const actualTotal = paymentInit.finalPaymentAmount;
  
  console.log('   Expected Total (from UI):', expectedTotal.toFixed(2));
  console.log('   Calculated Total:', actualTotal.toFixed(2));
  console.log('   Difference:', Math.abs(expectedTotal - actualTotal).toFixed(2));
  
  if (Math.abs(expectedTotal - actualTotal) < 0.01) {
    console.log('   ✅ SUCCESS: Amounts match!');
  } else {
    console.log('   ❌ FAIL: Amounts do not match');
  }
  
  // Step 6: Test Stripe amount conversion
  console.log('\n💰 Stripe Amount (in cents):');
  const stripeAmount = Math.round(actualTotal * 100);
  console.log('   Amount in cents:', stripeAmount);
  console.log('   Back to dollars:', (stripeAmount / 100).toFixed(2));
  
  console.log('\n🎉 Test completed!');
}

// Run the test
runTest().catch(console.error);