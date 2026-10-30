const Order = require('../../../../db/models/orderModel');
const User = require('../../../../db/models/userModel');
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');

class WalletController {
  // Get COD-based wallet summary for seller
  async getWalletSummary(req, res) {
    try {
      const userId = req.user._id;
      
      // Get all orders where user is seller
      const orders = await Order.find({ seller: userId })
        .populate('buyer', 'name email')
        .populate('product', 'title price')
        .sort({ createdAt: -1 });

      
      // Debug: Log order statuses
      orders.forEach(order => {
        const status = order.status || order.orderStatus;
        const amount = order.totalAmount || order.orderDetails?.productPrice || 0;
      });

      // Calculate wallet metrics
      const summary = {
        totalSales: 0,
        pendingPayments: 0,
        deliveredEarnings: 0,
        escrowHeld: 0, // Amount held in escrow
        totalOrders: orders.length,
        recentOrders: [],
        monthlyStats: {
          currentMonth: 0,
          lastMonth: 0,
          growth: 0
        }
      };

      const currentMonth = new Date().getMonth();
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const currentYear = new Date().getFullYear();

      orders.forEach(order => {
        const orderAmount = order.totalAmount || order.orderDetails?.productPrice || 0;
        const orderMonth = new Date(order.createdAt).getMonth();
        const orderYear = new Date(order.createdAt).getFullYear();
        const paymentMethod = order.paymentMethod || 'Cash on Delivery';
        // Get status from either field, normalize to handle case variations
        const orderStatus = (order.status || order.orderStatus || '').toString();
        const normalizedStatus = orderStatus.toLowerCase();
        const isEscrow = paymentMethod.includes('Escrow');
        const isEscrowHeld = isEscrow && order.escrowStatus === 'held';

        // Total sales
        summary.totalSales += orderAmount;

        // Monthly stats
        if (orderYear === currentYear) {
          if (orderMonth === currentMonth) {
            summary.monthlyStats.currentMonth += orderAmount;
          } else if (orderMonth === lastMonth) {
            summary.monthlyStats.lastMonth += orderAmount;
          }
        }

        // Status-based calculations (case-insensitive)
        if (normalizedStatus === 'delivered') {
          // Delivered orders: available for withdrawal (regardless of payment method)
          summary.deliveredEarnings += orderAmount;
        } else if (['pending', 'shipped', 'pending delivery'].includes(normalizedStatus)) {
          // Pending orders: not yet available
          if (isEscrowHeld) {
            // Escrow payments held separately
            summary.escrowHeld += orderAmount;
          } else {
            // Regular pending payments (COD or direct payments not yet delivered)
            summary.pendingPayments += orderAmount;
          }
        }

        // Recent orders (last 10)
        if (summary.recentOrders.length < 10) {
          summary.recentOrders.push({
            id: order._id,
            orderNumber: order.orderNumber,
            buyer: order.buyer?.name || 'Unknown',
            product: order.product?.title || 'Unknown Product',
            amount: orderAmount,
            status: order.status || order.orderStatus,
            createdAt: order.createdAt,
            paymentMethod: order.paymentMethod,
            escrowStatus: order.escrowStatus,
            paymentStatus: order.paymentStatus
          });
        }
      });

      // Calculate growth percentage
      if (summary.monthlyStats.lastMonth > 0) {
        summary.monthlyStats.growth = 
          ((summary.monthlyStats.currentMonth - summary.monthlyStats.lastMonth) / 
           summary.monthlyStats.lastMonth) * 100;
      }

      return successResponse(res, "Wallet summary retrieved successfully", {
        summary,
        availableBalance: summary.deliveredEarnings, // Available for withdrawal (delivered orders)
        pendingBalance: summary.pendingPayments, // Pending payments (non-delivered, non-escrow)
        escrowHeld: summary.escrowHeld // Amount held in escrow
      });

    } catch (error) {
      console.error('Error getting wallet summary:', error);
      return errorResponse(res, "Failed to get wallet summary", 500, error.message);
    }
  }

  // Get detailed transaction history
  async getTransactionHistory(req, res) {
    try {
      const userId = req.user._id;
      const { page = 1, limit = 20, status } = req.query;

      const query = { seller: userId };
      if (status) {
        // Check both status fields for compatibility
        query.$or = [
          { status: status },
          { orderStatus: status }
        ];
      }

      const orders = await Order.find(query)
        .populate('buyer', 'name email')
        .populate('product', 'title price product_photos')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const totalOrders = await Order.countDocuments(query);

      const transactions = orders.map(order => ({
        id: order._id,
        orderNumber: order.orderNumber,
        buyer: {
          name: order.buyer?.name || 'Unknown',
          email: order.buyer?.email || 'Unknown'
        },
        product: {
          title: order.product?.title || 'Unknown Product',
          price: order.product?.price || 0,
          image: order.product?.product_photos?.[0] || null
        },
        amount: order.totalAmount || order.orderDetails?.productPrice || 0,
        status: order.status || order.orderStatus,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        escrowStatus: order.escrowStatus,
        createdAt: order.createdAt,
        deliveredAt: (() => {
          const status = (order.status || order.orderStatus || '').toString().toLowerCase();
          return status === 'delivered' ? order.updatedAt : null;
        })()
      }));

      return successResponse(res, "Transaction history retrieved successfully", {
        transactions,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalOrders / limit),
          totalOrders,
          hasNext: page * limit < totalOrders,
          hasPrev: page > 1
        }
      });

    } catch (error) {
      console.error('Error getting transaction history:', error);
      return errorResponse(res, "Failed to get transaction history", 500, error.message);
    }
  }

  // Update wallet balance when order is delivered (called from order controller)
  async updateWalletOnDelivery(orderId, sellerId, amount) {
    try {
      // This method can be called by order controller when delivery is confirmed
      // For now, we'll just log the update since we calculate everything dynamically
      return true;
    } catch (error) {
      console.error('Error updating wallet on delivery:', error);
      return false;
    }
  }
}

module.exports = new WalletController();
