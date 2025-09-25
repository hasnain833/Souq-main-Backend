const User = require('../../../../db/models/userModel');
const Product = require('../../../../db/models/productModel');
const Order = require('../../../../db/models/orderModel');
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');

// Get all users with pagination and filters
exports.getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = 'all',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      country = '',
      dateFrom = '',
      dateTo = ''
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build filter query
    let filter = {};
    
    // Search filter
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { userName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Status filter
    if (status === 'active') {
      filter.deletedAt = null;
    } else if (status === 'suspended') {
      filter.deletedAt = { $ne: null };
    }

    // Country filter
    if (country) {
      filter.country = country;
    }

    // Date range filter
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get users with pagination
    const users = await User.find(filter)
      .select('-password -refreshToken -otp')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count
    const totalUsers = await User.countDocuments(filter);

    // Get additional stats for each user
    const usersWithStats = await Promise.all(users.map(async (user) => {
      const [productCount, orderCount] = await Promise.all([
        Product.countDocuments({ user: user._id }),
        Order.countDocuments({ $or: [{ buyerId: user._id }, { sellerId: user._id }] })
      ]);

      return {
        ...user,
        stats: {
          totalProducts: productCount,
          totalOrders: orderCount,
          isActive: !user.deletedAt
        }
      };
    }));

    return successResponse(res, 'Users retrieved successfully', {
      users: usersWithStats,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalUsers / parseInt(limit)),
        totalUsers,
        hasNext: skip + parseInt(limit) < totalUsers,
        hasPrev: parseInt(page) > 1
      }
    });

  } catch (error) {
    console.error('Get all users error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .select('-password -refreshToken -otp')
      .lean();

    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    // Get user statistics
    const [productCount, orderCount, totalSales] = await Promise.all([
      Product.countDocuments({ user: user._id }),
      Order.countDocuments({ $or: [{ buyerId: user._id }, { sellerId: user._id }] }),
      Order.aggregate([
        { $match: { sellerId: user._id, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ])
    ]);

    // Get recent products
    const recentProducts = await Product.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title price status createdAt product_photos')
      .lean();

    // Get recent orders
    const recentOrders = await Order.find({ 
      $or: [{ buyerId: user._id }, { sellerId: user._id }] 
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('productId', 'title')
      .select('orderId status totalAmount createdAt')
      .lean();

    const userWithDetails = {
      ...user,
      stats: {
        totalProducts: productCount,
        totalOrders: orderCount,
        totalSales: totalSales[0]?.total || 0,
        isActive: !user.deletedAt,
        joinedDaysAgo: Math.floor((Date.now() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24))
      },
      recentProducts,
      recentOrders
    };

    return successResponse(res, 'User details retrieved successfully', { user: userWithDetails });

  } catch (error) {
    console.error('Get user by ID error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Update user
exports.updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const updateData = req.body;

    // Remove sensitive fields that shouldn't be updated via admin
    delete updateData.password;
    delete updateData.refreshToken;
    delete updateData.otp;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, select: '-password -refreshToken -otp' }
    );

    if (!updatedUser) {
      return errorResponse(res, 'User not found', 404);
    }

    return successResponse(res, 'User updated successfully', { user: updatedUser });

  } catch (error) {
    console.error('Update user error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Suspend user
exports.suspendUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    if (user.deletedAt) {
      return errorResponse(res, 'User is already suspended', 400);
    }

    user.deletedAt = new Date();
    await user.save();

    // TODO: Add suspension reason to a separate collection if needed
    // TODO: Send notification to user about suspension

    return successResponse(res, 'User suspended successfully', {
      user: {
        id: user._id,
        email: user.email,
        suspendedAt: user.deletedAt,
        reason
      }
    });

  } catch (error) {
    console.error('Suspend user error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Reactivate user
exports.reactivateUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    if (!user.deletedAt) {
      return errorResponse(res, 'User is not suspended', 400);
    }

    user.deletedAt = null;
    await user.save();

    // TODO: Send notification to user about reactivation

    return successResponse(res, 'User reactivated successfully', {
      user: {
        id: user._id,
        email: user.email,
        reactivatedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Reactivate user error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Delete user permanently
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    // Check if user has active orders or products
    const [activeProducts, activeOrders] = await Promise.all([
      Product.countDocuments({ user: user._id, status: 'active' }),
      Order.countDocuments({
        $or: [{ buyerId: user._id }, { sellerId: user._id }],
        status: { $in: ['pending', 'processing', 'shipped'] }
      })
    ]);

    if (activeProducts > 0 || activeOrders > 0) {
      return errorResponse(res, 'Cannot delete user with active products or orders', 400);
    }

    await User.findByIdAndDelete(userId);

    return successResponse(res, 'User deleted permanently');

  } catch (error) {
    console.error('Delete user error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Get user statistics
exports.getUserStats = async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      newUsersThisMonth,
      topCountries
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ deletedAt: null }),
      User.countDocuments({ deletedAt: { $ne: null } }),
      User.countDocuments({
        createdAt: {
          $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        }
      }),
      User.aggregate([
        { $match: { deletedAt: null } },
        { $group: { _id: '$country', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ])
    ]);

    return successResponse(res, 'User statistics retrieved successfully', {
      stats: {
        totalUsers,
        activeUsers,
        suspendedUsers,
        newUsersThisMonth,
        topCountries
      }
    });

  } catch (error) {
    console.error('Get user stats error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};
