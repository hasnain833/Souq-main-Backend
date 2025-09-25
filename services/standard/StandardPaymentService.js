const Payment = require('../../db/models/standardPaymentModel'); // Your Mongoose model

class StandardPaymentService {
  /**
   * Get a payment record by its id
   * @param {string} paymentId
   * @returns {Promise<Object>} payment object, or null if not found
   */
  static async getPayment(paymentId) {
    try {
      if (!paymentId) throw new Error('Missing paymentId');
      const payment = await Payment.findById(paymentId);
      if (!payment) {
        throw new Error(`Payment record not found for id: ${paymentId}`);
      }
      return { payment };
    } catch (error) {
      console.error('[StandardPaymentService] getPayment error:', error);
      return null;
    }
  }

  /**
   * Create a new payment record
   * @param {Object} paymentData - All details for payment (amount, currency, buyer, etc)
   * @returns {Promise<Object>} Created payment record
   */
  static async createPayment(paymentData) {
    try {
      const payment = new Payment(paymentData);
      await payment.save();
      return { payment };
    } catch (error) {
      console.error('[StandardPaymentService] createPayment error:', error);
      return null;
    }
  }

  /**
   * Update payment status
   * @param {string} paymentId
   * @param {Object} updateFields
   * @returns {Promise<Object>} Updated payment
   */
  static async updatePayment(paymentId, updateFields) {
    try {
      const payment = await Payment.findByIdAndUpdate(paymentId, updateFields, { new: true });
      return { payment };
    } catch (error) {
      console.error('[StandardPaymentService] updatePayment error:', error);
      return null;
    }
  }

  /**
   * List all payments for a user
   * @param {string} userId
   * @returns {Promise<Array>} payments
   */
  static async listPaymentsForUser(userId) {
    try {
      const payments = await Payment.find({ buyer: userId });
      return payments;
    } catch (error) {
      console.error('[StandardPaymentService] listPaymentsForUser error:', error);
      return [];
    }
  }
}

module.exports = StandardPaymentService;
