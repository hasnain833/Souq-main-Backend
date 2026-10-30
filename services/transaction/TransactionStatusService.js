const Order = require('../../db/models/orderModel');

class TransactionStatusService {
  static async updateTransactionStatus() {
    return { success: false, error: 'Transactions disabled in COD-only mode' };
  }

  static isValidStatusTransition() {
    return false;
  }

  static async updateRelatedOrderStatus() {
        return;
      }
      
  static async handleStatusActions() {
    return;
  }

  static getTransactionProgress() {
    return 0;
  }

  static getNextPossibleStatuses() {
    return [];
  }
}

module.exports = TransactionStatusService;
