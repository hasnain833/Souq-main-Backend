const Order = require('../../db/models/orderModel');
const NotificationService = require('../NotificationService');

class OrderCreationService {
  
  /**
   * Create order from completed standard payment
   */
  static async createOrderFromStandardPayment(payment) {
    try {
      console.log('📦 Creating order from standard payment:', payment.transactionId);
      
      // Check if order already exists for this payment
      const existingOrder = await Order.findOne({
        'payment.transactionId': payment.transactionId
      });
      
      if (existingOrder) {
        console.log('⚠️ Order already exists for payment:', payment.transactionId);
        return { 
          success: true, 
          order: existingOrder, 
          alreadyExists: true 
        };
      }
      
      // Calculate fees
      const platformFee = payment.platformFeeAmount || 0;
      const shippingFee = payment.shippingCost || 0;
      const tax = payment.salesTax || 0;
      const total = payment.totalAmount || payment.productPrice;
      
      // Create order
      const order = new Order({
        buyer: payment.buyer._id,
        seller: payment.seller._id,
        product: payment.product._id,
        orderDetails: {
          productPrice: payment.productPrice,
          offerAmount: payment.offer ? payment.productPrice : null,
          offerId: payment.offer ? payment.offer._id : null,
          quantity: 1,
          currency: payment.currency
        },
        payment: {
          method: 'standard',
          status: 'paid',
          transactionId: payment.transactionId,
          paymentGateway: payment.paymentGateway,
          fees: {
            platformFee: platformFee,
            paymentGatewayFee: payment.gatewayFeeAmount || 0,
            shippingFee: shippingFee,
            tax: tax,
            total: total
          }
        },
        shipping: {
          method: 'delivery',
          toAddress: payment.shippingAddress || {
            fullName: `${payment.buyer.firstName} ${payment.buyer.lastName}`,
            street1: 'Address to be provided',
            city: 'City',
            state: 'State',
            zipCode: '00000',
            country: 'US',
            phoneNumber: payment.buyer.phoneNumber || 'Phone to be provided'
          },
          cost: {
            total: shippingFee,
            currency: payment.currency
          }
        },
        status: 'paid',
        timeline: [
          {
            status: 'pending_payment',
            timestamp: payment.createdAt,
            description: 'Order created, awaiting payment',
            updatedBy: 'system'
          },
          {
            status: 'paid',
            timestamp: new Date(),
            description: 'Payment completed successfully',
            updatedBy: 'system'
          }
        ]
      });
      
      await order.save();
      
      // Populate order for response
      await order.populate([
        { path: 'product', select: 'title price product_photos' },
        { path: 'buyer', select: 'username profile_picture firstName lastName email' },
        { path: 'seller', select: 'username profile_picture firstName lastName email' }
      ]);
      
      console.log('✅ Order created successfully:', order.orderNumber);
      
      // Send notification to seller about new order
      try {
        await NotificationService.notifyOrderConfirmed(
          order,
          order.buyer,
          order.seller
        );
        console.log('📧 Order confirmation notification sent');
      } catch (notificationError) {
        console.error('❌ Error sending order confirmation notification:', notificationError);
        // Don't fail the order creation if notification fails
      }
      
      return {
        success: true,
        order: order,
        alreadyExists: false
      };
      
    } catch (error) {
      console.error('❌ Error creating order from standard payment:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Create order from completed escrow payment
   */
  static async createOrderFromEscrowPayment(escrow) {
    try {
      console.log('📦 Creating order from escrow payment:', escrow.transactionId);
      
      // Check if order already exists for this escrow
      const existingOrder = await Order.findOne({
        'payment.transactionId': escrow.transactionId
      });
      
      if (existingOrder) {
        console.log('⚠️ Order already exists for escrow:', escrow.transactionId);
        return { 
          success: true, 
          order: existingOrder, 
          alreadyExists: true 
        };
      }
      
      // Calculate fees
      const platformFee = escrow.platformFeeAmount || 0;
      const shippingFee = escrow.shippingCost || 0;
      const tax = escrow.salesTax || 0;
      const total = escrow.totalAmount || escrow.productPrice;
      
      // Determine order status based on escrow status
      let orderStatus = 'paid';
      let paymentStatus = 'paid';
      
      if (escrow.status === 'funds_held') {
        orderStatus = 'processing';
        paymentStatus = 'paid';
      } else if (escrow.status === 'completed') {
        orderStatus = 'delivered';
        paymentStatus = 'paid';
      }
      
      // Create order
      const order = new Order({
        buyer: escrow.buyer._id,
        seller: escrow.seller._id,
        product: escrow.product._id,
        orderDetails: {
          productPrice: escrow.productPrice,
          offerAmount: escrow.offer ? escrow.productPrice : null,
          offerId: escrow.offer ? escrow.offer._id : null,
          quantity: 1,
          currency: escrow.currency
        },
        payment: {
          method: 'escrow',
          status: paymentStatus,
          transactionId: escrow.transactionId,
          escrowTransactionId: escrow._id,
          paymentGateway: escrow.paymentGateway,
          fees: {
            platformFee: platformFee,
            paymentGatewayFee: escrow.gatewayFeeAmount || 0,
            shippingFee: shippingFee,
            tax: tax,
            total: total
          }
        },
        shipping: {
          method: 'delivery',
          toAddress: escrow.shippingAddress || {
            fullName: `${escrow.buyer.firstName} ${escrow.buyer.lastName}`,
            street1: 'Address to be provided',
            city: 'City',
            state: 'State',
            zipCode: '00000',
            country: 'US',
            phoneNumber: escrow.buyer.phoneNumber || 'Phone to be provided'
          },
          cost: {
            total: shippingFee,
            currency: escrow.currency
          }
        },
        status: orderStatus,
        timeline: [
          {
            status: 'pending_payment',
            timestamp: escrow.createdAt,
            description: 'Order created, awaiting payment',
            updatedBy: 'system'
          },
          {
            status: 'paid',
            timestamp: escrow.paymentCompletedAt || new Date(),
            description: 'Payment completed, funds held in escrow',
            updatedBy: 'system'
          }
        ]
      });
      
      // Add delivery confirmation to timeline if escrow is completed
      if (escrow.status === 'completed') {
        order.timeline.push({
          status: 'delivered',
          timestamp: escrow.deliveryConfirmedAt || new Date(),
          description: 'Delivery confirmed, payment released to seller',
          updatedBy: 'buyer'
        });
      }
      
      await order.save();
      
      // Populate order for response
      await order.populate([
        { path: 'product', select: 'title price product_photos' },
        { path: 'buyer', select: 'username profile_picture firstName lastName email' },
        { path: 'seller', select: 'username profile_picture firstName lastName email' }
      ]);
      
      console.log('✅ Order created successfully:', order.orderNumber);
      
      // Send notification to seller about new order
      try {
        await NotificationService.notifyOrderConfirmed(
          order,
          order.buyer,
          order.seller
        );
        console.log('📧 Order confirmation notification sent');
      } catch (notificationError) {
        console.error('❌ Error sending order confirmation notification:', notificationError);
        // Don't fail the order creation if notification fails
      }
      
      return {
        success: true,
        order: order,
        alreadyExists: false
      };
      
    } catch (error) {
      console.error('❌ Error creating order from escrow payment:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Update existing order status when payment status changes
   */
  static async updateOrderFromPayment(transactionId, newStatus, paymentType = 'standard') {
    try {
      console.log('🔄 Updating order status for transaction:', transactionId);
      
      const order = await Order.findOne({
        'payment.transactionId': transactionId
      });
      
      if (!order) {
        console.log('⚠️ No order found for transaction:', transactionId);
        return { success: false, error: 'Order not found' };
      }
      
      // Update order status
      const oldStatus = order.status;
      order.status = newStatus;
      
      // Add timeline entry
      order.timeline.push({
        status: newStatus,
        timestamp: new Date(),
        description: `Order status updated from ${oldStatus} to ${newStatus}`,
        updatedBy: 'system'
      });
      
      await order.save();
      
      console.log('✅ Order status updated:', {
        orderNumber: order.orderNumber,
        oldStatus: oldStatus,
        newStatus: newStatus
      });
      
      return {
        success: true,
        order: order
      };
      
    } catch (error) {
      console.error('❌ Error updating order status:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = OrderCreationService;
