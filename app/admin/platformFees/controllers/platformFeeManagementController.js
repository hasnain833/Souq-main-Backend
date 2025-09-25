const PlatformFee = require('../../../../db/models/platformFeeModel');
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');

// Get all platform fees with pagination and filters
exports.getAllPlatformFees = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      feeType,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    const query = {};

    // Build search query
    if (search) {
      query.$or = [
        { version: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } }
      ];
    }

    // Apply filters
    if (feeType && feeType !== '') query.feeType = feeType;
    if (isActive !== undefined && isActive !== '') query.isActive = isActive === 'true';

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get platform fees
    const platformFees = await PlatformFee.find(query)
      .populate({
        path: 'lastModifiedBy',
        select: 'userName firstName lastName email',
        model: 'Admin'
      })
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await PlatformFee.countDocuments(query);

    // Get statistics
    const stats = await PlatformFee.aggregate([
      {
        $group: {
          _id: null,
          totalConfigurations: { $sum: 1 },
          activeConfigurations: { $sum: { $cond: ['$isActive', 1, 0] } },
          totalFeesCollected: { $sum: '$statistics.totalFeesCollected' },
          totalTransactions: { $sum: '$statistics.totalTransactions' }
        }
      }
    ]);

    const statistics = stats[0] || {
      totalConfigurations: 0,
      activeConfigurations: 0,
      totalFeesCollected: 0,
      totalTransactions: 0
    };

    return successResponse(res, 'Platform fees retrieved successfully', {
      platformFees,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
      },
      statistics
    });

  } catch (error) {
    console.error('Get platform fees error:', error);
    return errorResponse(res, 'Failed to retrieve platform fees', 500);
  }
};

// Get platform fee by ID
exports.getPlatformFeeById = async (req, res) => {
  try {
    const { feeId } = req.params;

    const platformFee = await PlatformFee.findById(feeId)
      .populate({
        path: 'lastModifiedBy',
        select: 'userName firstName lastName email',
        model: 'Admin'
      });

    if (!platformFee) {
      return errorResponse(res, 'Platform fee configuration not found', 404);
    }

    return successResponse(res, 'Platform fee retrieved successfully', { platformFee });

  } catch (error) {
    console.error('Get platform fee by ID error:', error);
    return errorResponse(res, 'Failed to retrieve platform fee', 500);
  }
};

// Create new platform fee configuration
exports.createPlatformFee = async (req, res) => {
  try {
    const feeData = req.body;
    feeData.lastModifiedBy = req.admin._id;

    const platformFee = new PlatformFee(feeData);
    await platformFee.save();

    await platformFee.populate({
      path: 'lastModifiedBy',
      select: 'userName firstName lastName email',
      model: 'Admin'
    });

    return successResponse(res, 'Platform fee configuration created successfully', { platformFee }, 201);

  } catch (error) {
    console.error('Create platform fee error:', error);
    return errorResponse(res, 'Failed to create platform fee configuration', 500);
  }
};

// Update platform fee configuration
exports.updatePlatformFee = async (req, res) => {
  try {
    const { feeId } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData._id;
    delete updateData.__v;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    delete updateData.statistics;

    // Set last modified by
    updateData.lastModifiedBy = req.admin._id;

    const platformFee = await PlatformFee.findByIdAndUpdate(
      feeId,
      updateData,
      { new: true, runValidators: true }
    ).populate({
      path: 'lastModifiedBy',
      select: 'userName firstName lastName email',
      model: 'Admin'
    });

    if (!platformFee) {
      return errorResponse(res, 'Platform fee configuration not found', 404);
    }

    return successResponse(res, 'Platform fee configuration updated successfully', { platformFee });

  } catch (error) {
    console.error('Update platform fee error:', error);
    return errorResponse(res, 'Failed to update platform fee configuration', 500);
  }
};

// Delete platform fee configuration
exports.deletePlatformFee = async (req, res) => {
  try {
    const { feeId } = req.params;

    const platformFee = await PlatformFee.findByIdAndDelete(feeId);

    if (!platformFee) {
      return errorResponse(res, 'Platform fee configuration not found', 404);
    }

    return successResponse(res, 'Platform fee configuration deleted successfully', { platformFee });

  } catch (error) {
    console.error('Delete platform fee error:', error);
    return errorResponse(res, 'Failed to delete platform fee configuration', 500);
  }
};

