const ShippingProvider = require('../../../../db/models/shippingProviderModel');
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');

// Get all shipping providers with pagination and filters
exports.getAllShippingProviders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    const query = {};

    // Build search query
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { displayName: { $regex: search, $options: 'i' } }
      ];
    }

    // Apply filters
    if (isActive !== undefined && isActive !== '') query.isActive = isActive === 'true';

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get shipping providers
    const shippingProviders = await ShippingProvider.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ShippingProvider.countDocuments(query);

    // Get statistics
    const stats = await ShippingProvider.aggregate([
      {
        $group: {
          _id: null,
          totalProviders: { $sum: 1 },
          activeProviders: { $sum: { $cond: ['$isActive', 1, 0] } },
          totalShipments: { $sum: '$statistics.totalShipments' },
          totalSuccessfulDeliveries: { $sum: '$statistics.successfulDeliveries' }
        }
      }
    ]);

    const statistics = stats[0] || {
      totalProviders: 0,
      activeProviders: 0,
      totalShipments: 0,
      totalSuccessfulDeliveries: 0
    };

    return successResponse(res, 'Shipping providers retrieved successfully', {
      shippingProviders,
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
    console.error('Get shipping providers error:', error);
    return errorResponse(res, 'Failed to retrieve shipping providers', 500);
  }
};

// Get shipping provider by ID
exports.getShippingProviderById = async (req, res) => {
  try {
    const { providerId } = req.params;

    const shippingProvider = await ShippingProvider.findById(providerId);

    if (!shippingProvider) {
      return errorResponse(res, 'Shipping provider not found', 404);
    }

    return successResponse(res, 'Shipping provider retrieved successfully', { shippingProvider });

  } catch (error) {
    console.error('Get shipping provider by ID error:', error);
    return errorResponse(res, 'Failed to retrieve shipping provider', 500);
  }
};

// Create new shipping provider
exports.createShippingProvider = async (req, res) => {
  try {
    const providerData = req.body;

    const shippingProvider = new ShippingProvider(providerData);
    await shippingProvider.save();

    return successResponse(res, 'Shipping provider created successfully', { shippingProvider }, 201);

  } catch (error) {
    console.error('Create shipping provider error:', error);
    return errorResponse(res, 'Failed to create shipping provider', 500);
  }
};

// Update shipping provider
exports.updateShippingProvider = async (req, res) => {
  try {
    const { providerId } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData._id;
    delete updateData.__v;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    delete updateData.statistics;

    const shippingProvider = await ShippingProvider.findByIdAndUpdate(
      providerId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!shippingProvider) {
      return errorResponse(res, 'Shipping provider not found', 404);
    }

    return successResponse(res, 'Shipping provider updated successfully', { shippingProvider });

  } catch (error) {
    console.error('Update shipping provider error:', error);
    return errorResponse(res, 'Failed to update shipping provider', 500);
  }
};

// Delete shipping provider
exports.deleteShippingProvider = async (req, res) => {
  try {
    const { providerId } = req.params;

    const shippingProvider = await ShippingProvider.findByIdAndDelete(providerId);

    if (!shippingProvider) {
      return errorResponse(res, 'Shipping provider not found', 404);
    }

    return successResponse(res, 'Shipping provider deleted successfully', { shippingProvider });

  } catch (error) {
    console.error('Delete shipping provider error:', error);
    return errorResponse(res, 'Failed to delete shipping provider', 500);
  }
};

// Get shipping provider statistics
exports.getShippingProviderStats = async (req, res) => {
  try {
    const stats = await ShippingProvider.aggregate([
      {
        $group: {
          _id: null,
          totalProviders: { $sum: 1 },
          activeProviders: { $sum: { $cond: ['$isActive', 1, 0] } },
          totalShipments: { $sum: '$statistics.totalShipments' },
          totalSuccessfulDeliveries: { $sum: '$statistics.successfulDeliveries' },
          avgDeliveryTime: { $avg: '$statistics.averageDeliveryTime' }
        }
      }
    ]);

    const serviceStats = await ShippingProvider.aggregate([
      { $unwind: '$supportedServices' },
      { $match: { 'supportedServices.isActive': true } },
      {
        $group: {
          _id: '$supportedServices.serviceName',
          count: { $sum: 1 },
          providers: { $addToSet: '$displayName' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const countryStats = await ShippingProvider.aggregate([
      { $unwind: '$supportedCountries' },
      { $match: { 'supportedCountries.isActive': true } },
      {
        $group: {
          _id: '$supportedCountries.countryName',
          providerCount: { $sum: 1 }
        }
      },
      { $sort: { providerCount: -1 } },
      { $limit: 10 }
    ]);

    const performanceStats = await ShippingProvider.aggregate([
      {
        $project: {
          name: 1,
          displayName: 1,
          successRate: {
            $cond: [
              { $gt: ['$statistics.totalShipments', 0] },
              { $multiply: [{ $divide: ['$statistics.successfulDeliveries', '$statistics.totalShipments'] }, 100] },
              0
            ]
          },
          totalShipments: '$statistics.totalShipments',
          averageDeliveryTime: '$statistics.averageDeliveryTime'
        }
      },
      { $sort: { successRate: -1 } }
    ]);

    const statistics = {
      overview: stats[0] || {
        totalProviders: 0,
        activeProviders: 0,
        totalShipments: 0,
        totalSuccessfulDeliveries: 0,
        avgDeliveryTime: 0
      },
      serviceDistribution: serviceStats,
      countryDistribution: countryStats,
      performanceMetrics: performanceStats
    };

    return successResponse(res, 'Shipping provider statistics retrieved successfully', statistics);

  } catch (error) {
    console.error('Get shipping provider stats error:', error);
    return errorResponse(res, 'Failed to retrieve shipping provider statistics', 500);
  }
};

// Bulk operations
exports.bulkOperations = async (req, res) => {
  try {
    const { operation, providerIds, updateData } = req.body;

    if (!operation || !providerIds || !Array.isArray(providerIds)) {
      return errorResponse(res, 'Invalid bulk operation parameters', 400);
    }

    let result;

    switch (operation) {
      case 'activate':
        result = await ShippingProvider.updateMany(
          { _id: { $in: providerIds } },
          { $set: { isActive: true } }
        );
        break;

      case 'deactivate':
        result = await ShippingProvider.updateMany(
          { _id: { $in: providerIds } },
          { $set: { isActive: false } }
        );
        break;

      case 'delete':
        result = await ShippingProvider.deleteMany({ _id: { $in: providerIds } });
        break;

      case 'update':
        if (!updateData) {
          return errorResponse(res, 'Update data is required for bulk update', 400);
        }
        result = await ShippingProvider.updateMany(
          { _id: { $in: providerIds } },
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
