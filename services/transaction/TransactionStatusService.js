const { findStandardPayment, findEscrowTransaction } = require('../../utils/transactionUtils');
const Order = require('../../db/models/orderModel');

class TransactionStatusService {
  
  /**
   * Update transaction status and trigger related actions
   */
  static async updateTransactionStatus(transactionId, newStatus, updatedBy = 'system', notes = '') {
    try {
      console.log(`🔄 Updating transaction ${transactionId} to status: ${newStatus}`);
      
      // Find the transaction (try both types)
      let transaction = await findEscrowTransaction(transactionId, true);
      let transactionType = 'escrow';
      
      if (!transaction) {
        transaction = await findStandardPayment(transactionId, true);
        transactionType = 'standard';
      }
      
      if (!transaction) {
        throw new Error(`Transaction not found: ${transactionId}`);
      }
      
      const oldStatus = transaction.status;
      
      // Validate status transition
      if (!this.isValidStatusTransition(oldStatus, newStatus, transactionType)) {
        throw new Error(`Invalid status transition from ${oldStatus} to ${newStatus}`);
      }
      
      // Update transaction status
      transaction.status = newStatus;
      transaction.statusHistory = transaction.statusHistory || [];
      transaction.statusHistory.push({
        status: newStatus,
        timestamp: new Date(),
        updatedBy,
        notes,
        previousStatus: oldStatus
      });
      
      await transaction.save();
      
      // Update related order status
      await this.updateRelatedOrderStatus(transaction, newStatus);
      
      // Trigger status-specific actions
      await this.handleStatusActions(transaction, newStatus, transactionType);
      
      console.log(`✅ Transaction ${transactionId} updated from ${oldStatus} to ${newStatus}`);
      
      return {
        success: true,
        transaction,
        oldStatus,
        newStatus
      };
      
    } catch (error) {
      console.error('❌ Error updating transaction status:', error);
      throw error;
    }
  }
  
  /**
   * Validate if status transition is allowed
   */
  static isValidStatusTransition(currentStatus, newStatus, transactionType) {
    const escrowTransitions = {
      'pending': ['processing', 'cancelled', 'failed'],
      'processing': ['payment_confirmed', 'funds_held', 'failed', 'cancelled'],
      'payment_confirmed': ['funds_held', 'failed'],
      'funds_held': ['shipped', 'cancelled', 'dispute_opened'],
      'shipped': ['in_transit', 'delivered', 'dispute_opened'],
      'in_transit': ['delivered', 'dispute_opened'],
      'delivered': ['completed', 'dispute_opened'],
      'completed': ['refunded'], // Only in special cases
      'dispute_opened': ['dispute_resolved', 'refunded', 'completed'],
      'dispute_resolved': ['completed', 'refunded'],
      'cancelled': [], // Terminal state
      'failed': ['pending'], // Can retry
      'refunded': [] // Terminal state
    };
    
    const standardTransitions = {
      'pending': ['processing', 'cancelled', 'failed'],
      'processing': ['completed', 'failed', 'cancelled'],
      'completed': ['shipped', 'refunded'],
      'shipped': ['in_transit', 'delivered'],
      'in_transit': ['delivered'],
      'delivered': ['completed'],
      'cancelled': [], // Terminal state
      'failed': ['pending'], // Can retry
      'refunded': [] // Terminal state
    };
    
    const transitions = transactionType === 'escrow' ? escrowTransitions : standardTransitions;
    const allowedTransitions = transitions[currentStatus] || [];
    
    return allowedTransitions.includes(newStatus);
  }
  
  /**
   * Update related order status based on transaction status
   */
  static async updateRelatedOrderStatus(transaction, transactionStatus) {
    try {
      // Find related order
      const order = await Order.findOne({
        $or: [
          { 'payment.transactionId': transaction.transactionId },
          { buyer: transaction.buyer, seller: transaction.seller, product: transaction.product }
        ]
      });
      
      if (!order) {
        console.log('⚠️ No related order found for transaction:', transaction.transactionId);
        return;
      }
      
      // Map transaction status to order status
      const statusMapping = {
        'pending': 'pending',
        'processing': 'processing',
        'payment_confirmed': 'paid',
        'funds_held': 'paid',
        'shipped': 'shipped',
        'in_transit': 'shipped',
        'delivered': 'delivered',
        'completed': 'completed',
        'cancelled': 'cancelled',
        'failed': 'failed',
        'refunded': 'refunded'
      };
      
      const newOrderStatus = statusMapping[transactionStatus];
      if (newOrderStatus && order.status !== newOrderStatus) {
        order.status = newOrderStatus;
        order.timeline = order.timeline || [];
        order.timeline.push({
          status: newOrderStatus,
          timestamp: new Date(),
          description: `Order status updated due to transaction status: ${transactionStatus}`,
          updatedBy: 'system'
        });
        
        await order.save();
        console.log(`✅ Order ${order.orderNumber} status updated to: ${newOrderStatus}`);
      }
      
    } catch (error) {
      console.error('❌ Error updating related order status:', error);
    }
  }
  
