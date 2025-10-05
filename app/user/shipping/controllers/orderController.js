const Order = require('../../../../db/models/orderModel');
// Ensure referenced models are registered before populate calls
require('../../../../db/models/offerModel');
const Transaction = require('../../../../db/models/transactionModel');
const StandardPayment = require('../../../../db/models/standardPaymentModel');
const EscrowTransaction = require('../../../../db/models/escrowTransactionModel');
const Shipment = require('../../../../db/models/shipmentModel');
const Product = require('../../../../db/models/productModel');
const User = require('../../../../db/models/userModel');
const NotificationService = require('../../../../services/NotificationService');
const TransactionStatusService = require('../../../../services/transaction/TransactionStatusService');
const OrderEmailService = require('../../../../services/OrderEmailService');
const { findStandardPayment, findEscrowTransaction } = require('../../../../utils/transactionUtils');

class OrderController {

  extractTrackingFromDescription(description) {
    if (!description) return null;

    try {
      // Pattern: "Shipped via {provider} - Tracking: {trackingNumber}"
      const trackingRegex = /Shipped via\s+([^\s-]+)\s*-\s*Tracking:\s*([^\s,;]+)/i;
      const match = description.match(trackingRegex);

      if (match && match[2]) {
        return {
          provider: match[1]?.toLowerCase() || 'unknown',
          trackingNumber: match[2].trim()
        };
      }

      // Alternative pattern: "Tracking: {trackingNumber}"
      const altRegex = /Tracking:\s*([^\s,;]+)/i;
      const altMatch = description.match(altRegex);
      
      if (altMatch && altMatch[1]) {
        return {
          provider: 'unknown',
          trackingNumber: altMatch[1].trim()
        };
      }

      return null;
    } catch (error) {
      console.error('❌ Error extracting tracking from description:', error);
      return null;
    }
  }


  async getTrackingFromTransactionStatus(transactionId) {
    try {
      console.log('🔍 Fetching tracking from transaction status:', transactionId);

      // Try to get transaction status using existing service
      let transactionData = null;
      let transactionType = null;

      // Check in StandardPayment first
      const standardPayment = await findStandardPayment(transactionId, true);
      if (standardPayment && standardPayment.statusHistory) {
        transactionData = standardPayment;
        transactionType = 'standard';
      }

      // If not found, check in EscrowTransaction  
      if (!transactionData) {
        const escrowTransaction = await findEscrowTransaction(transactionId, true);
        if (escrowTransaction && escrowTransaction.statusHistory) {
          transactionData = escrowTransaction;
          transactionType = 'escrow';
        }
      }

      if (!transactionData || !transactionData.statusHistory) {
        console.log('❌ No transaction data or status history found for:', transactionId);
        return null;
      }

      // Find the shipped status in status history
      const shippedStatus = transactionData.statusHistory.find(
        status => status.status?.toLowerCase() === 'shipped'
      );

      if (!shippedStatus || !shippedStatus.description) {
        console.log('❌ No shipped status found in history for:', transactionId);
        return null;
      }

      const trackingInfo = this.extractTrackingFromDescription(shippedStatus.description);
      
      if (trackingInfo) {
        console.log('✅ Tracking info extracted:', trackingInfo);
        return {
          trackingNumber: trackingInfo.trackingNumber,
          provider: trackingInfo.provider,
          shippedAt: shippedStatus.timestamp,
          description: shippedStatus.description
        };
      }

      return null;
    } catch (error) {
      console.error('❌ Error getting tracking from transaction status:', error);
      return null;
    }
  }

  async syncTrackingWithOrder(order, orderType, transactionId) {
    try {
      // Get tracking information from transaction status
      const trackingInfo = await this.getTrackingFromTransactionStatus(transactionId);
      
      if (!trackingInfo) {
        return order; // Return order as-is if no tracking info found
      }

      // Update the order object with tracking information
      const updatedOrder = {
        ...order,
        shipping: {
          ...order.shipping,
          trackingNumber: trackingInfo.trackingNumber,
          provider: trackingInfo.provider,
          shippedAt: trackingInfo.shippedAt
        }
      };

      // Update database record with tracking information for future reference
      try {
        const updateData = {
          'shipping.trackingNumber': trackingInfo.trackingNumber,
          'shipping.provider': trackingInfo.provider,
          'shipping.shippedAt': trackingInfo.shippedAt
        };

        if (orderType === 'standard') {
          // Also store in deliveryDetails for backward compatibility
          updateData['deliveryDetails.trackingNumber'] = trackingInfo.trackingNumber;
          updateData['deliveryDetails.carrier'] = trackingInfo.provider;
          updateData['deliveryDetails.shippedAt'] = trackingInfo.shippedAt;
          
          await StandardPayment.findByIdAndUpdate(order._id, updateData);
        } else if (orderType === 'escrow') {
          await Transaction.findByIdAndUpdate(order._id, updateData);
        }

        console.log('✅ Order updated with tracking information:', {
          orderId: order._id,
          transactionId,
          trackingNumber: trackingInfo.trackingNumber,
          provider: trackingInfo.provider
        });
      } catch (updateError) {
        console.error('❌ Error updating order with tracking info:', updateError);
        // Continue without failing - we still return the updated object
      }

      return updatedOrder;
    } catch (error) {
      console.error('❌ Error syncing tracking with order:', error);
      return order; // Return original order if sync fails
    }
  }

  mapPaymentStatusToOrderStatus(paymentStatus) {
    const statusMap = {
      // Standard payment statuses
      'completed': 'paid',
      'paid': 'paid',
      'pending': 'pending_payment',
      'processing': 'pending_payment',
      'pending_payment': 'pending_payment',

      // Escrow statuses
      'funds_held': 'paid', // Funds secured in escrow = order paid
      'payment_processing': 'pending_payment',
      'shipped': 'shipped',
      'delivered': 'delivered',

      // Common statuses
      'failed': 'cancelled',
      'cancelled': 'cancelled',
      'refunded': 'refunded'
    };
    return statusMap[paymentStatus] || 'pending_payment';
  }

  getTrackingNumberFromOrder(order, orderType) {
    // Priority order: shipping field, deliveryDetails, escrowTransaction, statusHistory
    let trackingNumber = order.shipping?.trackingNumber || 
                        order.deliveryDetails?.trackingNumber ||
                        order.escrowTransaction?.deliveryDetails?.trackingNumber;
    
    // If not found in direct fields, try to extract from status history
    if (!trackingNumber && order.statusHistory) {
      const shippedStatus = order.statusHistory.find(
        status => status.status?.toLowerCase() === 'shipped' && status.description
      );
      
      if (shippedStatus) {
        const extractedInfo = this.extractTrackingFromDescription(shippedStatus.description);
        if (extractedInfo && extractedInfo.trackingNumber) {
          trackingNumber = extractedInfo.trackingNumber;
          console.log('✅ Extracted tracking number from status history:', trackingNumber);
        }
      }
    }
    
    // If still not found and it's an escrow transaction, check escrow status history
    if (!trackingNumber && orderType === 'escrow' && order.escrowTransaction?.statusHistory) {
      const shippedStatus = order.escrowTransaction.statusHistory.find(
        status => status.status?.toLowerCase() === 'shipped' && status.note
      );
      
      if (shippedStatus) {
        const extractedInfo = this.extractTrackingFromDescription(shippedStatus.note);
        if (extractedInfo && extractedInfo.trackingNumber) {
          trackingNumber = extractedInfo.trackingNumber;
          console.log('✅ Extracted tracking number from escrow status history:', trackingNumber);
        }
      }
    }
    
    return trackingNumber || null;
  }


  getProviderFromOrder(order, orderType) {
    // Priority order: shipping field, deliveryDetails, escrowTransaction, statusHistory extraction
    let provider = order.shipping?.provider || 
                  order.deliveryDetails?.carrier ||
                  order.escrowTransaction?.deliveryDetails?.carrier;
    
    // If not found in direct fields, try to extract from status history
    if (!provider && order.statusHistory) {
      const shippedStatus = order.statusHistory.find(
        status => status.status?.toLowerCase() === 'shipped' && status.description
      );
      
      if (shippedStatus) {
        const extractedInfo = this.extractTrackingFromDescription(shippedStatus.description);
        if (extractedInfo && extractedInfo.provider && extractedInfo.provider !== 'unknown') {
          provider = extractedInfo.provider;
          console.log('✅ Extracted provider from status history:', provider);
        }
      }
    }
    
    // If still not found and it's an escrow transaction, check escrow status history
    if (!provider && orderType === 'escrow' && order.escrowTransaction?.statusHistory) {
      const shippedStatus = order.escrowTransaction.statusHistory.find(
        status => status.status?.toLowerCase() === 'shipped' && status.note
      );
      
      if (shippedStatus) {
        const extractedInfo = this.extractTrackingFromDescription(shippedStatus.note);
        if (extractedInfo && extractedInfo.provider && extractedInfo.provider !== 'unknown') {
          provider = extractedInfo.provider;
          console.log('✅ Extracted provider from escrow status history:', provider);
        }
      }
    }
    
    return provider || null;
  }


