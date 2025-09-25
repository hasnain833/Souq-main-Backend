const Address = require('../../../../db/models/addressModel');
const User = require('../../../../db/models/userModel');
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');

// Get all addresses with pagination and filters
exports.getAllAddresses = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      country,
      addressType,
      isDefault,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    const query = {};

    // Build search query
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { street1: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
        { zipCode: { $regex: search, $options: 'i' } }
      ];
    }

    // Apply filters
    if (country) query.country = country;
    if (addressType) query.addressType = addressType;
    if (isDefault !== undefined && isDefault !== '') query.isDefault = isDefault === 'true';
    if (isActive !== undefined && isActive !== '') query.isActive = isActive === 'true';

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get addresses with user population
    const addresses = await Address.find(query)
      .populate('user', 'userName firstName lastName email profile')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Address.countDocuments(query);

    // Get statistics
    const stats = await Address.aggregate([
      {
        $group: {
          _id: null,
          totalAddresses: { $sum: 1 },
          activeAddresses: { $sum: { $cond: ['$isActive', 1, 0] } },
          defaultAddresses: { $sum: { $cond: ['$isDefault', 1, 0] } }
        }
      }
    ]);

    const statistics = stats[0] || {
      totalAddresses: 0,
      activeAddresses: 0,
      defaultAddresses: 0
    };

    return successResponse(res, 'Addresses retrieved successfully', {
      addresses,
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
    console.error('Get addresses error:', error);
    return errorResponse(res, 'Failed to retrieve addresses', 500);
  }
};

// Get address by ID
exports.getAddressById = async (req, res) => {
  try {
    const { addressId } = req.params;

    const address = await Address.findById(addressId)
      .populate('user', 'userName firstName lastName email profile');

    if (!address) {
      return errorResponse(res, 'Address not found', 404);
    }

    return successResponse(res, 'Address retrieved successfully', { address });

  } catch (error) {
    console.error('Get address by ID error:', error);
    return errorResponse(res, 'Failed to retrieve address', 500);
  }
};

// Update address
exports.updateAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData.user;
    delete updateData._id;
    delete updateData.__v;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    const address = await Address.findByIdAndUpdate(
      addressId,
      updateData,
      { new: true, runValidators: true }
    ).populate('user', 'userName firstName lastName email profile');

    if (!address) {
      return errorResponse(res, 'Address not found', 404);
    }

    return successResponse(res, 'Address updated successfully', { address });

  } catch (error) {
    console.error('Update address error:', error);
    return errorResponse(res, 'Failed to update address', 500);
  }
};

// Delete address
exports.deleteAddress = async (req, res) => {
  try {
    const { addressId } = req.params;

    const address = await Address.findByIdAndDelete(addressId);

    if (!address) {
      return errorResponse(res, 'Address not found', 404);
    }

    return successResponse(res, 'Address deleted successfully', { address });

  } catch (error) {
    console.error('Delete address error:', error);
    return errorResponse(res, 'Failed to delete address', 500);
  }
};

// Get address statistics
exports.getAddressStats = async (req, res) => {
  try {
    const stats = await Address.aggregate([
      {
        $group: {
          _id: null,
          totalAddresses: { $sum: 1 },
          activeAddresses: { $sum: { $cond: ['$isActive', 1, 0] } },
          inactiveAddresses: { $sum: { $cond: ['$isActive', 0, 1] } },
          defaultAddresses: { $sum: { $cond: ['$isDefault', 1, 0] } }
        }
      }
    ]);

    const countryStats = await Address.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$country',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const typeStats = await Address.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$addressType',
          count: { $sum: 1 }
        }
      }
    ]);

    const statistics = stats[0] || {
      totalAddresses: 0,
      activeAddresses: 0,
      inactiveAddresses: 0,
      defaultAddresses: 0
    };

    return successResponse(res, 'Address statistics retrieved successfully', {
      overview: statistics,
      countryDistribution: countryStats,
      typeDistribution: typeStats
    });

  } catch (error) {
    console.error('Get address stats error:', error);
    return errorResponse(res, 'Failed to retrieve address statistics', 500);
  }
};

// Bulk operations
exports.bulkOperations = async (req, res) => {
  try {
    const { operation, addressIds, updateData } = req.body;

    if (!operation || !addressIds || !Array.isArray(addressIds)) {
      return errorResponse(res, 'Invalid bulk operation parameters', 400);
    }

    let result;

    switch (operation) {
      case 'activate':
        result = await Address.updateMany(
          { _id: { $in: addressIds } },
          { $set: { isActive: true } }
        );
        break;

      case 'deactivate':
        result = await Address.updateMany(
          { _id: { $in: addressIds } },
          { $set: { isActive: false } }
        );
        break;

      case 'delete':
        result = await Address.deleteMany({ _id: { $in: addressIds } });
        break;

      case 'update':
        if (!updateData) {
          return errorResponse(res, 'Update data is required for bulk update', 400);
        }
        result = await Address.updateMany(
          { _id: { $in: addressIds } },
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
