const EscrowTransaction = require('../../db/models/escrowTransactionModel'); // Your escrow transaction model


class EscrowPaymentService {
  /**
   * Get payment details for an escrow transaction by ID
   * @param {string} transactionId
   * @returns {Promise<Object|null>} Returns { payment } or null if not found/error
   */
  static async getPayment(transactionId) {
    try {
      if (!transactionId) throw new Error('Missing transactionId');

      let payment;

      // 1) Try EscrowTransaction by ObjectId
      if (transactionId.match(/^[0-9a-fA-F]{24}$/)) {
        payment = await EscrowTransaction.findById(transactionId)
          .populate('buyer', 'firstName lastName email')
          .populate('seller', 'firstName lastName email')
          .populate('product', 'title');
      }

      // 2) Try EscrowTransaction by custom transactionId (ESC-...)
      if (!payment) {
        payment = await EscrowTransaction.findOne({ transactionId })
          .populate('buyer', 'firstName lastName email')
          .populate('seller', 'firstName lastName email')
          .populate('product', 'title');
      }

      // 3) Fallback: If provided ID is a transaction record ID, resolve to escrowTransaction
      if (!payment) {
        try {
          const Transaction = require('../../db/models/transactionModel');
          const tx = await Transaction.findOne({
            $or: [
              { transactionId: transactionId },
              { gatewayTransactionId: transactionId }
            ]
          }).populate('escrowTransaction');

          if (tx?.escrowTransaction?._id) {
            payment = await EscrowTransaction.findById(tx.escrowTransaction._id)
              .populate('buyer', 'firstName lastName email')
              .populate('seller', 'firstName lastName email')
              .populate('product', 'title');
          }
        } catch (e) {
          // Safe ignore; will handle not found below
        }
      }

      if (!payment) {
        throw new Error(`Escrow payment record not found for id: ${transactionId}`);
      }

      return { payment };
    } catch (error) {
      console.error('[EscrowPaymentService] getPayment error:', error);
      return null;
    }
  }

  // ... other escrow payment methods ...

}

module.exports = EscrowPaymentService;