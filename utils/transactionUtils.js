const mongoose = require('mongoose');

/**
 * Utility functions for handling transaction lookups
 */

/**
 * Check if a string is a valid MongoDB ObjectId
 * @param {string} id - The ID to check
 * @returns {boolean} True if valid ObjectId format
 */
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id) && /^[0-9a-fA-F]{24}$/.test(id);
};

/**
 * Find a transaction by transactionId or _id
 * @param {Object} Model - Mongoose model to search
 * @param {string} identifier - Transaction ID or MongoDB _id
 * @param {Object} populateOptions - Fields to populate
 * @returns {Promise<Object|null>} Found transaction or null
 */
const findTransactionByIdentifier = async (Model, identifier, populateOptions = {}) => {
  try {
    console.log(`🔍 Looking for ${Model.modelName} with identifier: ${identifier}`);

    // First try by transactionId field
    let query = Model.findOne({ transactionId: identifier });

    // Apply population options
    if (populateOptions.buyer) {
      query = query.populate('buyer', populateOptions.buyer);
    }
    if (populateOptions.seller) {
      query = query.populate('seller', populateOptions.seller);
    }
    if (populateOptions.product) {
      query = query.populate('product', populateOptions.product);
    }
    if (populateOptions.escrowTransaction) {
      query = query.populate('escrowTransaction', populateOptions.escrowTransaction);
    }

    let transaction = await query;
    if (transaction) {
      return transaction;
    }
    
    console.log(`✅ Found by transactionId: ${transaction}`);
    // If not found, try by gatewayTransactionId (for Stripe payment intent IDs)
    if (!transaction) {
      console.log(`🔍 Not found by transactionId, trying by gatewayTransactionId: ${identifier}`);

      query = Model.findOne({ gatewayTransactionId: identifier });

      // Apply population options
      if (populateOptions.buyer) {
        query = query.populate('buyer', populateOptions.buyer);
      }
      if (populateOptions.seller) {
        query = query.populate('seller', populateOptions.seller);
      }
      if (populateOptions.product) {
        query = query.populate('product', populateOptions.product);
      }
      if (populateOptions.escrowTransaction) {
        query = query.populate('escrowTransaction', populateOptions.escrowTransaction);
      }

      transaction = await query;
    }

    // For escrow transactions, also try to find by order ID
    if (!transaction && Model.modelName === 'EscrowTransaction') {
      console.log(`🔍 Not found by transactionId or gatewayTransactionId, trying to find escrow by order ID: ${identifier}`);

      // Check if identifier is a valid ObjectId before using findById
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(identifier)) {
        const Order = require('../db/models/orderModel');
        const order = await Order.findById(identifier);

        if (order && order.type === 'escrow') {
        console.log(`🔍 Found order with ID ${identifier}, looking for corresponding escrow transaction`);

        // Try to find escrow transaction by order number or other criteria
        query = Model.findOne({
          $or: [
            { transactionId: order.orderNumber },
            { transactionId: order.payment?.transactionId },
            // Add more search criteria if needed
          ]
        });

        // Apply population options
        if (populateOptions.buyer) {
          query = query.populate('buyer', populateOptions.buyer);
        }
        if (populateOptions.seller) {
          query = query.populate('seller', populateOptions.seller);
        }
        if (populateOptions.product) {
          query = query.populate('product', populateOptions.product);
        }

        transaction = await query;

        if (transaction) {
          console.log(`✅ Found escrow transaction via order lookup: ${transaction._id}`);
        }
        }
      } else {
        console.log(`⚠️ Invalid ObjectId format: ${identifier}, skipping _id lookup`);
      }
    }

    // For standard payments, also try to find by order ID
    if (!transaction && Model.modelName === 'StandardPayment') {
      console.log(`🔍 Not found by transactionId or gatewayTransactionId, trying to find standard payment by order ID: ${identifier}`);

      // Check if identifier is a valid ObjectId before using findById
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(identifier)) {
        const Order = require('../db/models/orderModel');
        const order = await Order.findById(identifier);

        if (order && order.type === 'standard' && order.payment?.paymentId) {
          console.log(`🔍 Found order with ID ${identifier}, looking for corresponding standard payment: ${order.payment.paymentId}`);

          // Try to find standard payment by the payment ID from the order
          query = Model.findById(order.payment.paymentId);

          // Apply population options
          if (populateOptions.buyer) {
            query = query.populate('buyer', populateOptions.buyer);
          }
          if (populateOptions.seller) {
            query = query.populate('seller', populateOptions.seller);
          }
          if (populateOptions.product) {
            query = query.populate('product', populateOptions.product);
          }

          transaction = await query;

          if (transaction) {
            console.log(`✅ Found standard payment via order lookup: ${transaction._id}`);
          }
        }
      } else {
        console.log(`⚠️ Invalid ObjectId format: ${identifier}, skipping _id lookup`);
      }
    }

    // If still not found and identifier looks like an ObjectId, try by _id
    if (!transaction && isValidObjectId(identifier)) {
      console.log(`🔍 Not found by other methods, trying by _id: ${identifier}`);

      query = Model.findById(identifier);

      // Apply population options
      if (populateOptions.buyer) {
        query = query.populate('buyer', populateOptions.buyer);
      }
      if (populateOptions.seller) {
        query = query.populate('seller', populateOptions.seller);
      }
      if (populateOptions.product) {
        query = query.populate('product', populateOptions.product);
      }
      if (populateOptions.escrowTransaction) {
        query = query.populate('escrowTransaction', populateOptions.escrowTransaction);
      }

      transaction = await query;
    }

    if (transaction) {
      console.log(`✅ Found ${Model.modelName}: ${transaction._id} (transactionId: ${transaction.transactionId})`);
    } else {
      console.log(`❌ ${Model.modelName} not found with identifier: ${identifier}`);
    }

    return transaction;
  } catch (error) {
    console.error(`❌ Error finding ${Model.modelName}:`, error);

    // If it's a CastError, it means the identifier is not a valid ObjectId
    if (error.name === 'CastError') {
      console.log(`⚠️ Invalid ObjectId format: ${identifier}, skipping _id lookup`);
      return null;
    }

    throw error;
  }
};