// Get platform fee statistics
exports.getPlatformFeeStats = async (req, res) => {
  try {
    const stats = await PlatformFee.aggregate([
      {
        $group: {
          _id: null,
          totalConfigurations: { $sum: 1 },
          activeConfigurations: { $sum: { $cond: ['$isActive', 1, 0] } },
          totalFeesCollected: { $sum: '$statistics.totalFeesCollected' },
          totalTransactions: { $sum: '$statistics.totalTransactions' },
          avgFeePercentage: { $avg: '$defaultPercentage' }
        }
      }
    ]);

    const feeTypeStats = await PlatformFee.aggregate([
      {
        $group: {
          _id: '$feeType',
          count: { $sum: 1 }
        }
      }
    ]);

    const currencyStats = await PlatformFee.aggregate([
      { $unwind: '$currencyFees' },
      {
        $group: {
          _id: '$currencyFees.currency',
          count: { $sum: 1 },
          avgPercentage: { $avg: '$currencyFees.percentage' },
          avgMinimumFee: { $avg: '$currencyFees.minimumFee' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const revenueStats = await PlatformFee.aggregate([
      {
        $project: {
          month: { $month: '$updatedAt' },
          year: { $year: '$updatedAt' },
          feesCollected: '$statistics.totalFeesCollected'
        }
      },
      {
        $group: {
          _id: { year: '$year', month: '$month' },
          totalRevenue: { $sum: '$feesCollected' }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    const statistics = {
      overview: stats[0] || {
        totalConfigurations: 0,
        activeConfigurations: 0,
        totalFeesCollected: 0,
        totalTransactions: 0,
        avgFeePercentage: 0
      },
      feeTypeDistribution: feeTypeStats,
      currencyDistribution: currencyStats,
      revenueHistory: revenueStats
    };

    return successResponse(res, 'Platform fee statistics retrieved successfully', statistics);

  } catch (error) {
    console.error('Get platform fee stats error:', error);
    return errorResponse(res, 'Failed to retrieve platform fee statistics', 500);
  }
};

// Bulk operations
exports.bulkOperations = async (req, res) => {
  try {
    const { operation, feeIds, updateData } = req.body;

    if (!operation || !feeIds || !Array.isArray(feeIds)) {
      return errorResponse(res, 'Invalid bulk operation parameters', 400);
    }

    let result;

    switch (operation) {
      case 'activate':
        result = await PlatformFee.updateMany(
          { _id: { $in: feeIds } },
          { $set: { isActive: true, lastModifiedBy: req.admin._id } }
        );
        break;

      case 'deactivate':
        result = await PlatformFee.updateMany(
          { _id: { $in: feeIds } },
          { $set: { isActive: false, lastModifiedBy: req.admin._id } }
        );
        break;

      case 'delete':
        result = await PlatformFee.deleteMany({ _id: { $in: feeIds } });
        break;

      case 'update':
        if (!updateData) {
          return errorResponse(res, 'Update data is required for bulk update', 400);
        }
        updateData.lastModifiedBy = req.admin._id;
        result = await PlatformFee.updateMany(
          { _id: { $in: feeIds } },
          { $set: updateData }
        );
        break;

      default:
        return errorResponse(res, 'Invalid bulk operation', 400);
    }

    return successResponse(res, `Bulk ${operation} completed successfully`, {
      modifiedCount: result.modifiedCount || result.deletedCount,
      operation
    });

  } catch (error) {
    console.error('Bulk operations error:', error);
    return errorResponse(res, 'Failed to perform bulk operation', 500);
  }
};

// Calculate fee for a transaction
exports.calculateFee = async (req, res) => {
  try {
    const { amount, currency = 'USD', categoryId, userId } = req.body;

    if (!amount || amount <= 0) {
      return errorResponse(res, 'Valid amount is required', 400);
    }

    // Get active platform fee configuration
    const platformFee = await PlatformFee.findOne({ isActive: true });

    if (!platformFee) {
      return errorResponse(res, 'No active platform fee configuration found', 404);
    }

    let feeAmount = 0;
    let feePercentage = platformFee.defaultPercentage;

    // Check for currency-specific fees
    const currencyFee = platformFee.currencyFees.find(cf => cf.currency === currency);
    if (currencyFee) {
      feePercentage = currencyFee.percentage;
      feeAmount = (amount * feePercentage) / 100;

      // Apply minimum and maximum fee limits
      if (currencyFee.minimumFee && feeAmount < currencyFee.minimumFee) {
        feeAmount = currencyFee.minimumFee;
      }
      if (currencyFee.maximumFee && feeAmount > currencyFee.maximumFee) {
        feeAmount = currencyFee.maximumFee;
      }
    } else {
      // Use default percentage
      feeAmount = (amount * feePercentage) / 100;
    }

    // Apply global limits
    if (platformFee.globalLimits.minimumFee && feeAmount < platformFee.globalLimits.minimumFee) {
      feeAmount = platformFee.globalLimits.minimumFee;
    }
    if (platformFee.globalLimits.maximumFee && feeAmount > platformFee.globalLimits.maximumFee) {
      feeAmount = platformFee.globalLimits.maximumFee;
    }

    const calculation = {
      originalAmount: amount,
      currency,
      feePercentage,
      feeAmount: Math.round(feeAmount * 100) / 100, // Round to 2 decimal places
      netAmount: Math.round((amount - feeAmount) * 100) / 100,
      configuration: {
        id: platformFee._id,
        version: platformFee.version
      }
    };

    return successResponse(res, 'Fee calculated successfully', calculation);

  } catch (error) {
    console.error('Calculate fee error:', error);
    return errorResponse(res, 'Failed to calculate fee', 500);
  }
};
