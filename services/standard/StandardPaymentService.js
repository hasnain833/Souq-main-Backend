const Payment = require("../../db/models/standardPaymentModel"); // Your Mongoose model
const mongoose = require("mongoose");

class StandardPaymentService {
  static async getPayment(paymentId) {
    try {
      if (!paymentId) {
        throw new Error("Missing paymentId");
      }

      let payment = null;
      const idStr = String(paymentId).trim();

      // Use mongoose validation for ObjectId
      if (mongoose.Types.ObjectId.isValid(idStr)) {
        payment = await Payment.findById(idStr);
      }

      // If not found by _id, try transactionId
      if (!payment) {
        payment = await Payment.findOne({ transactionId: idStr });
      }

      if (!payment) {
        // don't throw for not-found — return null so caller can handle 404
        console.info(
          `[StandardPaymentService] getPayment: not found for id=${idStr}`
        );
        return null;
      }

      return { payment };
    } catch (error) {
      console.error("[StandardPaymentService] getPayment error:", error);
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
      console.error("[StandardPaymentService] createPayment error:", error);
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
      const payment = await Payment.findByIdAndUpdate(paymentId, updateFields, {
        new: true,
      });
      return { payment };
    } catch (error) {
      console.error("[StandardPaymentService] updatePayment error:", error);
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
      console.error(
        "[StandardPaymentService] listPaymentsForUser error:",
        error
      );
      return [];
    }
  }
}

module.exports = StandardPaymentService;