  /**
   * Handle status-specific actions (notifications, webhooks, etc.)
   */
  static async handleStatusActions(transaction, status, transactionType) {
    try {
      switch (status) {
        case 'payment_confirmed':
        case 'funds_held':
          // Notify seller that payment is secured
          await this.notifyPaymentSecured(transaction);
          break;
          
        case 'shipped':
          // Notify buyer that item is shipped
          await this.notifyItemShipped(transaction);
          break;
          
        case 'delivered':
          // Start delivery confirmation timer
          await this.startDeliveryConfirmationTimer(transaction);
          break;
          
        case 'completed':
          // Release funds to seller, notify both parties
          await this.handleTransactionCompletion(transaction, transactionType);
          break;
          
        case 'cancelled':
        case 'refunded':
          // Handle refunds
          await this.handleRefund(transaction, transactionType);
          break;
          
        case 'dispute_opened':
          // Notify admin and both parties
          await this.notifyDisputeOpened(transaction);
          break;
      }
    } catch (error) {
      console.error('❌ Error handling status actions:', error);
    }
  }
  
  /**
   * Get transaction progress percentage
   */
  static getTransactionProgress(status, transactionType) {
    const escrowSteps = ['pending', 'processing', 'funds_held', 'shipped', 'delivered', 'completed'];
    const standardSteps = ['pending', 'processing', 'shipped', 'delivered', 'completed'];
    
    const steps = transactionType === 'escrow' ? escrowSteps : standardSteps;
    const currentIndex = steps.indexOf(status);
    
    if (currentIndex === -1) return 0;
    return Math.round(((currentIndex + 1) / steps.length) * 100);
  }
  
  /**
   * Get next possible statuses for a transaction
   */
  static getNextPossibleStatuses(currentStatus, transactionType) {
    const escrowTransitions = {
      'pending': ['processing', 'cancelled'],
      'processing': ['payment_confirmed', 'funds_held'],
      'payment_confirmed': ['funds_held'],
      'funds_held': ['shipped', 'cancelled'],
      'shipped': ['in_transit', 'delivered'],
      'in_transit': ['delivered'],
      'delivered': ['completed'],
      'completed': [],
      'cancelled': [],
      'failed': ['pending']
    };
    
    const standardTransitions = {
      'pending': ['processing', 'cancelled'],
      'processing': ['completed'],
      'completed': ['shipped'],
      'shipped': ['in_transit', 'delivered'],
      'in_transit': ['delivered'],
      'delivered': [],
      'cancelled': [],
      'failed': ['pending']
    };
    
    const transitions = transactionType === 'escrow' ? escrowTransitions : standardTransitions;
    return transitions[currentStatus] || [];
  }
  
  // Placeholder methods for notifications and actions
  static async notifyPaymentSecured(transaction) {
    console.log('📧 Notifying payment secured for transaction:', transaction.transactionId);
    // Implement notification logic
  }
  
  static async notifyItemShipped(transaction) {
    console.log('📧 Notifying item shipped for transaction:', transaction.transactionId);
    // Implement notification logic
  }
  
  static async startDeliveryConfirmationTimer(transaction) {
    console.log('⏰ Starting delivery confirmation timer for transaction:', transaction.transactionId);
    // Implement timer logic
  }
  
  static async handleTransactionCompletion(transaction, transactionType) {
    console.log('✅ Handling transaction completion for:', transaction.transactionId);
    // Implement completion logic (release funds, etc.)
  }
  
  static async handleRefund(transaction, transactionType) {
    console.log('💰 Handling refund for transaction:', transaction.transactionId);
    // Implement refund logic
  }
  
  static async notifyDisputeOpened(transaction) {
    console.log('⚠️ Notifying dispute opened for transaction:', transaction.transactionId);
    // Implement dispute notification logic
  }
}

module.exports = TransactionStatusService;
