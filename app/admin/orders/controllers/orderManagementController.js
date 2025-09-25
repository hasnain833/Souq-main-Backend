const Order = require('../../../../db/models/orderModel');
const StandardPayment = require('../../../../db/models/standardPaymentModel');
const EscrowTransaction = require('../../../../db/models/escrowTransactionModel');
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');

/**
 * Get all orders with pagination and filters
 */
exports.getAllOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = '',
      paymentMethod = '',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      dateFrom = '',
      dateTo = ''
    } = req.query;

    const skip = (page - 1) * limit;
    const query = {};

    // Search filter
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { 'payment.transactionId': { $regex: search, $options: 'i' } }
      ];
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // Payment method filter
    if (paymentMethod) {
      query['payment.method'] = paymentMethod;
    }

    // Date range filter
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    // Sort configuration
    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get orders with populated data
    const orders = await Order.find(query)
      .populate('buyer', 'firstName lastName email username profile_picture phoneNumber')
      .populate('seller', 'firstName lastName email username profile_picture phoneNumber')
      .populate('product', 'title price product_photos category')
      .sort(sortConfig)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await Order.countDocuments(query);

    // Calculate pagination
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return successResponse(res, 'Orders retrieved successfully', {
      orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalOrders: total,
        hasNext,
        hasPrev,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get all orders error:', error);
    return errorResponse(res, 'Failed to retrieve orders', 500);
  }
};

/**
 * Get orders by payment method (escrow or standard)
 */
exports.getOrdersByPaymentMethod = async (req, res) => {
  try {
    const { method } = req.params; // 'escrow' or 'standard'
    const {
      page = 1,
      limit = 20,
      search = '',
      status = '',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      dateFrom = '',
      dateTo = ''
    } = req.query;

    if (!['escrow', 'standard'].includes(method)) {
      return errorResponse(res, 'Invalid payment method. Must be "escrow" or "standard"', 400);
    }

    const skip = (page - 1) * limit;
    const query = { 'payment.method': method };

    // Search filter
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { 'payment.transactionId': { $regex: search, $options: 'i' } }
      ];
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // Date range filter
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    // Sort configuration
    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get orders with populated data
    const orders = await Order.find(query)
      .populate('buyer', 'firstName lastName email username profile_picture phoneNumber')
      .populate('seller', 'firstName lastName email username profile_picture phoneNumber')
      .populate('product', 'title price product_photos category')
      .sort(sortConfig)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await Order.countDocuments(query);

    // Calculate pagination
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return successResponse(res, `${method.charAt(0).toUpperCase() + method.slice(1)} orders retrieved successfully`, {
      orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalOrders: total,
        hasNext,
        hasPrev,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error(`Get ${method} orders error:`, error);
    return errorResponse(res, `Failed to retrieve ${method} orders`, 500);
  }
};

/**
 * Get order statistics
 */
exports.getOrderStats = async (req, res) => {
  try {
    // Get total orders
    const totalOrders = await Order.countDocuments();

    // Get orders by payment method
    const escrowOrders = await Order.countDocuments({ 'payment.method': 'escrow' });
    const standardOrders = await Order.countDocuments({ 'payment.method': 'standard' });

    // Get orders by status
    const statusStats = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get recent orders (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentOrders = await Order.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    // Get total order value
    const orderValueStats = await Order.aggregate([
      {
        $group: {
          _id: null,
          totalValue: { $sum: '$orderDetails.productPrice' },
          averageValue: { $avg: '$orderDetails.productPrice' }
        }
      }
    ]);

    // Get monthly order trends (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyTrends = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 },
          totalValue: { $sum: '$orderDetails.productPrice' }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    return successResponse(res, 'Order statistics retrieved successfully', {
      totalOrders,
      paymentMethods: {
        escrow: escrowOrders,
        standard: standardOrders
      },
      statusBreakdown: statusStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {}),
      recentOrders,
      orderValue: {
        total: orderValueStats[0]?.totalValue || 0,
        average: orderValueStats[0]?.averageValue || 0
      },
      monthlyTrends
    });

  } catch (error) {
    console.error('Get order stats error:', error);
    return errorResponse(res, 'Failed to retrieve order statistics', 500);
  }
};

/**
 * Get order by ID
 */
exports.getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate('buyer', 'firstName lastName email username profile_picture phoneNumber')
      .populate('seller', 'firstName lastName email username profile_picture phoneNumber')
      .populate('product', 'title price product_photos category description');

    if (!order) {
      return errorResponse(res, 'Order not found', 404);
    }

    return successResponse(res, 'Order retrieved successfully', { order });

  } catch (error) {
    console.error('Get order by ID error:', error);
    return errorResponse(res, 'Failed to retrieve order', 500);
  }
};

/**
 * Update order status
 */
exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, notes } = req.body;

    const validStatuses = [
      'pending_payment', 'paid', 'processing', 'shipped', 
      'in_transit', 'out_for_delivery', 'delivered', 
      'cancelled', 'returned', 'refunded'
    ];

    if (!validStatuses.includes(status)) {
      return errorResponse(res, 'Invalid order status', 400);
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return errorResponse(res, 'Order not found', 404);
    }

    // Update order status
    const oldStatus = order.status;
    order.status = status;

    // Add timeline entry
    order.timeline.push({
      status: status,
      timestamp: new Date(),
      description: notes || `Order status updated from ${oldStatus} to ${status} by admin`,
      updatedBy: 'admin'
    });

    await order.save();

    return successResponse(res, 'Order status updated successfully', { order });

  } catch (error) {
    console.error('Update order status error:', error);
    return errorResponse(res, 'Failed to update order status', 500);
  }
};