  getOrderFees(order, orderType) {
    console.log('💵 Getting order fees for type:', orderType);
    
    if (orderType === 'escrow') {
      // For escrow orders, get fees from the escrowTransaction
      const escrowTxn = order.escrowTransaction;
      
      if (escrowTxn) {
        // Get the actual amount the buyer paid (this is the real total)
        const buyerPaidTotal = order.amount || escrowTxn.totalAmount || 0;
        
        // Get individual fee components
        const productPrice = escrowTxn.productPrice || 0;
        const platformFee = escrowTxn.platformFeeAmount || 0;
        const gatewayFee = escrowTxn.gatewayFeeAmount || 0;
        
        // Get shipping fee - check multiple sources including Order record
        let shippingFee = escrowTxn.shippingCost || 0;
        
        // If shipping cost is 0 in escrow transaction, check other sources
        if (shippingFee === 0) {
          shippingFee = order.shippingCost || 
                       escrowTxn.paymentSummary?.shippingCost || 
                       order.shipping?.cost?.total || 
                       0;
        }
        
        // Calculate tax as the remaining amount after accounting for all other fees
        // Total = Product + Platform Fee + Shipping + Gateway Fee + Tax
        // Therefore: Tax = Total - Product - Platform Fee - Shipping - Gateway Fee
        const calculatedTax = Math.max(0, buyerPaidTotal - productPrice - platformFee - shippingFee - gatewayFee);
        
        // Use calculated tax, but fallback to gateway fee or other sources if calculation gives 0
        const tax = calculatedTax > 0 ? calculatedTax : (
          escrowTxn.salesTax || 
          escrowTxn.paymentSummary?.salesTax || 
          gatewayFee || 
          0
        );
        
        const fees = {
          platformFee,
          shippingFee,
          tax,
          total: buyerPaidTotal // Use the amount buyer actually paid
        };
        
        console.log('✅ Escrow fees calculated:', fees);
        console.log('🔍 Breakdown:', {
          productPrice,
          platformFee,
          shippingFee,
          gatewayFee,
          calculatedTax,
          buyerPaidTotal,
          verifySum: (productPrice + platformFee + shippingFee + gatewayFee + calculatedTax).toFixed(6)
        });
        return fees;
      } else {
        // Fallback: Try to get fees directly from Transaction record
        const fees = {
          platformFee: order.platformFeeAmount || order.fees?.platformFee || 0,
          shippingFee: order.shippingCost || order.fees?.shippingFee || 0,
          tax: order.salesTax || order.gatewayFeeAmount || 0,
          total: order.amount || order.totalAmount || 0
        };
        
        console.log('⚠️ Escrow fees from Transaction fallback:', fees);
        return fees;
      }
    } else if (orderType === 'standard') {
      // For standard payments, get fees directly from the order
      const productPrice = order.productPrice || 0;
      const platformFee = order.platformFeeAmount || 0;
      const shippingFee = order.shippingCost || 0;
      const gatewayFee = order.gatewayFeeAmount || 0;
      const salesTax = order.salesTax || 0;
      const storedTotal = order.totalAmount || order.amount || 0;
      
      // Calculate what the total should be
      const calculatedTotal = productPrice + platformFee + shippingFee + gatewayFee + salesTax;
      
      // Use the stored total if it exists, otherwise use calculated total
      const total = storedTotal > 0 ? storedTotal : calculatedTotal;
      
      // For tax, use salesTax if available, otherwise use gatewayFeeAmount
      const tax = salesTax > 0 ? salesTax : gatewayFee;
      
      const fees = {
        platformFee,
        shippingFee,
        tax,
        total
      };
      
      console.log('✅ Standard fees calculated:', fees);
      console.log('🔍 Standard breakdown:', {
        productPrice,
        platformFee,
        shippingFee,
        gatewayFee,
        salesTax,
        calculatedTotal,
        storedTotal,
        finalTotal: total
      });
      return fees;
    } else {
      // For other order types (Order collection), use basic structure
      const fees = {
        platformFee: order.payment?.fees?.platformFee || 0,
        shippingFee: order.payment?.fees?.shippingFee || 0,
        tax: order.payment?.fees?.tax || 0,
        total: order.payment?.fees?.total || 0
      };
      
      console.log('✅ Order collection fees retrieved:', fees);
      return fees;
    }
  }


