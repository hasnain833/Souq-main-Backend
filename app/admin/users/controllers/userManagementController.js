const User = require('../../../../db/models/userModel');
const Product = require('../../../../db/models/productModel');
const Order = require('../../../../db/models/orderModel');
const Session = require('../../../../db/models/sessionModel');
const Rating = require('../../../../db/models/ratingModel');
const Notification = require('../../../../db/models/notificationModel');
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');
const { getIO } = require('../../../../utils/socket');
const { sendMail } = require('../../../../utils/senMail');

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

    // Status filter - use status field if available, fallback to deletedAt
    if (status === 'active') {
      filter.$or = [
        { status: 'active' },
        { status: { $exists: false }, deletedAt: null }
      ];
    } else if (status === 'suspended') {
      filter.$or = [
        { status: 'suspended' },
        { status: { $exists: false }, deletedAt: { $ne: null } }
      ];
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

    // Fetch list and total count in parallel; project only fields needed for table
    const parsedLimit = parseInt(limit);
    const [users, totalUsers] = await Promise.all([
      User.find(filter)
        .select('firstName lastName userName email createdAt status deletedAt profile country')
        .sort(sortOptions)
        .skip(skip)
        .limit(parsedLimit)
        .lean(),
      User.countDocuments(filter)
    ]);

    // Optimize: Get stats for all users in bulk using aggregation (instead of N+1 queries)
    const userIds = users.map(u => u._id);
    
    // Get product counts for all users in one aggregation query
    const productCountsMap = {};
    const orderCountsMap = {};
    if (userIds.length > 0) {
      const [productCounts, buyerCounts, sellerCounts] = await Promise.all([
        Product.aggregate([
          { $match: { user: { $in: userIds } } },
          { $group: { _id: '$user', count: { $sum: 1 } } }
        ]),
        Order.aggregate([
          { $match: { buyer: { $in: userIds } } },
          { $group: { _id: '$buyer', count: { $sum: 1 } } }
        ]),
        Order.aggregate([
          { $match: { seller: { $in: userIds } } },
          { $group: { _id: '$seller', count: { $sum: 1 } } }
        ])
      ]);

      productCounts.forEach(item => {
        if (item?._id) productCountsMap[item._id.toString()] = item.count;
      });

      buyerCounts.forEach(item => {
        if (item?._id) {
          const idStr = item._id.toString();
          orderCountsMap[idStr] = (orderCountsMap[idStr] || 0) + item.count;
        }
      });

      sellerCounts.forEach(item => {
        if (item?._id) {
          const idStr = item._id.toString();
          orderCountsMap[idStr] = (orderCountsMap[idStr] || 0) + item.count;
        }
      });
    }

    // Map stats to users (no additional queries needed)
    const usersWithStats = users.map(user => ({
      ...user,
      stats: {
        totalProducts: productCountsMap[user._id.toString()] || 0,
        totalOrders: orderCountsMap[user._id.toString()] || 0,
        isActive: !user.deletedAt
      }
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
      Order.countDocuments({ $or: [{ buyer: user._id }, { seller: user._id }] }),
      Order.aggregate([
        { $match: { seller: user._id, orderStatus: 'Delivered' } },
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
      $or: [{ buyer: user._id }, { seller: user._id }] 
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('product', 'title')
      .select('orderNumber orderStatus totalAmount createdAt')
      .lean();

    // Get user reviews (ratings received by this user)
    const reviews = await Rating.find({ 
      ratedUser: user._id,
      status: 'published'
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('ratedBy', 'firstName lastName userName profile')
      .populate('product', 'title product_photos')
      .select('rating review ratingType categories createdAt product')
      .lean();

    // Get review statistics
    const reviewStats = await Rating.aggregate([
      {
        $match: {
          ratedUser: user._id,
          status: 'published'
        }
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          ratingDistribution: {
            $push: '$rating'
          }
        }
      }
    ]);

    const stats = reviewStats[0] || {
      averageRating: 0,
      totalReviews: 0,
      ratingDistribution: []
    };

    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    stats.ratingDistribution.forEach(rating => {
      if (rating >= 1 && rating <= 5) {
        ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
      }
    });

    const userWithDetails = {
      ...user,
      stats: {
        totalProducts: productCount,
        totalOrders: orderCount,
        totalSales: totalSales[0]?.total || 0,
        isActive: user.status !== 'suspended' && !user.deletedAt,
        joinedDaysAgo: Math.floor((Date.now() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24)),
        averageRating: Math.round((stats.averageRating || 0) * 10) / 10,
        totalReviews: stats.totalReviews || 0,
        ratingDistribution
      },
      recentProducts,
      recentOrders,
      reviews
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

    // Check if user is already suspended (check both status and deletedAt)
    if (user.status === 'suspended' || user.deletedAt) {
      return errorResponse(res, 'User is already suspended', 400);
    }

    // Use findByIdAndUpdate to avoid validation issues with roles field
    // Set both status and deletedAt to suspend user (keep both fields in sync)
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        status: 'suspended',
        deletedAt: new Date(),
        refreshToken: null
      },
      { new: true, runValidators: false }
    );

    if (!updatedUser) {
      return errorResponse(res, 'User not found', 404);
    }

    // Delete all active sessions for this user
    try {
      await Session.deleteMany({ userId: updatedUser._id });
    } catch (sessionError) {
      console.error('Error deleting user sessions:', sessionError);
      // Continue even if session deletion fails
    }

    // TODO: Add suspension reason to a separate collection if needed
    // TODO: Send notification to user about suspension

    return successResponse(res, 'User suspended successfully. All active sessions have been invalidated.', {
      user: {
        id: updatedUser._id,
        email: updatedUser.email,
        status: updatedUser.status,
        suspendedAt: updatedUser.deletedAt,
        reason
      }
    });

  } catch (error) {
    console.error('Suspend user error:', error);
    return errorResponse(res, 'Internal server error', 500, error.message);
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

    // Check if user is suspended (check both status and deletedAt)
    if (user.status !== 'suspended' && !user.deletedAt) {
      return errorResponse(res, 'User is not suspended', 400);
    }

    // Use findByIdAndUpdate to avoid validation issues with roles field
    // Set both status and deletedAt to reactivate user (keep both fields in sync)
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        status: 'active',
        deletedAt: null
      },
      { new: true, runValidators: false }
    );

    if (!updatedUser) {
      return errorResponse(res, 'User not found', 404);
    }

    // TODO: Send notification to user about reactivation

    return successResponse(res, 'User reactivated successfully', {
      user: {
        id: updatedUser._id,
        email: updatedUser.email,
        status: updatedUser.status,
        reactivatedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Reactivate user error:', error);
    return errorResponse(res, 'Internal server error', 500, error.message);
  }
};

// Delete user permanently
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return errorResponse(res, 'Deletion reason is required', 400);
    }

    const user = await User.findById(userId);
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    // Check if user has active orders or products
    const [activeProducts, activeOrders] = await Promise.all([
      Product.countDocuments({ user: user._id, status: 'active' }),
      Order.countDocuments({
        $or: [{ buyer: user._id }, { seller: user._id }],
        orderStatus: { $in: ['Pending', 'Shipped'] }
      })
    ]);

    if (activeProducts > 0 || activeOrders > 0) {
      return errorResponse(res, 'Cannot delete user with active products or orders', 400);
    }

    const deletionReason = reason.trim();
    const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.userName || user.email;

    // Send notification to user before deletion
    try {
      const notification = await Notification.createNotification({
        recipient: user._id,
        sender: req.admin?._id,
        title: 'Account Deleted',
        message: `Your account has been permanently deleted. Reason: ${deletionReason}`,
        type: 'admin',
        priority: 'high',
        relatedData: {
          metadata: {
            action: 'account_deleted',
            reason: deletionReason,
            deletedBy: req.admin?._id,
            deletedAt: new Date()
          }
        }
      });

      // Emit real-time notification if socket is available
      const io = getIO();
      if (io) {
        const targetRoom = `user_${user._id.toString()}`;
        io.to(targetRoom).emit('new_notification', notification);
        const unreadCount = await Notification.getUnreadCount(user._id);
        io.to(targetRoom).emit('unread_count_updated', { unreadCount });
      }
    } catch (notificationError) {
      console.error('Error sending deletion notification:', notificationError);
      // Continue with deletion even if notification fails
    }

    // Send email notification to user
    try {
      if (user.email) {
        const emailSubject = 'Your Account Has Been Deleted - Habibi ماركت';
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #dc2626;">Account Deletion Notice</h2>
            <p>Dear ${userName},</p>
            <p>We are writing to inform you that your account on Habibi ماركت has been permanently deleted by an administrator.</p>
            <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 12px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Reason for deletion:</strong></p>
              <p style="margin: 8px 0 0 0;">${deletionReason}</p>
            </div>
            <p>This action is permanent and cannot be undone. All your data, including products, orders, and account information, has been removed from our system.</p>
            <p>If you believe this was done in error, please contact our support team immediately.</p>
            <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">Best regards,<br>Habibi ماركت Team</p>
          </div>
        `;
        await sendMail(user.email, emailSubject, emailHtml);
      }
    } catch (emailError) {
      console.error('Error sending deletion email:', emailError);
      // Continue with deletion even if email fails
    }

    // Delete all user sessions
    try {
      await Session.deleteMany({ userId: user._id });
    } catch (sessionError) {
      console.error('Error deleting user sessions:', sessionError);
      // Continue with deletion even if session deletion fails
    }

    // Delete user permanently
    await User.findByIdAndDelete(userId);

    return successResponse(res, 'User deleted permanently. Notification sent to user.', {
      deletedUser: {
        id: user._id,
        email: user.email,
        reason: deletionReason
      }
    });

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
