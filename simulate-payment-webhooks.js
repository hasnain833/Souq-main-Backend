/**
 * Script to simulate payment webhooks for testing
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/souq');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function simulatePaymentWebhooks() {
  console.log('🎭 Simulating payment webhooks...\n');
  
  try {
    const StandardPayment = require('./db/models/standardPaymentModel');
    const EscrowTransaction = require('./db/models/escrowTransactionModel');
    const Transaction = require('./db/models/transactionModel');
    
    // Find pending payments
    const pendingStandardPayments = await StandardPayment.find({ 
      status: { $in: ['pending', 'pending_payment', 'processing'] }
    }).limit(5);
    
    const pendingEscrowTransactions = await EscrowTransaction.find({ 
      status: { $in: ['pending', 'pending_payment', 'payment_processing'] }
    }).limit(5);
    
    const pendingTransactions = await Transaction.find({ 
      status: { $in: ['pending', 'pending_payment', 'processing'] }
    }).limit(5);
    
    console.log(`Found ${pendingStandardPayments.length} pending standard payments`);
    console.log(`Found ${pendingEscrowTransactions.length} pending escrow transactions`);
    console.log(`Found ${pendingTransactions.length} pending transaction records`);
    
    // Simulate standard payment webhooks
    for (const payment of pendingStandardPayments) {
      console.log(`\n🎭 Simulating webhook for StandardPayment ${payment._id}`);
      console.log(`   Transaction ID: ${payment.transactionId}`);
      
      // Simulate webhook data
      const webhookData = {
        eventType: 'payment_completed',
        transactionId: payment.transactionId,
        status: 'completed',
        amount: payment.totalAmount,
        currency: payment.currency,
        gatewayTransactionId: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };
      
      // Update payment status (simulating webhook handler)
      payment.status = 'completed';
      payment.orderStatus = 'paid';
      payment.completedAt = new Date();
      payment.gatewayTransactionId = webhookData.gatewayTransactionId;
      payment.gatewayResponse = {
        ...payment.gatewayResponse,
        completedAt: new Date(),
        finalAmount: webhookData.amount,
        finalCurrency: webhookData.currency,
        gatewayTransactionId: webhookData.gatewayTransactionId,
        simulatedWebhook: true
      };
      
      await payment.save();
      console.log(`   ✅ Updated to: ${payment.status}`);
    }
    
    // Simulate escrow transaction webhooks
    for (const transaction of pendingEscrowTransactions) {
      console.log(`\n🎭 Simulating webhook for EscrowTransaction ${transaction._id}`);
      console.log(`   Transaction ID: ${transaction.transactionId}`);
      
      const webhookData = {
        eventType: 'payment_completed',
        transactionId: transaction.transactionId,
        status: 'funds_held',
        amount: transaction.totalAmount,
        currency: transaction.currency,
        gatewayTransactionId: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };
      
      // Update transaction status
      transaction.status = 'funds_held';
      transaction.gatewayTransactionId = webhookData.gatewayTransactionId;
      transaction.gatewayResponse = {
        ...transaction.gatewayResponse,
        completedAt: new Date(),
        finalAmount: webhookData.amount,
        finalCurrency: webhookData.currency,
        gatewayTransactionId: webhookData.gatewayTransactionId,
        simulatedWebhook: true
      };
      
      await transaction.save();
      console.log(`   ✅ Updated to: ${transaction.status}`);
    }
    
    // Simulate transaction payment record webhooks
    for (const transaction of pendingTransactions) {
      console.log(`\n🎭 Simulating webhook for Transaction ${transaction._id}`);
      console.log(`   Transaction ID: ${transaction.transactionId}`);
      
      const webhookData = {
        eventType: 'payment_completed',
        transactionId: transaction.transactionId,
        status: 'completed',
        amount: transaction.amount,
        currency: transaction.currency,
        gatewayTransactionId: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };
      
      // Update transaction status
      transaction.status = 'completed';
      transaction.gatewayTransactionId = webhookData.gatewayTransactionId;
      transaction.gatewayResponse = {
        ...transaction.gatewayResponse,
        completedAt: new Date(),
        finalAmount: webhookData.amount,
        finalCurrency: webhookData.currency,
        gatewayTransactionId: webhookData.gatewayTransactionId,
        simulatedWebhook: true
      };
      
      await transaction.save();
      console.log(`   ✅ Updated to: ${transaction.status}`);
    }
    
    console.log('\n🎉 Webhook simulation completed!');
    
  } catch (error) {
    console.error('❌ Error simulating webhooks:', error);
  }
}

async function runSimulation() {
  console.log('🚀 Payment Webhook Simulation\n');
  
  try {
    await connectDB();
    await simulatePaymentWebhooks();
    console.log('\n✅ Simulation completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Simulation failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run the simulation
if (require.main === module) {
  runSimulation();
}
