const Dispute = require('../../../../db/models/disputeModel');
const Order = require('../../../../db/models/orderModel');
const Product = require('../../../../db/models/productModel');
const User = require('../../../../db/models/userModel');
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');

// Get all disputes with pagination and filters
exports.getAllDisputes = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = 'all',
      type = 'all',
      priority = 'all',
      assignedTo = '',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      dateFrom = '',
      dateTo = ''
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build filter query
    let filter = {};
    
    // Search filter
    if (search) {
      filter.$or = [
        { disputeId: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Status filter
    if (status !== 'all') {
      filter.status = status;
    }

    // Type filter
    if (type !== 'all') {
      filter.type = type;
    }

    // Priority filter
    if (priority !== 'all') {
      filter.priority = priority;
    }

    // Assigned to filter
    if (assignedTo) {
      filter.assignedTo = assignedTo;
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

    // Get disputes with pagination
    const disputes = await Dispute.find(filter)
      .populate('buyerId', 'firstName lastName email userName')
      .populate('sellerId', 'firstName lastName email userName')
      .populate('productId', 'title price')
      .populate('assignedTo', 'firstName lastName email')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count
    const totalDisputes = await Dispute.countDocuments(filter);

    return successResponse(res, 'Disputes retrieved successfully', {
      disputes,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalDisputes / parseInt(limit)),
        totalDisputes,
        hasNext: skip + parseInt(limit) < totalDisputes,
        hasPrev: parseInt(page) > 1
      }
    });

  } catch (error) {
    console.error('Get all disputes error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Get dispute by ID
exports.getDisputeById = async (req, res) => {
  try {
    const { disputeId } = req.params;

    const dispute = await Dispute.findById(disputeId)
      .populate('buyerId', 'firstName lastName email userName profile')
      .populate('sellerId', 'firstName lastName email userName profile')
      .populate('productId', 'title price product_photos')
      .populate('orderId')
      .populate('assignedTo', 'firstName lastName email')
      .populate('resolvedBy', 'firstName lastName email')
      .populate('messages.senderId')
      .lean();

    if (!dispute) {
      return errorResponse(res, 'Dispute not found', 404);
    }

    return successResponse(res, 'Dispute details retrieved successfully', { dispute });

  } catch (error) {
    console.error('Get dispute by ID error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Assign dispute to admin
exports.assignDispute = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { adminId } = req.body;

    const dispute = await Dispute.findById(disputeId);
    if (!dispute) {
      return errorResponse(res, 'Dispute not found', 404);
    }

    dispute.assignedTo = adminId || req.admin._id;
    dispute.status = 'in_progress';
    await dispute.save();

    // Add internal message
    dispute.messages.push({
      senderId: req.admin._id,
      senderType: 'Admin',
      message: `Dispute assigned to admin`,
      isInternal: true
    });
    await dispute.save();

    return successResponse(res, 'Dispute assigned successfully', {
      dispute: {
        id: dispute._id,
        disputeId: dispute.disputeId,
        assignedTo: dispute.assignedTo,
        status: dispute.status
      }
    });

  } catch (error) {
    console.error('Assign dispute error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Add message to dispute
exports.addMessage = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { message, isInternal = false } = req.body;

    if (!message) {
      return errorResponse(res, 'Message is required', 400);
    }

    const dispute = await Dispute.findById(disputeId);
    if (!dispute) {
      return errorResponse(res, 'Dispute not found', 404);
    }

    dispute.messages.push({
      senderId: req.admin._id,
      senderType: 'Admin',
      message,
      isInternal
    });

    await dispute.save();

    return successResponse(res, 'Message added successfully', {
      message: dispute.messages[dispute.messages.length - 1]
    });

  } catch (error) {
    console.error('Add message error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Update dispute priority
exports.updatePriority = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { priority } = req.body;

    if (!['low', 'medium', 'high', 'urgent'].includes(priority)) {
      return errorResponse(res, 'Invalid priority level', 400);
    }

    const dispute = await Dispute.findByIdAndUpdate(
      disputeId,
      { priority },
      { new: true }
    );

    if (!dispute) {
      return errorResponse(res, 'Dispute not found', 404);
    }

    // Add internal message
    dispute.messages.push({
      senderId: req.admin._id,
      senderType: 'Admin',
      message: `Priority updated to ${priority}`,
      isInternal: true
    });
    await dispute.save();

    return successResponse(res, 'Priority updated successfully', {
      dispute: {
        id: dispute._id,
        priority: dispute.priority
      }
    });

  } catch (error) {
    console.error('Update priority error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Resolve dispute
exports.resolveDispute = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { resolution, resolutionDetails, refundAmount = 0 } = req.body;

    if (!resolution) {
      return errorResponse(res, 'Resolution type is required', 400);
    }

    const validResolutions = ['refund_buyer', 'favor_seller', 'partial_refund', 'replacement', 'other'];
    if (!validResolutions.includes(resolution)) {
      return errorResponse(res, 'Invalid resolution type', 400);
    }

    const dispute = await Dispute.findById(disputeId);
    if (!dispute) {
      return errorResponse(res, 'Dispute not found', 404);
    }

    if (dispute.status === 'resolved' || dispute.status === 'closed') {
      return errorResponse(res, 'Dispute is already resolved', 400);
    }

    dispute.status = 'resolved';
    dispute.resolution = resolution;
    dispute.resolutionDetails = resolutionDetails;
    dispute.refundAmount = refundAmount;
    dispute.resolvedAt = new Date();
    dispute.resolvedBy = req.admin._id;

    await dispute.save();

    // Add resolution message
    dispute.messages.push({
      senderId: req.admin._id,
      senderType: 'Admin',
      message: `Dispute resolved: ${resolution}. ${resolutionDetails || ''}`,
      isInternal: false
    });
    await dispute.save();

    // TODO: Process refund if applicable
    // TODO: Send notifications to buyer and seller

    return successResponse(res, 'Dispute resolved successfully', {
      dispute: {
        id: dispute._id,
        disputeId: dispute.disputeId,
        status: dispute.status,
        resolution: dispute.resolution,
        resolvedAt: dispute.resolvedAt
      }
    });

  } catch (error) {
    console.error('Resolve dispute error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Escalate dispute
exports.escalateDispute = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { reason } = req.body;

    const dispute = await Dispute.findById(disputeId);
    if (!dispute) {
      return errorResponse(res, 'Dispute not found', 404);
    }

    dispute.status = 'escalated';
    dispute.priority = 'urgent';
    await dispute.save();

    // Add escalation message
    dispute.messages.push({
      senderId: req.admin._id,
      senderType: 'Admin',
      message: `Dispute escalated. Reason: ${reason || 'No reason provided'}`,
      isInternal: true
    });
    await dispute.save();

    return successResponse(res, 'Dispute escalated successfully', {
      dispute: {
        id: dispute._id,
        disputeId: dispute.disputeId,
        status: dispute.status,
        priority: dispute.priority
      }
    });

  } catch (error) {
    console.error('Escalate dispute error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Close dispute
exports.closeDispute = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { notes } = req.body;

    const dispute = await Dispute.findById(disputeId);
    if (!dispute) {
      return errorResponse(res, 'Dispute not found', 404);
    }

    if (dispute.status !== 'resolved') {
      return errorResponse(res, 'Dispute must be resolved before closing', 400);
    }

    dispute.status = 'closed';
    await dispute.save();

    // Add closing message
    dispute.messages.push({
      senderId: req.admin._id,
      senderType: 'Admin',
      message: `Dispute closed. ${notes || ''}`,
      isInternal: true
    });
    await dispute.save();

    return successResponse(res, 'Dispute closed successfully');

  } catch (error) {
    console.error('Close dispute error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Get dispute statistics
exports.getDisputeStats = async (req, res) => {
  try {
    const [
      totalDisputes,
      openDisputes,
      inProgressDisputes,
      resolvedDisputes,
      escalatedDisputes,
      disputesByType,
      disputesByPriority,
      avgResolutionTime
    ] = await Promise.all([
      Dispute.countDocuments(),
      Dispute.countDocuments({ status: 'open' }),
      Dispute.countDocuments({ status: 'in_progress' }),
      Dispute.countDocuments({ status: 'resolved' }),
      Dispute.countDocuments({ status: 'escalated' }),
      Dispute.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Dispute.aggregate([
        { $group: { _id: '$priority', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Dispute.aggregate([
        { $match: { status: 'resolved', resolvedAt: { $ne: null } } },
        { $project: { 
          resolutionTime: { 
            $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 1000 * 60 * 60 * 24] 
          } 
        }},
        { $group: { _id: null, avgDays: { $avg: '$resolutionTime' } } }
      ])
    ]);

    return successResponse(res, 'Dispute statistics retrieved successfully', {
      stats: {
        totalDisputes,
        openDisputes,
        inProgressDisputes,
        resolvedDisputes,
        escalatedDisputes,
        disputesByType,
        disputesByPriority,
        avgResolutionTime: avgResolutionTime[0]?.avgDays || 0
      }
    });

  } catch (error) {
    console.error('Get dispute stats error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};