  async getUserOrders(req, res) {
    try {
      const userId = req.user._id; // Use MongoDB ObjectId instead of custom UUID
      const { role = 'buyer', status, page = 1, limit = 10 } = req.query;

      console.log('🔄 Fetching orders for user:', userId, 'role:', role);

      const query = {};
      if (role === 'buyer') {
        query.buyer = userId;
      } else if (role === 'seller') {
        query.seller = userId;
      } else {
        // Both buyer and seller
        query.$or = [{ buyer: userId }, { seller: userId }];
      }

      // Add status filter if provided
      if (status) {
        query.status = status;
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const limitNum = parseInt(limit);

      // Fetch from transactions, standardpayments, and Order collection
      const [transactions, standardPayments, ordersColl] = await Promise.all([
        // Fetch escrow transactions
        Transaction.find(query)
          .populate('product', 'title price product_photos brand size condition material colors user')
          .populate('buyer', 'userName profile email')
          .populate('seller', 'userName profile email')
          .populate('escrowTransaction', 'status transactionId totalAmount currency statusHistory createdAt updatedAt platformFeeAmount shippingCost salesTax gatewayFeeAmount productPrice amount')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum),

        // Fetch standard payments
        StandardPayment.find(query)
          .populate('product', 'title price product_photos brand size condition material colors user')
          .populate('buyer', 'userName profile email')
          .populate('seller', 'userName profile email')
          .populate('offer')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum),

        // Fetch from Order collection (fully formatted orders)
        Order.find(query)
          .populate('product', 'title price product_photos brand size condition material colors user')
          .populate('buyer', 'userName profile email')
          .populate('seller', 'userName profile email')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
      ]);

      console.log('📦 Found transactions:', transactions.length);
      console.log('💳 Found standard payments:', standardPayments.length);
      console.log('🧾 Found orders (Order collection):', ordersColl.length);

      // Combine and format the results
      const combinedOrders = [];

      // Add transactions (escrow orders)
      transactions.forEach(transaction => {
        // For escrow transactions, determine order status using the same logic as getOrderDetails
        let orderStatus;
        if (transaction.orderStatus) {
          orderStatus = transaction.orderStatus;
        } else {
          const escrowStatus = transaction.escrowTransaction?.status || transaction.status;
          
          // Check if tracking information exists for shipped status
          if (transaction.shipping?.trackingNumber || transaction.deliveryDetails?.trackingNumber) {
            orderStatus = 'shipped';
          } else {
            // Use payment status mapping for escrow statuses
            orderStatus = this.mapPaymentStatusToOrderStatus(escrowStatus);
          }
        }

        console.log(`🔍 Escrow transaction mapping: ${transaction.transactionId}`);
        console.log(`   Payment record status: ${transaction.status}`);
        console.log(`   Escrow transaction status: ${transaction.escrowTransaction?.status || 'N/A'}`);
        console.log(`   Final order status: ${orderStatus}`);
        console.log(`   Has tracking: ${!!(transaction.shipping?.trackingNumber || transaction.deliveryDetails?.trackingNumber)}`);

        combinedOrders.push({
          _id: transaction._id,
          orderNumber: transaction.transactionId,
          type: 'escrow',
          buyer: transaction.buyer,
          seller: transaction.seller,
          product: transaction.product,
          status: orderStatus,
          orderDetails: {
            productPrice: transaction.amount,
            offerAmount: null,
            quantity: 1,
            currency: transaction.currency
          },
          payment: {
            method: 'escrow',
            status: transaction.escrowTransaction?.status || transaction.status, // Use the escrow status
            transactionId: transaction.transactionId,
            paymentGateway: transaction.paymentGateway,
            fees: this.getOrderFees(transaction, 'escrow') // Use consistent fee calculation
          },
          shipping: {
            toAddress: transaction.escrowTransaction?.shippingAddress || null
          },
          createdAt: transaction.createdAt,
          updatedAt: transaction.updatedAt
        });
      });

      // Add standard payments
      standardPayments.forEach(payment => {
        // Map payment status to order status
        let orderStatus = payment.orderStatus || this.mapPaymentStatusToOrderStatus(payment.status);

        combinedOrders.push({
          _id: payment._id,
          orderNumber: payment.transactionId,
          type: 'standard',
          buyer: payment.buyer,
          seller: payment.seller,
          product: payment.product,
          status: orderStatus,
          orderDetails: {
            productPrice: payment.productPrice,
            offerAmount: payment.offer ? payment.productPrice : null,
            quantity: 1,
            currency: payment.currency
          },
          payment: {
            method: 'standard',
            status: payment.status,
            transactionId: payment.transactionId,
            paymentGateway: payment.paymentGateway,
            fees: this.getOrderFees(payment, 'standard') // Use consistent fee calculation
          },
          shipping: {
            toAddress: payment.shippingAddress
          },
          createdAt: payment.createdAt,
          updatedAt: payment.updatedAt
        });
      });

      // Add orders from Order collection
      ordersColl.forEach(ord => {
        combinedOrders.push({
          _id: ord._id,
          orderNumber: ord.orderNumber || ord.payment?.transactionId,
          type: ord.payment?.method || 'standard',
          buyer: ord.buyer,
          seller: ord.seller,
          product: ord.product,
          status: ord.status,
          orderDetails: ord.orderDetails,
          payment: {
            method: ord.payment?.method,
            status: ord.payment?.status,
            transactionId: ord.payment?.transactionId,
            escrowTransactionId: ord.payment?.escrowTransactionId || null,
            paymentGateway: ord.payment?.paymentGateway,
            fees: ord.payment?.fees || {}
          },
          shipping: ord.shipping,
          createdAt: ord.createdAt,
          updatedAt: ord.updatedAt
        });
      });

      // Sort combined results by creation date
      combinedOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // Get total count for pagination
      const [transactionCount, standardPaymentCount, ordersCount] = await Promise.all([
        Transaction.countDocuments(query),
        StandardPayment.countDocuments(query),
        Order.countDocuments(query)
      ]);

      const totalOrders = transactionCount + standardPaymentCount + ordersCount;

      console.log('✅ Total orders found:', totalOrders);

      res.json({
        success: true,
        data: {
          orders: combinedOrders,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalOrders / limitNum),
            totalOrders,
            hasNext: skip + combinedOrders.length < totalOrders,
            hasPrev: parseInt(page) > 1
          }
        }
      });
    } catch (error) {
      console.error('❌ Get user orders error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch orders',
        details: error.message
      });
    }
  }

  async getOrderDetails(req, res) {
    try {
      const { orderId } = req.params;
      const userId = req.user._id; // Use MongoDB ObjectId

      console.log('🔍 Looking for order:', orderId, 'for user:', userId);

      // Try to find in transactions first
      let order = await Transaction.findById(orderId)
        .populate('product', 'title price product_photos brand size condition material colors user')
        .populate('buyer', 'userName profile email phone')
        .populate('seller', 'userName profile email phone')
        .populate('escrowTransaction', 'platformFeeAmount shippingCost salesTax gatewayFeeAmount totalAmount productPrice status deliveryDetails shippingAddress statusHistory paymentSummary amount');

      let orderType = 'escrow';

      // If not found in transactions, try standardpayments
      if (!order) {
        order = await StandardPayment.findById(orderId)
          .populate('product', 'title price product_photos brand size condition material colors user')
          .populate('buyer', 'userName profile email phone')
          .populate('seller', 'userName profile email phone')
          .populate('offer');

        orderType = 'standard';
      }

      if (!order) {
        return res.status(404).json({
          success: false,
          error: 'Order not found'
        });
      }

      // Check if user has access to this order
      if (order.buyer._id.toString() !== userId.toString() && order.seller._id.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Determine the correct order status
      let orderStatus;
      if (orderType === 'escrow') {
        // For escrow orders, check orderStatus first
        if (order.orderStatus) {
          orderStatus = order.orderStatus;
        } else {
          // Map escrow payment status to appropriate order status
          const escrowStatus = order.escrowTransaction?.status || order.status;
          
          // Check if tracking information exists for shipped status
          if (order.shipping?.trackingNumber || order.deliveryDetails?.trackingNumber) {
            orderStatus = 'shipped';
          } else {
            // Use payment status mapping for escrow statuses
            orderStatus = this.mapPaymentStatusToOrderStatus(escrowStatus);
          }
          
          console.log('🔄 Escrow status mapping:', {
            originalEscrowStatus: escrowStatus,
            mappedOrderStatus: orderStatus,
            hasTracking: !!(order.shipping?.trackingNumber || order.deliveryDetails?.trackingNumber)
          });
        }
      } else if (orderType === 'standard') {
        // For standard payments, check orderStatus field first
        if (order.orderStatus) {
          orderStatus = order.orderStatus;
        } else {
          // If no orderStatus field, determine based on payment status and tracking info
          if (order.shipping?.trackingNumber || order.deliveryDetails?.trackingNumber) {
            // If tracking information exists, order is shipped
            orderStatus = 'shipped';
          } else if (order.status === 'completed' || order.status === 'paid') {
            orderStatus = 'paid';
          } else if (order.status === 'processing') {
            // Check if payment is complete but not yet shipped
            orderStatus = 'paid'; // Processing payment means order is paid
          } else {
            orderStatus = this.mapPaymentStatusToOrderStatus(order.status);
          }
        }
      } else {
        // For Order collection, use status directly
        orderStatus = order.status;
      }

      console.log('📊 Order status determination:', {
        orderId: order._id,
        orderType,
        originalStatus: order.status,
        orderStatusField: order.orderStatus,
        hasTrackingNumber: !!(order.shipping?.trackingNumber || order.deliveryDetails?.trackingNumber),
        calculatedStatus: orderStatus
      });

      // Format order data based on type
      let formattedOrder = {
        _id: order._id,
        orderNumber: order.transactionId,
        type: orderType,
        buyer: order.buyer,
        seller: order.seller,
        product: order.product,
        status: orderStatus, // Use the calculated orderStatus
        orderDetails: {
          productPrice: orderType === 'escrow' ? order.amount : order.productPrice,
          offerAmount: orderType === 'standard' && order.offer ? order.productPrice : null,
          quantity: 1,
          currency: order.currency
        },
        payment: {
          method: orderType,
          status: orderType === 'escrow' ? (order.escrowTransaction?.status || order.status) : order.status,
          transactionId: order.transactionId,
          escrowTransactionId: orderType === 'escrow' ? order.escrowTransaction?._id : null,
          paymentGateway: order.paymentGateway,
          fees: this.getOrderFees(order, orderType)
        },
        shipping: {
          toAddress: orderType === 'escrow' ?
            order.escrowTransaction?.shippingAddress :
            order.shippingAddress,
          // Enhanced tracking number retrieval - check multiple sources
          trackingNumber: this.getTrackingNumberFromOrder(order, orderType),
          provider: this.getProviderFromOrder(order, orderType),
          estimatedDelivery: order.shipping?.estimatedDelivery || order.deliveryDetails?.estimatedDelivery || null,
          shippedAt: order.shipping?.shippedAt || order.deliveryDetails?.shippedAt || null
        },
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      };

      // Sync tracking information from transaction status if not already present
      if (!formattedOrder.shipping.trackingNumber) {
        console.log('🔄 No tracking number in order, syncing from transaction status...');
        formattedOrder = await this.syncTrackingWithOrder(formattedOrder, orderType, order.transactionId);
      } else {
        console.log('✅ Order already has tracking number:', formattedOrder.shipping.trackingNumber);
      }
      // Check if we need to retroactively update the orderStatus in the database
      if (formattedOrder.shipping.trackingNumber && orderStatus === 'shipped' && !order.orderStatus) {
        console.log('🔄 Retroactively updating orderStatus to shipped in database...');
        try {
          const updateData = { orderStatus: 'shipped' };
          
          if (orderType === 'standard') {
            await StandardPayment.findByIdAndUpdate(order._id, updateData);
          } else if (orderType === 'escrow') {
            await Transaction.findByIdAndUpdate(order._id, updateData);
          }
          
          console.log('✅ Database orderStatus updated to shipped');
        } catch (updateError) {
          console.error('❌ Error updating orderStatus in database:', updateError);
        }
      }
      
      // Also check if we need to retroactively update funds_held status for escrow orders
      if (orderType === 'escrow' && !order.orderStatus) {
        const escrowStatus = order.escrowTransaction?.status || order.status;
        if (escrowStatus === 'funds_held' && orderStatus === 'paid') {
          console.log('🔄 Retroactively updating orderStatus for funds_held escrow...');
          try {
            const updateData = { orderStatus: 'paid' };
            await Transaction.findByIdAndUpdate(order._id, updateData);
            console.log('✅ Database orderStatus updated to paid for funds_held escrow');
          } catch (updateError) {
            console.error('❌ Error updating escrow orderStatus in database:', updateError);
          }
        }
      }

      // Get shipment information if available (this would need to be implemented based on your shipment tracking)
      let shipment = null;
      // Note: You may need to implement shipment tracking based on transaction ID or other identifier

      console.log('✅ Order details found:', formattedOrder.orderNumber);

      res.json({
        success: true,
        data: {
          order: formattedOrder,
          shipment: shipment
        }
      });
    } catch (error) {
      console.error('❌ Get order details error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch order details',
        details: error.message
      });
    }
  }


  async createOrder(req, res) {
    try {
      const userId = req.user._id; // Use MongoDB ObjectId
      const { 
        productId, 
        sellerId, 
        offerId, 
        offerAmount, 
        paymentMethod, 
        shippingAddress,
        paymentDetails 
      } = req.body;

      // Validate required fields
      if (!productId || !sellerId || !paymentMethod || !shippingAddress) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields'
        });
      }

      // Get product details
      const product = await Product.findById(productId).populate('user');
      if (!product) {
        return res.status(404).json({
          success: false,
          error: 'Product not found'
        });
      }

      // Verify seller
      if (product.user._id.toString() !== sellerId) {
        return res.status(400).json({
          success: false,
          error: 'Invalid seller for this product'
        });
      }

      // Calculate order details
      const productPrice = offerAmount || product.price;
      const shippingFee = 0; // Will be calculated based on selected shipping option
      const platformFee = paymentMethod === 'escrow' ? (productPrice * 0.1) : 0.85;
      const tax = 0.72;
      const total = productPrice + platformFee + shippingFee + tax;

      // Create order
      const order = new Order({
        buyer: userId,
        seller: sellerId,
        product: productId,
        orderDetails: {
          productPrice: product.price,
          offerAmount: offerAmount,
          offerId: offerId,
          quantity: 1,
          currency: 'USD'
        },
        payment: {
          method: paymentMethod,
          status: 'pending',
          fees: {
            platformFee,
            shippingFee,
            tax,
            total
          }
        },
        shipping: {
          toAddress: shippingAddress
        },
        status: 'pending_payment',
        timeline: [{
          status: 'pending_payment',
          timestamp: new Date(),
          description: 'Order created, awaiting payment',
          updatedBy: 'buyer'
        }]
      });

      await order.save();

      // Populate order for response
      await order.populate([
        { path: 'product', select: 'title price product_photos' },
        { path: 'buyer', select: 'username profile_picture firstName lastName' },
        { path: 'seller', select: 'username profile_picture firstName lastName' }
      ]);

      // Send notification to seller about new order
      try {
        await NotificationService.notifyOrderConfirmed(
          order,
          order.buyer,
          order.seller
        );
      } catch (notificationError) {
        console.error('Error sending order confirmation notification:', notificationError);
        // Don't fail the order creation if notification fails
      }

      res.json({
        success: true,
        data: { order }
      });
    } catch (error) {
      console.error('Create order error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create order'
      });
    }
  }


  async updateOrderStatus(req, res) {
    try {
      const { orderId } = req.params;
      const { status, notes, shippingDetails } = req.body;
      const userId = req.user._id; // Use MongoDB ObjectId

      console.log('🔄 Updating order status:', { orderId, status, userId: userId.toString() });
      console.log('🔍 Order ID details:', {
        orderId,
        length: orderId.length,
        isValidObjectId: require('mongoose').Types.ObjectId.isValid(orderId)
      });

      // First try to find in Order collection
      let order = await Order.findById(orderId);
      let isTransaction = false;
      let isStandardPayment = false;
      let isEscrowTransaction = false;
      let collectionFound = null;

      // If not found in Order collection, try Transaction collection (for both escrow and standard)
      if (!order) {
        console.log('📦 Order not found in Order collection, checking Transaction collection...');
        try {
          order = await Transaction.findById(orderId)
            .populate('product', 'title price product_photos brand size condition material colors user')
            .populate('buyer', 'username profile_picture email phone firstName lastName')
            .populate('seller', 'username profile_picture email phone firstName lastName')
            .populate('escrowTransaction'); // Populate escrow transaction to check type

          if (order) {
            isTransaction = true;
            collectionFound = 'Transaction';
            
            // Check if this is an escrow transaction
            if (order.escrowTransaction) {
              isEscrowTransaction = true;
              console.log('✅ Found escrow transaction in Transaction collection:', {
                transactionId: order._id,
                escrowId: order.escrowTransaction._id,
                escrowStatus: order.escrowTransaction.status
              });
            } else {
              console.log('✅ Found standard transaction in Transaction collection');
            }
          }
        } catch (transactionError) {
          console.error('❌ Error querying Transaction collection:', transactionError);
        }
      }

      // If not found in Transaction collection, try StandardPayment collection
      if (!order) {
        console.log('📦 Order not found in Transaction collection, checking StandardPayment collection...');
        try {
          order = await StandardPayment.findById(orderId)
            .populate('product', 'title price product_photos brand size condition material colors user')
            .populate('buyer', 'username profile_picture email phone firstName lastName')
            .populate('seller', 'username profile_picture email phone firstName lastName');

          if (order) {
            isStandardPayment = true;
            collectionFound = 'StandardPayment';
            console.log('✅ Found order in StandardPayment collection');
          }
        } catch (standardPaymentError) {
          console.error('❌ Error querying StandardPayment collection:', standardPaymentError);
        }
      }

      // Additional fallback: try to find escrow transaction directly in EscrowTransaction collection
      if (!order) {
        console.log('📦 Order not found in Transaction/StandardPayment collections, checking EscrowTransaction collection directly...');
        try {
          const directEscrowTransaction = await EscrowTransaction.findById(orderId)
            .populate('product', 'title price product_photos brand size condition material colors user')
            .populate('buyer', 'username profile_picture email phone firstName lastName')
            .populate('seller', 'username profile_picture email phone firstName lastName');
          
          if (directEscrowTransaction) {
            // This is a direct escrow transaction, treat it as an order
            order = directEscrowTransaction;
            isEscrowTransaction = true;
            collectionFound = 'EscrowTransaction';
            console.log('✅ Found direct escrow transaction in EscrowTransaction collection');
          }
        } catch (escrowError) {
          console.error('❌ Error querying EscrowTransaction collection:', escrowError);
        }
      }

      if (!order) {
        console.log('❌ Order not found in any collection (Order, Transaction, StandardPayment, EscrowTransaction)');
        return res.status(404).json({
          success: false,
          error: 'Order not found'
        });
      }

      console.log('✅ Order found:', {
        orderId: order._id,
        collection: collectionFound,
        isTransaction,
        isStandardPayment,
        isEscrowTransaction,
        hasEscrowTransaction: !!order.escrowTransaction
      });

      // Validate order data integrity
      if (!order.buyer || !order.seller) {
        console.log('❌ Order found but buyer or seller data is missing:', {
          orderId,
          hasBuyer: !!order.buyer,
          hasSeller: !!order.seller,
          orderType: collectionFound,
          isEscrowTransaction
        });
        
        // For escrow transactions, try to get buyer/seller from escrow transaction
        if (isEscrowTransaction && order.escrowTransaction && collectionFound === 'Transaction') {
          try {
            console.log('🔄 Attempting to get buyer/seller from linked escrow transaction...');
            const escrowTxn = await EscrowTransaction.findById(order.escrowTransaction)
              .populate('buyer', 'username profile_picture email phone firstName lastName')
              .populate('seller', 'username profile_picture email phone firstName lastName');
            
            if (escrowTxn && escrowTxn.buyer && escrowTxn.seller) {
              console.log('✅ Found buyer/seller from escrow transaction');
              // Temporarily assign for permission check
              order.buyer = escrowTxn.buyer;
              order.seller = escrowTxn.seller;
              
              // Update the Transaction record with proper buyer/seller references
              await Transaction.findByIdAndUpdate(orderId, {
                buyer: escrowTxn.buyer._id,
                seller: escrowTxn.seller._id
              });
              console.log('✅ Updated Transaction record with proper buyer/seller references');
            } else {
              return res.status(500).json({
                success: false,
                error: 'Order data is incomplete - missing buyer or seller information in both Transaction and EscrowTransaction'
              });
            }
          } catch (escrowError) {
            console.error('❌ Error fetching escrow transaction:', escrowError);
            return res.status(500).json({
              success: false,
              error: 'Order data is incomplete and could not be recovered from escrow transaction'
            });
          }
        } else if (collectionFound === 'EscrowTransaction') {
          // If found directly in EscrowTransaction, buyer/seller should already be populated
          console.log('❗ Direct escrow transaction missing buyer/seller data - this should not happen');
          return res.status(500).json({
            success: false,
            error: 'Escrow transaction data is incomplete - missing buyer or seller information'
          });
        } else {
          return res.status(500).json({
            success: false,
            error: 'Order data is incomplete - missing buyer or seller information'
          });
        }
      }

      // Check permissions
      let updatedBy = 'system';
      const buyerId = order.buyer?._id || order.buyer;
      const sellerId = order.seller?._id || order.seller;

      if (buyerId && buyerId.toString() === userId.toString()) {
        updatedBy = 'buyer';
      } else if (sellerId && sellerId.toString() === userId.toString()) {
        updatedBy = 'seller';
      } else {
        console.log('❌ Access denied:', { buyerId: buyerId?.toString(), sellerId: sellerId?.toString(), userId: userId.toString() });
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Get current status based on collection type
      let currentStatus = order.status;
      
      if (collectionFound === 'EscrowTransaction') {
        // Direct escrow transaction - use its status directly
        console.log('🔄 Processing direct escrow transaction status mapping...');
        const escrowStatusMap = {
          'pending_payment': 'pending_payment',
          'payment_processing': 'pending_payment',
          'funds_held': 'paid', // Key mapping for escrow
          'shipped': 'shipped',
          'delivered': 'delivered',
          'completed': 'completed',
          'cancelled': 'cancelled',
          'payment_failed': 'cancelled'
        };
        currentStatus = escrowStatusMap[order.status] || 'pending_payment';
        console.log('📊 Direct escrow status mapping:', {
          escrowStatus: order.status,
          mappedOrderStatus: currentStatus
        });
      } else if (isTransaction || isStandardPayment) {
        // Check if orderStatus field exists (newly added field)
        if (order.orderStatus) {
          currentStatus = order.orderStatus;
        } else {
          // Handle escrow transactions differently from standard payments
          if (isEscrowTransaction) {
            // ESCROW TRANSACTION LOGIC
            console.log('🔄 Processing linked escrow transaction status mapping...');
            try {
              const escrowTxn = order.escrowTransaction || await EscrowTransaction.findById(order.escrowTransaction);
              
              if (escrowTxn) {
                console.log('🔄 Mapping escrow status to order status:', {
                  escrowStatus: escrowTxn.status,
                  transactionStatus: order.status
                });
                
                // Map escrow statuses to order statuses according to project specifications
                const escrowStatusMap = {
                  'pending_payment': 'pending_payment',
                  'payment_processing': 'pending_payment',
                  'funds_held': 'paid', // Key mapping for escrow
                  'shipped': 'shipped',
                  'delivered': 'delivered',
                  'completed': 'completed',
                  'cancelled': 'cancelled',
                  'payment_failed': 'cancelled'
                };
                
                currentStatus = escrowStatusMap[escrowTxn.status] || 'pending_payment';
                
                // If escrow is funds_held but Transaction status doesn't reflect this, update it
                if (escrowTxn.status === 'funds_held' && order.status !== 'completed') {
                  console.log('🔄 Updating Transaction status to match escrow funds_held status...');
                  await Transaction.findByIdAndUpdate(orderId, {
                    status: 'completed',
                    orderStatus: 'paid'
                  });
                  order.status = 'completed';
                  order.orderStatus = 'paid';
                  currentStatus = 'paid';
                }
              } else {
                console.error('❌ Escrow transaction not found for order:', orderId);
                currentStatus = 'pending_payment';
              }
            } catch (escrowError) {
              console.error('❌ Error fetching escrow status:', escrowError);
              // Fall back to standard mapping
              currentStatus = 'pending_payment';
            }
          } else {
            // STANDARD PAYMENT LOGIC
            console.log('🔄 Processing standard payment status mapping...');
            if (order.status === 'completed' || order.status === 'paid') {
              currentStatus = 'paid';
            } else if (order.status === 'pending') {
              currentStatus = 'pending_payment';
            } else if (order.status === 'processing') {
              // Payment is being processed - treat as pending_payment for order status
              currentStatus = 'pending_payment';
            } else {
              currentStatus = order.status === 'failed' || order.status === 'cancelled' ? 'cancelled' : 'pending_payment';
            }
          }
        }
      }

      console.log('📊 Status mapping:', {
        originalStatus: order.status,
        orderStatus: order.orderStatus,
        mappedCurrentStatus: currentStatus,
        collectionFound,
        isTransaction,
        isStandardPayment,
        isEscrowTransaction
      });

      // Validate status transitions
      const validTransitions = {
        'pending_payment': ['paid', 'cancelled'],
        'paid': ['processing', 'shipped', 'cancelled'], // Allow direct paid -> shipped
        'processing': ['shipped', 'cancelled'],
        'shipped': ['in_transit', 'delivered'],
        'in_transit': ['out_for_delivery', 'delivered'],
        'out_for_delivery': ['delivered'],
        'delivered': ['completed', 'returned'], // Can complete or return if there's an issue
        'completed': [], // Final state
        'cancelled': [], // Final state
        'returned': [], // Final state
        'refunded': [] // Final state
      };

      // Special case: If payment is completed or processing but order status is still pending_payment,
      // allow seller to mark as shipped (auto-transition through paid -> shipped)
      if (currentStatus === 'pending_payment' && status === 'shipped' && updatedBy === 'seller') {
        if ((isTransaction || isStandardPayment) && (order.status === 'completed' || order.status === 'processing')) {
          console.log('✅ Auto-transitioning completed/processing payment from pending_payment to shipped');
          currentStatus = 'paid'; // Treat as paid for transition validation
        }
      }

      // Check if trying to transition to the same status
      // Special handling for escrow transactions: allow 'paid' status update even if already mapped to 'paid'
      // This is needed when payment completion flow updates status after funds are held
      const isEscrowPaidUpdate = (isEscrowTransaction || collectionFound === 'EscrowTransaction') && 
                                 status === 'paid' && 
                                 currentStatus === 'paid' &&
                                 (notes && notes.includes('escrow') || notes && notes.includes('funds_held'));
      
      if (currentStatus === status && !isEscrowPaidUpdate) {
        console.log('❌ Cannot transition to same status:', { currentStatus, targetStatus: status, isEscrowPaidUpdate });
        return res.status(400).json({
          success: false,
          error: `Order is already ${status}. Cannot transition from ${currentStatus} to ${status}.`
        });
      }
      
      // Special case for escrow paid updates - allow the transition but log it
      if (isEscrowPaidUpdate) {
        console.log('✅ Allowing escrow paid status update (payment completion flow):', {
          currentStatus,
          targetStatus: status,
          notes: notes
        });
      }

      // Enhanced validation for escrow transactions
      if (!validTransitions[currentStatus]?.includes(status) && !isEscrowPaidUpdate) {
        // Special handling for escrow transactions
        if (isEscrowTransaction || collectionFound === 'EscrowTransaction') {
          console.log('🔄 Checking escrow-specific status transitions...');
          
          // Allow certain escrow-specific transitions
          const escrowSpecialTransitions = {
            'pending_payment': ['paid', 'cancelled'], // Standard transitions
            'paid': ['paid', 'processing', 'shipped', 'cancelled'], // Allow paid -> paid for escrow updates
            'processing': ['shipped', 'cancelled'],
            'shipped': ['in_transit', 'delivered'],
            'in_transit': ['out_for_delivery', 'delivered'],
            'out_for_delivery': ['delivered'],
            'delivered': ['completed', 'returned'],
            'completed': [], // Final state
            'cancelled': [], // Final state
            'returned': [], // Final state
            'refunded': [] // Final state
          };
          
          if (!escrowSpecialTransitions[currentStatus]?.includes(status)) {
            console.log('❌ Invalid escrow status transition:', { from: currentStatus, to: status });
            return res.status(400).json({
              success: false,
              error: `Cannot transition escrow order from ${currentStatus} to ${status}. Current payment status: ${order.status}`
            });
          } else {
            console.log('✅ Escrow status transition allowed:', { from: currentStatus, to: status });
          }
        } else {
          console.log('❌ Invalid status transition:', { from: currentStatus, to: status });
          return res.status(400).json({
            success: false,
            error: `Cannot transition from ${currentStatus} to ${status}. Current payment status: ${order.status}`
          });
        }
      }

      // Extract provider from notes if not explicitly provided in shippingDetails
      let effectiveProvider = shippingDetails?.provider;
      if (status === 'shipped' && !effectiveProvider && notes) {
        const extractedInfo = this.extractTrackingFromDescription(notes);
        if (extractedInfo && extractedInfo.provider && extractedInfo.provider !== 'unknown') {
          effectiveProvider = extractedInfo.provider;
          console.log('✅ Extracted provider from notes:', effectiveProvider);
        }
      }
      
      // Update order based on collection type
      let updatedOrder;

      if (collectionFound === 'EscrowTransaction') {
        // UPDATE DIRECT ESCROW TRANSACTION
        console.log('🔄 Updating direct escrow transaction...');
        const updateData = {
          status,
          $push: {
            statusHistory: {
              status,
              timestamp: new Date(),
              note: notes || `Escrow transaction status updated to ${status}`,
            }
          }
        };

        if (status === 'shipped' && shippingDetails) {
          updateData['deliveryDetails.trackingNumber'] = shippingDetails.trackingNumber;
          updateData['deliveryDetails.carrier'] = effectiveProvider || shippingDetails.provider || 'Unknown';
          updateData['deliveryDetails.shippedAt'] = new Date();
          updateData['deliveryDetails.estimatedDelivery'] = shippingDetails.estimatedDelivery;
        }

        updatedOrder = await EscrowTransaction.findByIdAndUpdate(orderId, updateData, { new: true })
          .populate('product', 'title price product_photos')
          .populate('buyer', 'userName profile email firstName lastName')
          .populate('seller', 'userName profile email firstName lastName');

        // CRITICAL: Also update the corresponding Transaction record for synchronization
        console.log('🔄 Finding and updating corresponding Transaction record...');
        try {
          const correspondingTransaction = await Transaction.findOne({
            escrowTransaction: orderId
          });
          
          if (correspondingTransaction) {
            console.log('✅ Found corresponding Transaction record:', correspondingTransaction._id);
            
            // Prepare Transaction update data
            const transactionUpdateData = {
              orderStatus: status,
              $push: {
                statusHistory: {
                  status,
                  timestamp: new Date(),
                  description: notes || `Status updated from escrow: ${status}`,
                  updatedBy
                }
              }
            };
            
            // For 'paid' status, also update the main status field for consistency
            if (status === 'paid') {
              transactionUpdateData.status = 'completed'; // Transaction status should be completed when payment is done
              console.log('🔄 Setting Transaction status to "completed" for paid escrow order');
            }
            
            // Add shipping details if applicable
            if (status === 'shipped' && shippingDetails) {
              transactionUpdateData['deliveryDetails.trackingNumber'] = shippingDetails.trackingNumber;
              transactionUpdateData['deliveryDetails.carrier'] = effectiveProvider || shippingDetails.provider || 'Unknown';
              transactionUpdateData['deliveryDetails.shippedAt'] = new Date();
              transactionUpdateData['deliveryDetails.estimatedDelivery'] = shippingDetails.estimatedDelivery;
              transactionUpdateData['deliveryDetails.packageDetails'] = shippingDetails.packageDetails;
              
              transactionUpdateData['shipping.trackingNumber'] = shippingDetails.trackingNumber;
              transactionUpdateData['shipping.provider'] = effectiveProvider || shippingDetails.provider || 'Unknown';
              transactionUpdateData['shipping.estimatedDelivery'] = shippingDetails.estimatedDelivery;
            }
            
            await Transaction.findByIdAndUpdate(correspondingTransaction._id, transactionUpdateData);
            console.log('✅ Successfully updated corresponding Transaction record with orderStatus:', status);
            
            // Log the synchronization for verification
            console.log('📊 Escrow-Transaction Synchronization:', {
              escrowTransactionId: orderId,
              transactionId: correspondingTransaction._id,
              escrowStatus: status,
              transactionOrderStatus: status,
              transactionStatus: status === 'paid' ? 'completed' : correspondingTransaction.status
            });
          } else {
            console.log('⚠️ No corresponding Transaction record found for escrow transaction:', orderId);
            console.log('   This might be a standalone escrow transaction without a Transaction record');
          }
        } catch (syncError) {
          console.error('❌ Error synchronizing Transaction record:', syncError);
          // Don't fail the escrow update if Transaction sync fails
          console.log('⚠️ Escrow transaction updated successfully, but Transaction sync failed');
        }

      } else if (isEscrowTransaction) {
        // UPDATE ESCROW TRANSACTION (via Transaction record)
        console.log('🔄 Updating escrow transaction via Transaction record...');
        const updateData = {
          orderStatus: status,
          $push: {
            statusHistory: {
              status,
              timestamp: new Date(),
              description: notes || `Escrow order status updated to ${status}`,
              updatedBy
            }
          }
        };

        if (status === 'shipped' && shippingDetails) {
          // Store in deliveryDetails for backward compatibility
          updateData['deliveryDetails.trackingNumber'] = shippingDetails.trackingNumber;
          updateData['deliveryDetails.carrier'] = effectiveProvider || shippingDetails.provider || 'Unknown';
          updateData['deliveryDetails.shippedAt'] = new Date();
          updateData['deliveryDetails.estimatedDelivery'] = shippingDetails.estimatedDelivery;
          updateData['deliveryDetails.packageDetails'] = shippingDetails.packageDetails;
          
          // Also store in shipping field for consistent retrieval
          updateData['shipping.trackingNumber'] = shippingDetails.trackingNumber;
          updateData['shipping.provider'] = effectiveProvider || shippingDetails.provider || 'Unknown';
          updateData['shipping.estimatedDelivery'] = shippingDetails.estimatedDelivery;
        }

        updatedOrder = await Transaction.findByIdAndUpdate(orderId, updateData, { new: true })
          .populate('product', 'title price product_photos')
          .populate('buyer', 'userName profile email firstName lastName')
          .populate('seller', 'userName profile email firstName lastName')
          .populate('escrowTransaction');

        // Also update the linked EscrowTransaction if status affects it
        if (order.escrowTransaction) {
          try {
            const escrowUpdateData = {
              $push: {
                statusHistory: {
                  status,
                  timestamp: new Date(),
                  note: notes || `Status updated from transaction management to ${status}`
                }
              }
            };
            
            // For certain statuses, update the escrow transaction status as well
            if (status === 'paid') {
              // Map 'paid' order status to 'funds_held' escrow status for consistency
              escrowUpdateData.status = 'funds_held';
              console.log('🔄 Updating linked EscrowTransaction status to "funds_held" for paid order');
            } else if (status === 'shipped' || status === 'delivered') {
              escrowUpdateData.status = status;
              console.log(`🔄 Updating linked EscrowTransaction status to "${status}"`);
            }
            
            if (status === 'shipped' && shippingDetails) {
              escrowUpdateData['deliveryDetails.trackingNumber'] = shippingDetails.trackingNumber;
              escrowUpdateData['deliveryDetails.carrier'] = effectiveProvider || shippingDetails.provider || 'Unknown';
              escrowUpdateData['deliveryDetails.shippedAt'] = new Date();
            }
            
            await EscrowTransaction.findByIdAndUpdate(order.escrowTransaction._id || order.escrowTransaction, escrowUpdateData);
            console.log('✅ Updated linked EscrowTransaction status for synchronization');
            
            // Log the synchronization for verification
            console.log('📊 Transaction-Escrow Synchronization:', {
              transactionId: orderId,
              escrowTransactionId: order.escrowTransaction._id || order.escrowTransaction,
              transactionOrderStatus: status,
              escrowStatus: escrowUpdateData.status || 'unchanged'
            });
          } catch (escrowUpdateError) {
            console.error('❌ Error updating linked escrow transaction:', escrowUpdateError);
            // Don't fail the main update if escrow update fails
            console.log('⚠️ Transaction updated successfully, but EscrowTransaction sync failed');
          }
        }

      } else if (isTransaction) {
        // UPDATE STANDARD TRANSACTION
        console.log('🔄 Updating standard transaction...');
        const updateData = {
          orderStatus: status,
          $push: {
            statusHistory: {
              status,
              timestamp: new Date(),
              description: notes || `Order status updated to ${status}`,
              updatedBy
            }
          }
        };

        if (status === 'shipped' && shippingDetails) {
          // Store in deliveryDetails for backward compatibility
          updateData['deliveryDetails.trackingNumber'] = shippingDetails.trackingNumber;
          updateData['deliveryDetails.carrier'] = effectiveProvider || shippingDetails.provider || 'Unknown';
          updateData['deliveryDetails.shippedAt'] = new Date();
          updateData['deliveryDetails.estimatedDelivery'] = shippingDetails.estimatedDelivery;
          updateData['deliveryDetails.packageDetails'] = shippingDetails.packageDetails;
          
          // Also store in shipping field for consistent retrieval
          updateData['shipping.trackingNumber'] = shippingDetails.trackingNumber;
          updateData['shipping.provider'] = effectiveProvider || shippingDetails.provider || 'Unknown';
          updateData['shipping.estimatedDelivery'] = shippingDetails.estimatedDelivery;
        }

        updatedOrder = await Transaction.findByIdAndUpdate(orderId, updateData, { new: true })
          .populate('product', 'title price product_photos')
          .populate('buyer', 'userName profile email firstName lastName')
          .populate('seller', 'userName profile email firstName lastName');

      } else if (isStandardPayment) {
        // UPDATE STANDARD PAYMENT
        console.log('🔄 Updating standard payment...');
        const updateData = {
          orderStatus: status,
          $push: {
            statusHistory: {
              status,
              timestamp: new Date(),
              description: notes || `Order status updated to ${status}`,
              updatedBy
            }
          }
        };

        if (status === 'shipped' && shippingDetails) {
          // Store in deliveryDetails for backward compatibility
          updateData['deliveryDetails.trackingNumber'] = shippingDetails.trackingNumber;
          updateData['deliveryDetails.carrier'] = effectiveProvider || shippingDetails.provider || 'Unknown';
          updateData['deliveryDetails.shippedAt'] = new Date();
          updateData['deliveryDetails.estimatedDelivery'] = shippingDetails.estimatedDelivery;
          updateData['deliveryDetails.packageDetails'] = shippingDetails.packageDetails;
          
          // Also store in shipping field for consistent retrieval
          updateData['shipping.trackingNumber'] = shippingDetails.trackingNumber;
          updateData['shipping.provider'] = effectiveProvider || shippingDetails.provider || 'Unknown';
          updateData['shipping.estimatedDelivery'] = shippingDetails.estimatedDelivery;
        }

        updatedOrder = await StandardPayment.findByIdAndUpdate(orderId, updateData, { new: true })
          .populate('product', 'title price product_photos')
          .populate('buyer', 'userName profile email firstName lastName')
          .populate('seller', 'userName profile email firstName lastName');

      } else {
        // UPDATE REGULAR ORDER
        console.log('🔄 Updating regular order...');
        const updateData = {
          status,
          $push: {
            timeline: {
              status,
              timestamp: new Date(),
              description: notes || `Order status updated to ${status}`,
              updatedBy
            }
          }
        };

        // Add specific updates based on status
        if (status === 'shipped' && shippingDetails) {
          updateData['shipping.trackingNumber'] = shippingDetails.trackingNumber;
          updateData['shipping.provider'] = effectiveProvider || shippingDetails.provider || 'Unknown';
          updateData['shipping.estimatedDelivery'] = shippingDetails.estimatedDelivery;
          updateData['shipping.shippedAt'] = new Date();
        }
        
        if (status === 'delivered') {
          updateData['delivery.confirmationDate'] = new Date();
          updateData['delivery.confirmedBy'] = updatedBy;
        }

        updatedOrder = await Order.findByIdAndUpdate(orderId, updateData, { new: true })
          .populate('product', 'title price product_photos')
          .populate('buyer', 'userName profile email firstName lastName')
          .populate('seller', 'userName profile email firstName lastName');
      }

      console.log('✅ Order status updated successfully');

      // Send notifications and emails based on status change
      try {
        if (status === 'shipped' && updatedOrder) {
          // Send in-app notification
          await NotificationService.notifyOrderShipped(
            updatedOrder,
            updatedOrder.seller,
            updatedOrder.buyer
          );

          // Send email notification to buyer
          console.log('📧 Sending shipped email notification...');
          console.log('📧 Updated order data:', {
            orderId: updatedOrder._id,
            orderNumber: updatedOrder.orderNumber || updatedOrder.transactionId,
            buyerEmail: updatedOrder.buyer?.email,
            buyerFirstName: updatedOrder.buyer?.firstName,
            buyerUserName: updatedOrder.buyer?.userName,
            sellerFirstName: updatedOrder.seller?.firstName,
            sellerUserName: updatedOrder.seller?.userName,
            productTitle: updatedOrder.product?.title
          });
          
          // Validate that buyer has email before attempting to send
          if (!updatedOrder.buyer || !updatedOrder.buyer.email) {
            console.error('❌ Cannot send email: Buyer or buyer email is missing');
            console.error('❌ Buyer data:', updatedOrder.buyer);
          } else {
            const emailResult = await OrderEmailService.sendOrderShippedEmail(
              updatedOrder,
              updatedOrder.buyer,
              updatedOrder.seller,
              updatedOrder.product,
              {
                trackingNumber: shippingDetails?.trackingNumber,
                provider: effectiveProvider || shippingDetails?.provider,
                carrier: effectiveProvider || shippingDetails?.provider,
                estimatedDelivery: shippingDetails?.estimatedDelivery
              }
            );

            if (emailResult.success) {
              console.log('✅ Order shipped email sent successfully:', emailResult.messageId);
              if (emailResult.simulated) {
                console.log('⚠️ Email was simulated (not actually sent) - check email configuration');
              }
            } else {
              console.error('❌ Failed to send order shipped email:', emailResult.error);
            }
          }

        } else if (status === 'delivered' && updatedOrder) {
          await NotificationService.notifyOrderDelivered(
            updatedOrder,
            updatedOrder.buyer,
            updatedOrder.seller
          );
        }
      } catch (notificationError) {
        console.error('Error sending order status notification:', notificationError);
        // Don't fail the status update if notification fails
      }

      res.json({
        success: true,
        data: { order: updatedOrder }
      });
    } catch (error) {
      console.error('❌ Update order status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update order status',
        details: error.message
      });
    }
  }

  /**
   * Confirm delivery (buyer only)
   */
  async confirmDelivery(req, res) {
    try {
      const { orderId } = req.params;
      const { rating, feedback } = req.body;
      const userId = req.user._id; // Use MongoDB ObjectId

      console.log('🔄 Confirming delivery:', { orderId, userId: userId.toString() });

      // First try to find in Order collection
      let order = await Order.findById(orderId);
      let isTransaction = false;
      let isStandardPayment = false;

      // If not found in Order collection, try Transaction collection
      if (!order) {
        console.log('📦 Order not found in Order collection, checking Transaction collection...');
        order = await Transaction.findById(orderId)
          .populate('product', 'title price product_photos')
          .populate('buyer', 'username profile_picture firstName lastName')
          .populate('seller', 'username profile_picture firstName lastName');

        if (order) {
          isTransaction = true;
          console.log('✅ Found order in Transaction collection');
        }
      }

      // If not found in Transaction collection, try StandardPayment collection
      if (!order) {
        console.log('📦 Order not found in Transaction collection, checking StandardPayment collection...');
        order = await StandardPayment.findById(orderId)
          .populate('product', 'title price product_photos')
          .populate('buyer', 'username profile_picture firstName lastName')
          .populate('seller', 'username profile_picture firstName lastName');

        if (order) {
          isStandardPayment = true;
          console.log('✅ Found order in StandardPayment collection');
        }
      }

      if (!order) {
        console.log('❌ Order not found in any collection');
        return res.status(404).json({
          success: false,
          error: 'Order not found'
        });
      }

      // Only buyer can confirm delivery
      const buyerId = order.buyer?._id || order.buyer;
      if (!buyerId || buyerId.toString() !== userId.toString()) {
        console.log('❌ Access denied - not buyer:', { buyerId: buyerId?.toString(), userId: userId.toString() });
        return res.status(403).json({
          success: false,
          error: 'Only the buyer can confirm delivery'
        });
      }

      // Get current status based on collection type
      let currentStatus = order.status;
      if (isTransaction || isStandardPayment) {
        // Check if orderStatus field exists (newly added field)
        if (order.orderStatus) {
          currentStatus = order.orderStatus;
        } else {
          // For transactions and standard payments, map payment status to order status
          if (order.status === 'completed' || order.status === 'paid') {
            currentStatus = 'paid';
          } else if (order.status === 'pending') {
            currentStatus = 'pending_payment';
          } else if (order.status === 'processing') {
            // Payment is being processed - treat as pending_payment for order status
            currentStatus = 'pending_payment';
          } else {
            currentStatus = order.status === 'failed' || order.status === 'cancelled' ? 'cancelled' : 'pending_payment';
          }
        }
      }

      console.log('📊 Delivery confirmation status mapping:', {
        originalStatus: order.status,
        orderStatus: order.orderStatus,
        mappedCurrentStatus: currentStatus
      });

      // Check if order is in a deliverable state
      if (!['shipped', 'in_transit', 'out_for_delivery', 'delivered'].includes(currentStatus)) {
        console.log('❌ Order not in deliverable state:', currentStatus);
        return res.status(400).json({
          success: false,
          error: 'Order is not in a deliverable state'
        });
      }

      // Update order based on collection type
      let updatedOrder;

      if (isTransaction) {
        // Update Transaction
        const updateData = {
          orderStatus: 'delivered',
          deliveryConfirmedAt: new Date(),
          deliveryConfirmedBy: 'buyer',
          $push: {
            statusHistory: {
              status: 'delivered',
              timestamp: new Date(),
              description: 'Delivery confirmed by buyer',
              updatedBy: 'buyer'
            }
          }
        };

        if (rating) {
          updateData.deliveryRating = rating;
          updateData.deliveryFeedback = feedback;
          updateData.ratedAt = new Date();
        }

        updatedOrder = await Transaction.findByIdAndUpdate(orderId, updateData, { new: true })
          .populate('product', 'title price product_photos')
          .populate('seller', 'userName profile email firstName lastName')
          .populate('buyer', 'userName profile email firstName lastName');

      } else if (isStandardPayment) {
        // Update StandardPayment
        const updateData = {
          orderStatus: 'delivered',
          deliveryConfirmedAt: new Date(),
          deliveryConfirmedBy: 'buyer',
          $push: {
            statusHistory: {
              status: 'delivered',
              timestamp: new Date(),
              description: 'Delivery confirmed by buyer',
              updatedBy: 'buyer'
            }
          }
        };

        if (rating) {
          updateData.deliveryRating = rating;
          updateData.deliveryFeedback = feedback;
          updateData.ratedAt = new Date();
        }

        updatedOrder = await StandardPayment.findByIdAndUpdate(orderId, updateData, { new: true })
          .populate('product', 'title price product_photos')
          .populate('seller', 'userName profile email firstName lastName')
          .populate('buyer', 'userName profile email firstName lastName');

      } else {
        // Update Order (original logic)
        const updateData = {
          status: 'delivered',
          'delivery.confirmationDate': new Date(),
          'delivery.confirmedBy': 'buyer',
          $push: {
            timeline: {
              status: 'delivered',
              timestamp: new Date(),
              description: 'Delivery confirmed by buyer',
              updatedBy: 'buyer'
            }
          }
        };

        if (rating) {
          updateData['delivery.rating.deliveryRating'] = rating;
          updateData['delivery.rating.feedback'] = feedback;
          updateData['delivery.rating.ratedAt'] = new Date();
        }

        updatedOrder = await Order.findByIdAndUpdate(orderId, updateData, { new: true })
          .populate('product', 'title price product_photos')
          .populate('seller', 'userName profile email firstName lastName')
          .populate('buyer', 'userName profile email firstName lastName');
      }

      console.log('✅ Delivery confirmed successfully');

      // Send delivery confirmation emails
      try {
        console.log('📧 Sending delivery confirmation emails...');
        console.log('📧 Order data for emails:', {
          orderId: updatedOrder._id,
          orderNumber: updatedOrder.orderNumber || updatedOrder.transactionId,
          buyerEmail: updatedOrder.buyer?.email,
          sellerEmail: updatedOrder.seller?.email,
          productTitle: updatedOrder.product?.title
        });
        
        // Validate that both buyer and seller have email before attempting to send
        if (!updatedOrder.buyer || !updatedOrder.buyer.email) {
          console.error('❌ Cannot send buyer email: Buyer or buyer email is missing');
          console.error('❌ Buyer data:', updatedOrder.buyer);
        }
        
        if (!updatedOrder.seller || !updatedOrder.seller.email) {
          console.error('❌ Cannot send seller email: Seller or seller email is missing');
          console.error('❌ Seller data:', updatedOrder.seller);
        }
        
        // Prepare delivery details for email
        const deliveryDetails = {
          deliveryDate: new Date(),
          rating: rating || null,
          feedback: feedback || null,
          orderValue: this.getOrderFees(updatedOrder, isTransaction ? 'escrow' : (isStandardPayment ? 'standard' : 'order')).total
        };
        
        const emailResult = await OrderEmailService.sendDeliveryConfirmationEmails(
          updatedOrder,
          updatedOrder.buyer,
          updatedOrder.seller,
          updatedOrder.product,
          deliveryDetails
        );

        if (emailResult.success) {
          console.log('✅ Delivery confirmation emails sent successfully:', emailResult.message);
          if (emailResult.results?.buyerEmail?.simulated || emailResult.results?.sellerEmail?.simulated) {
            console.log('⚠️ Some emails were simulated (not actually sent) - check email configuration');
          }
        } else {
          console.error('❌ Failed to send delivery confirmation emails:', emailResult.error);
        }
      } catch (emailError) {
        console.error('❌ Error sending delivery confirmation emails:', emailError);
        // Don't fail the delivery confirmation if email fails
      }

      res.json({
        success: true,
        data: { order: updatedOrder }
      });
    } catch (error) {
      console.error('❌ Confirm delivery error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to confirm delivery',
        details: error.message
      });
    }
  }

  /**
   * Get order statistics for user
   */
  async getOrderStatistics(req, res) {
    try {
      const userId = req.user._id; // Use MongoDB ObjectId
      const { role = 'buyer' } = req.query;

      const matchQuery = role === 'buyer' ? { buyer: userId } : { seller: userId };

      const stats = await Order.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalValue: { $sum: '$payment.fees.total' }
          }
        }
      ]);

      const totalOrders = await Order.countDocuments(matchQuery);
      const totalValue = await Order.aggregate([
        { $match: matchQuery },
        { $group: { _id: null, total: { $sum: '$payment.fees.total' } } }
      ]);

      res.json({
        success: true,
        data: {
          totalOrders,
          totalValue: totalValue[0]?.total || 0,
          statusBreakdown: stats,
          role
        }
      });
    } catch (error) {
      console.error('Get order statistics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch order statistics'
      });
    }
  }

  /**
   * Get order status only
   */
  async getOrderStatus(req, res) {
    try {
      const { orderId } = req.params;
      const userId = req.user._id;

      console.log('🔍 Getting order status for:', orderId, 'user:', userId);

      let order = null;
      let orderType = null;
      let source = null;

      // Method 1: Try to find in EscrowTransaction collection first (most common for escrow payments)
      console.log('🔍 Searching in EscrowTransaction collection...');
      try {
        order = await EscrowTransaction.findById(orderId)
          .populate('buyer', 'userName email firstName lastName')
          .populate('seller', 'userName email firstName lastName')
          .populate('product', 'title price product_photos');
          console.log(order,"orrrrrrrrrrrrrrrrr")
        if (order) {
          orderType = 'escrow';
          source = 'EscrowTransaction';
          console.log('✅ Found in EscrowTransaction collection');
        }
      } catch (err) {
        console.log('⚠️ Error searching EscrowTransaction collection:', err.message);
      }

      // Method 2: Try to find in Transaction collection
      if (!order) {
        console.log('🔍 Searching in Transaction collection...');
        try {
          order = await Transaction.findById(orderId)
            .populate('buyer', 'userName email firstName lastName')
            .populate('seller', 'userName email firstName lastName')
            .populate('escrowTransaction', 'status transactionId')
            .populate('product', 'title price product_photos');

          if (order) {
            orderType = 'escrow';
            source = 'Transaction';
            console.log('✅ Found in Transaction collection');
          }
        } catch (err) {
          console.log('⚠️ Error searching Transaction collection:', err.message);
        }
      }

      // Method 3: Try to find in StandardPayment collection
      if (!order) {
        console.log('🔍 Searching in StandardPayment collection...');
        try {
          order = await StandardPayment.findById(orderId)
            .populate('buyer', 'userName email firstName lastName')
            .populate('seller', 'userName email firstName lastName')
            .populate('product', 'title price product_photos');

          if (order) {
            orderType = 'standard';
            source = 'StandardPayment';
            console.log('✅ Found in StandardPayment collection');
          }
        } catch (err) {
          console.log('⚠️ Error searching StandardPayment collection:', err.message);
        }
      }

      // Method 4: Try to find in Order collection
      if (!order) {
        console.log('🔍 Searching in Order collection...');
        try {
          order = await Order.findById(orderId)
            .populate('buyer', 'userName email firstName lastName')
            .populate('seller', 'userName email firstName lastName')
            .populate('product', 'title price product_photos');
           console.log('not Found in Order collection');
          if (order) {
            orderType = order.type || 'order';
            source = 'Order';
            console.log('✅ Found in Order collection');
          }else{
                        console.log('not Found in Order collection');

          }
        } catch (err) {
          console.log('⚠️ Error searching Order collection:', err.message);
        }
      }

      // Method 5: Search by transactionId if direct ID search failed
      if (!order) {
        console.log('🔍 Searching by transactionId in all collections...');
        
        // Try EscrowTransaction collection by transactionId first
        try {
          order = await EscrowTransaction.findOne({ transactionId: orderId })
            .populate('buyer', 'userName email firstName lastName')
            .populate('seller', 'userName email firstName lastName')
            .populate('product', 'title price product_photos');

          if (order) {
            orderType = 'escrow';
            source = 'EscrowTransaction (by transactionId)';
            console.log('✅ Found in EscrowTransaction collection by transactionId');
          }
        } catch (err) {
          console.log('⚠️ Error searching EscrowTransaction by transactionId:', err.message);
        }

        // Try Transaction collection by transactionId
        if (!order) {
          try {
            order = await Transaction.findOne({ transactionId: orderId })
              .populate('buyer', 'userName email firstName lastName')
              .populate('seller', 'userName email firstName lastName')
              .populate('escrowTransaction', 'status transactionId')
              .populate('product', 'title price product_photos');

            if (order) {
              orderType = 'escrow';
              source = 'Transaction (by transactionId)';
              console.log('✅ Found in Transaction collection by transactionId');
            }
          } catch (err) {
            console.log('⚠️ Error searching Transaction by transactionId:', err.message);
          }
        }

        // Try StandardPayment collection by transactionId
        if (!order) {
          try {
            order = await StandardPayment.findOne({ transactionId: orderId })
              .populate('buyer', 'userName email firstName lastName')
              .populate('seller', 'userName email firstName lastName')
              .populate('product', 'title price product_photos');

            if (order) {
              orderType = 'standard';
              source = 'StandardPayment (by transactionId)';
              console.log('✅ Found in StandardPayment collection by transactionId');
            }
          } catch (err) {
            console.log('⚠️ Error searching StandardPayment by transactionId:', err.message);
          }
        }

        // Method 6: Try searching by gatewayTransactionId in Transaction collection
        if (!order) {
          try {
            order = await Transaction.findOne({ gatewayTransactionId: orderId })
              .populate('buyer', 'userName email firstName lastName')
              .populate('seller', 'userName email firstName lastName')
              .populate('escrowTransaction', 'status transactionId')
              .populate('product', 'title price product_photos');

            if (order) {
              orderType = 'escrow';
              source = 'Transaction (by gatewayTransactionId)';
              console.log('✅ Found in Transaction collection by gatewayTransactionId');
            }
          } catch (err) {
            console.log('⚠️ Error searching Transaction by gatewayTransactionId:', err.message);
          }
        }

        // Method 7: Try searching by gatewayTransactionId in EscrowTransaction collection
        if (!order) {
          try {
            order = await EscrowTransaction.findOne({ gatewayTransactionId: orderId })
              .populate('buyer', 'userName email firstName lastName')
              .populate('seller', 'userName email firstName lastName')
              .populate('product', 'title price product_photos');

            if (order) {
              orderType = 'escrow';
              source = 'EscrowTransaction (by gatewayTransactionId)';
              console.log('✅ Found in EscrowTransaction collection by gatewayTransactionId');
            }
          } catch (err) {
            console.log('⚠️ Error searching EscrowTransaction by gatewayTransactionId:', err.message);
          }
        }
      }

      if (!order) {
        console.log('❌ Order not found in any collection with ID:', orderId);
        return res.status(404).json({
          success: false,
          error: 'Order not found',
          searchedId: orderId,
          searchedCollections: ['EscrowTransaction', 'Transaction', 'StandardPayment', 'Order'],
          searchMethods: ['by _id', 'by transactionId', 'by gatewayTransactionId']
        });
      }

      console.log('📋 Order found in:', source);

      // Check if user has access to this order
      const buyerId = order.buyer?._id || order.buyer;
      const sellerId = order.seller?._id || order.seller;

      if ((!buyerId || buyerId.toString() !== userId.toString()) && 
          (!sellerId || sellerId.toString() !== userId.toString())) {
        console.log('❌ Access denied:', { 
          buyerId: buyerId?.toString(), 
          sellerId: sellerId?.toString(), 
          userId: userId.toString() 
        });
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Get the appropriate status
      let currentStatus;
      let paymentStatus;

      if (orderType === 'escrow') {
        if (source === 'EscrowTransaction') {
          paymentStatus = order.status;
          currentStatus = order.orderStatus || this.mapPaymentStatusToOrderStatus(paymentStatus);
        } else {
          paymentStatus = order.escrowTransaction?.status || order.status;
          currentStatus = order.orderStatus || this.mapPaymentStatusToOrderStatus(paymentStatus);
        }
      } else if (orderType === 'standard') {
        paymentStatus = order.status;
        currentStatus = order.orderStatus || this.mapPaymentStatusToOrderStatus(paymentStatus);
      } else {
        // For Order collection
        currentStatus = order.status;
        paymentStatus = order.payment?.status || order.status;
      }

      console.log('✅ Order status retrieved:', {
        orderId,
        orderType,
        source,
        paymentStatus,
        currentStatus
      });

      res.json({
        success: true,
        data: {
          orderId: order._id,
          orderNumber: order.transactionId || order.orderNumber,
          type: orderType,
          status: currentStatus,
          paymentStatus: paymentStatus,
          lastUpdated: order.updatedAt,
          statusHistory: order.statusHistory || [],
          source: source
        }
      });

    } catch (error) {
      console.error('❌ Get order status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get order status',
        details: error.message
      });
    }
  }
}

module.exports = new OrderController();
