const Order = require('../../db/models/orderModel');
const NotificationService = require('../NotificationService');
const { calculatePlatformCommission } = require('../../app/utils/platformFeeService');

class OrderCreationService {
  /**
   * Create a COD order (single canonical path)
   */
  static async createCodOrder({ buyer, seller, product, productPrice, currency = 'USD', shippingAddress = null, offer = null, transactionId = null }) {
    try {
      const feeInfo = await calculatePlatformCommission({
        amount: productPrice,
        currency,
        categoryId: product?.category || product?.categoryId,
        userId: seller?._id || seller,
      });
      const platformCommission = feeInfo.commissionAmount || 0;

      const order = new Order({
        buyer: buyer._id || buyer,
        seller: seller._id || seller,
        product: product._id || product,
        orderDetails: {
          productPrice,
          offerAmount: offer ? productPrice : null,
          offerId: offer?._id || null,
          quantity: 1,
          currency
        },
        payment: {
          method: 'COD',
          status: 'Pending',
          transactionId: transactionId || `COD-${Date.now()}-${Math.floor(Math.random() * 10000)}`
        },
        shipping: {
          method: 'delivery',
          toAddress: shippingAddress || undefined,
          packageDetails: { weight: 1, unit: 'kg' }
        },
        status: 'Pending',
        timeline: [
          {
            status: 'Pending',
            timestamp: new Date(),
            description: 'Order created (COD)',
            updatedBy: 'system'
          }
        ],
        commissionBreakdown: {
          platformCommission,
          transactionFee: 0,
          netAmountToSeller: productPrice - platformCommission,
          totalAmount: productPrice,
        }
      });
      
      await order.save();
      
      // If product quantity hits 0, mark as sold but keep visible
      try {
        const Product = require('../../db/models/productModel');
        const prod = await Product.findById(order.product._id || order.product);
        if (prod) {
          const newQty = (prod.quantity || 1) - (order.orderDetails.quantity || 1);
          prod.quantity = Math.max(newQty, 0);
          if (prod.quantity === 0) {
            prod.status = 'sold';
            prod.hide = false;
          }
          await prod.save();
        }
      } catch (e) {
        console.error('Product update on order creation failed:', e.message);
      }

      await order.populate([
        { path: 'product', select: 'title price product_photos user' },
        { path: 'buyer', select: 'userName firstName lastName profile' },
        { path: 'seller', select: 'userName firstName lastName profile' }
      ]);

      try {
        await NotificationService.notifyOrderConfirmed(order, order.buyer, order.seller);
        // Additional explicit notification + socket event
        const { getSocketIO } = require('../../app/user/notifications/controllers/notificationController');
        const io = getSocketIO && getSocketIO();
        if (io) {
          io.to(`user_${order.seller._id || order.seller}`).emit('orderReceived', {
            orderId: order._id,
            productTitle: order.product.title
          });
        }
      } catch (notifyErr) {
        console.error('Notification error (order received):', notifyErr);
      }

      return { success: true, order };
    } catch (error) {
      console.error('❌ Error creating COD order:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = OrderCreationService;