/**
 * Find escrow transaction by identifier
 * @param {string} identifier - Transaction ID or MongoDB _id
 * @param {boolean} withPopulate - Whether to populate related fields
 * @returns {Promise<Object|null>} Found escrow transaction or null
 */
const findEscrowTransaction = async (identifier, withPopulate = true) => {
  const EscrowTransaction = require('../db/models/escrowTransactionModel');
  
  const populateOptions = withPopulate ? {
    buyer: '_id firstName lastName email username',
    seller: '_id firstName lastName email username',
    product: 'title price product_photos'
  } : {};
  
  return await findTransactionByIdentifier(EscrowTransaction, identifier, populateOptions);
};

/**
 * Find standard payment by identifier
 * @param {string} identifier - Transaction ID or MongoDB _id
 * @param {boolean} withPopulate - Whether to populate related fields
 * @returns {Promise<Object|null>} Found standard payment or null
 */
const findStandardPayment = async (identifier, withPopulate = true) => {
  const StandardPayment = require('../db/models/standardPaymentModel');

  const populateOptions = withPopulate ? {
    buyer: '_id firstName lastName email username',
    seller: '_id firstName lastName email username',
    product: 'title price product_photos'
  } : {};

  // First try the standard lookup
  let payment = await findTransactionByIdentifier(StandardPayment, identifier, populateOptions);

  // If not found and identifier looks like an order transaction ID (TXN_*),
  // try to find by looking up the order first
  if (!payment && identifier.startsWith('TXN_')) {
    console.log(`🔍 Standard payment not found directly, trying order lookup for: ${identifier}`);

    try {
      const Order = require('../db/models/orderModel');

      // Find order by orderNumber (which might match the identifier)
      const order = await Order.findOne({ orderNumber: identifier });

      if (order && order.type === 'standard' && order.payment?.paymentId) {
        console.log(`✅ Found order with orderNumber ${identifier}, looking for payment: ${order.payment.paymentId}`);

        // Try to find standard payment by the payment ID from the order
        payment = await findTransactionByIdentifier(StandardPayment, order.payment.paymentId, populateOptions);

        if (payment) {
          console.log(`✅ Found standard payment via order lookup: ${payment._id}`);
        }
      }
    } catch (error) {
      console.error('❌ Error in order lookup for standard payment:', error);
    }
  }

  return payment;
};

/**
 * Find transaction by identifier in the main transactions table
 * @param {string} identifier - Transaction ID or MongoDB _id
 * @param {boolean} withPopulate - Whether to populate related fields
 * @returns {Promise<Object|null>} Found transaction or null
 */
const findTransaction = async (identifier, withPopulate = true) => {
  const Transaction = require('../db/models/transactionModel');

  const populateOptions = withPopulate ? {
    buyer: '_id firstName lastName email username',
    seller: '_id firstName lastName email username',
    product: 'title price product_photos',
    escrowTransaction: 'status amount currency'
  } : {};

  return await findTransactionByIdentifier(Transaction, identifier, populateOptions);
};

/**
 * Generate a unique transaction ID
 * @param {string} prefix - Prefix for the transaction ID
 * @returns {string} Unique transaction ID
 */
const generateTransactionId = (prefix = 'TXN') => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 6).toUpperCase();
  return `${prefix}_${timestamp}_${random}`;
};

/**
 * Validate transaction status transition
 * @param {string} currentStatus - Current transaction status
 * @param {string} newStatus - New status to transition to
 * @param {Array} validTransitions - Array of valid status transitions
 * @returns {boolean} True if transition is valid
 */
const isValidStatusTransition = (currentStatus, newStatus, validTransitions) => {
  const transition = validTransitions.find(t => 
    t.from === currentStatus && t.to === newStatus
  );
  return !!transition;
};

/**
 * Common escrow status transitions
 */
const ESCROW_STATUS_TRANSITIONS = [
  { from: 'pending_payment', to: 'payment_processing' },
  { from: 'payment_processing', to: 'payment_failed' },
  { from: 'payment_processing', to: 'funds_held' },
  { from: 'funds_held', to: 'shipped' },
  { from: 'shipped', to: 'delivered' },
  { from: 'delivered', to: 'completed' },
  { from: 'funds_held', to: 'disputed' },
  { from: 'shipped', to: 'disputed' },
  { from: 'delivered', to: 'disputed' },
  { from: 'disputed', to: 'completed' },
  { from: 'disputed', to: 'refunded' },
  { from: 'pending_payment', to: 'cancelled' },
  { from: 'payment_failed', to: 'cancelled' }
];

/**
 * Common standard payment status transitions
 */
const STANDARD_STATUS_TRANSITIONS = [
  { from: 'pending', to: 'processing' },
  { from: 'processing', to: 'completed' },
  { from: 'processing', to: 'failed' },
  { from: 'pending', to: 'cancelled' },
  { from: 'failed', to: 'cancelled' }
];

module.exports = {
  isValidObjectId,
  findTransactionByIdentifier,
  findEscrowTransaction,
  findStandardPayment,
  findTransaction,
  generateTransactionId,
  isValidStatusTransition,
  ESCROW_STATUS_TRANSITIONS,
  STANDARD_STATUS_TRANSITIONS
};
