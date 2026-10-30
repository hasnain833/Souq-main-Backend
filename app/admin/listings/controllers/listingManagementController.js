const Product = require('../../../../db/models/productModel');
const User = require('../../../../db/models/userModel');
const Category = require('../../../../db/models/categoryModel');
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');

// Get all listings with pagination and filters
exports.getAllListings = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = 'all',
      category = '',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      priceMin = '',
      priceMax = '',
      dateFrom = '',
      dateTo = ''
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build filter query
    let filter = {};
    
    // Search filter
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } }
      ];
    }

    // Status filter
    if (status !== 'all') {
      filter.status = status;
    }

    // Category filter
    if (category) {
      filter.category = category;
    }

    // Price range filter
    if (priceMin || priceMax) {
      filter.price = {};
      if (priceMin) filter.price.$gte = parseFloat(priceMin);
      if (priceMax) filter.price.$lte = parseFloat(priceMax);
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

    // Get listings with pagination
    const listings = await Product.find(filter)
      .populate('user', 'firstName lastName email userName')
      .populate('category', 'name')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count
    const totalListings = await Product.countDocuments(filter);

    return successResponse(res, 'Listings retrieved successfully', {
      listings,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalListings / parseInt(limit)),
        totalListings,
        hasNext: skip + parseInt(limit) < totalListings,
        hasPrev: parseInt(page) > 1
      }
    });

  } catch (error) {
    console.error('Get all listings error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Get listing by ID
exports.getListingById = async (req, res) => {
  try {
    const { listingId } = req.params;

    const listing = await Product.findById(listingId)
      .populate('user', 'firstName lastName email userName profile')
      .populate('category', 'name')
      .lean();

    if (!listing) {
      return errorResponse(res, 'Listing not found', 404);
    }

    // Debug logging (can be removed in production)
    console.log('Listing detail requested:', listing._id, 'Photos:', listing.product_photos?.length || 0);

    return successResponse(res, 'Listing details retrieved successfully', { listing });

  } catch (error) {
    console.error('Get listing by ID error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Update listing
exports.updateListing = async (req, res) => {
  try {
    const { listingId } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated via admin
    delete updateData.user;
    delete updateData.createdAt;

    const updatedListing = await Product.findByIdAndUpdate(
      listingId,
      updateData,
      { new: true }
    ).populate('user', 'firstName lastName email userName')
     .populate('category', 'name');

    if (!updatedListing) {
      return errorResponse(res, 'Listing not found', 404);
    }

    return successResponse(res, 'Listing updated successfully', { listing: updatedListing });

  } catch (error) {
    console.error('Update listing error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Update listing status
exports.updateListingStatus = async (req, res) => {
  try {
    const { listingId } = req.params;
    const { status } = req.body;

    if (!status) {
      return errorResponse(res, 'Status is required', 400);
    }

    const validStatuses = ['pending', 'approved', 'rejected', 'suspended'];
    if (!validStatuses.includes(status)) {
      return errorResponse(res, 'Invalid status', 400);
    }

    const listing = await Product.findById(listingId);
    if (!listing) {
      return errorResponse(res, 'Listing not found', 404);
    }

    const oldStatus = listing.status;
    listing.status = status;

    // Set appropriate timestamps based on status
    if (status === 'approved') {
      listing.approvedAt = new Date();
      listing.approvedBy = req.admin._id;
    } else if (status === 'rejected') {
      listing.rejectedAt = new Date();
      listing.rejectedBy = req.admin._id;
    } else if (status === 'suspended') {
      listing.suspendedAt = new Date();
      listing.suspendedBy = req.admin._id;
    }

    await listing.save();

    return successResponse(res, `Listing status updated from ${oldStatus} to ${status}`, {
      listing: {
        id: listing._id,
        title: listing.title,
        status: listing.status,
        updatedAt: listing.updatedAt
      }
    });

  } catch (error) {
    console.error('Update listing status error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Approve listing
exports.approveListing = async (req, res) => {
  try {
    const { listingId } = req.params;
    const { notes } = req.body;

    const listing = await Product.findById(listingId);
    if (!listing) {
      return errorResponse(res, 'Listing not found', 404);
    }

    if (listing.status === 'active') {
      return errorResponse(res, 'Listing is already approved', 400);
    }

    listing.status = 'active';
    listing.approvedAt = new Date();
    listing.approvedBy = req.admin._id;
    if (notes) listing.adminNotes = notes;

    await listing.save();

    // TODO: Send notification to seller about approval

    return successResponse(res, 'Listing approved successfully', {
      listing: {
        id: listing._id,
        title: listing.title,
        status: listing.status,
        approvedAt: listing.approvedAt
      }
    });

  } catch (error) {
    console.error('Approve listing error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Reject listing
exports.rejectListing = async (req, res) => {
  try {
    const { listingId } = req.params;
    const { reason, notes } = req.body;

    if (!reason) {
      return errorResponse(res, 'Rejection reason is required', 400);
    }

    const listing = await Product.findById(listingId);
    if (!listing) {
      return errorResponse(res, 'Listing not found', 404);
    }

    listing.status = 'rejected';
    listing.rejectedAt = new Date();
    listing.rejectedBy = req.admin._id;
    listing.rejectionReason = reason;
    if (notes) listing.adminNotes = notes;

    await listing.save();

    // TODO: Send notification to seller about rejection

    return successResponse(res, 'Listing rejected successfully', {
      listing: {
        id: listing._id,
        title: listing.title,
        status: listing.status,
        rejectedAt: listing.rejectedAt,
        rejectionReason: listing.rejectionReason
      }
    });

  } catch (error) {
    console.error('Reject listing error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Suspend listing
exports.suspendListing = async (req, res) => {
  try {
    const { listingId } = req.params;
    const { reason, notes } = req.body;

    if (!reason) {
      return errorResponse(res, 'Suspension reason is required', 400);
    }

    const listing = await Product.findById(listingId);
    if (!listing) {
      return errorResponse(res, 'Listing not found', 404);
    }

    listing.status = 'suspended';
    listing.suspendedAt = new Date();
    listing.suspendedBy = req.admin._id;
    listing.suspensionReason = reason;
    if (notes) listing.adminNotes = notes;

    await listing.save();

    // TODO: Send notification to seller about suspension

    return successResponse(res, 'Listing suspended successfully', {
      listing: {
        id: listing._id,
        title: listing.title,
        status: listing.status,
        suspendedAt: listing.suspendedAt,
        suspensionReason: listing.suspensionReason
      }
    });

  } catch (error) {
    console.error('Suspend listing error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Delete listing
exports.deleteListing = async (req, res) => {
  try {
    const { listingId } = req.params;

    const listing = await Product.findById(listingId);
    if (!listing) {
      return errorResponse(res, 'Listing not found', 404);
    }

    // Check if listing has active orders
    // TODO: Add order check when order model is available

    await Product.findByIdAndDelete(listingId);

    return successResponse(res, 'Listing deleted successfully');

  } catch (error) {
    console.error('Delete listing error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Get listing statistics
exports.getListingStats = async (req, res) => {
  try {
    const [
      totalListings,
      activeListings,
      pendingListings,
      rejectedListings,
      suspendedListings,
      topCategories,
      recentListings
    ] = await Promise.all([
      Product.countDocuments(),
      Product.countDocuments({ status: 'active' }),
      Product.countDocuments({ status: 'pending' }),
      Product.countDocuments({ status: 'rejected' }),
      Product.countDocuments({ status: 'suspended' }),
      Product.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
        { $unwind: '$category' },
        { $project: { name: '$category.name', count: 1 } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]),
      Product.find()
        .populate('user', 'firstName lastName')
        .populate('category', 'name')
        .sort({ createdAt: -1 })
        .limit(10)
        .select('title price status createdAt')
        .lean()
    ]);

    return successResponse(res, 'Listing statistics retrieved successfully', {
      stats: {
        totalListings,
        activeListings,
        pendingListings,
        rejectedListings,
        suspendedListings,
        topCategories,
        recentListings
      }
    });

  } catch (error) {
    console.error('Get listing stats error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Bulk actions on listings
exports.bulkActions = async (req, res) => {
  try {
    const { action, listingIds, reason, notes } = req.body;

    if (!action || !listingIds || !Array.isArray(listingIds)) {
      return errorResponse(res, 'Action and listing IDs are required', 400);
    }

    let updateData = {};
    
    switch (action) {
      case 'approve':
        updateData = {
          status: 'active',
          approvedAt: new Date(),
          approvedBy: req.admin._id
        };
        break;
      case 'reject':
        if (!reason) {
          return errorResponse(res, 'Rejection reason is required', 400);
        }
        updateData = {
          status: 'rejected',
          rejectedAt: new Date(),
          rejectedBy: req.admin._id,
          rejectionReason: reason
        };
        break;
      case 'suspend':
        if (!reason) {
          return errorResponse(res, 'Suspension reason is required', 400);
        }
        updateData = {
          status: 'suspended',
          suspendedAt: new Date(),
          suspendedBy: req.admin._id,
          suspensionReason: reason
        };
        break;
      default:
        return errorResponse(res, 'Invalid action', 400);
    }

    if (notes) updateData.adminNotes = notes;

    const result = await Product.updateMany(
      { _id: { $in: listingIds } },
      updateData
    );

    return successResponse(res, `Bulk ${action} completed successfully`, {
      modifiedCount: result.modifiedCount,
      action
    });

  } catch (error) {
    console.error('Bulk actions error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};
