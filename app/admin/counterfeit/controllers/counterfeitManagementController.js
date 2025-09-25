const CounterfeitFlag = require('../../../../db/models/counterfeitFlagModel');
const Product = require('../../../../db/models/productModel');
const User = require('../../../../db/models/userModel');
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');

// Get all counterfeit flags with pagination and filters
exports.getAllFlags = async (req, res) => {
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
        { flagId: { $regex: search, $options: 'i' } },
        { reason: { $regex: search, $options: 'i' } },
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
      filter['investigation.assignedTo'] = assignedTo;
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

    // Get flags with pagination
    const flags = await CounterfeitFlag.find(filter)
      .populate('reporterId', 'firstName lastName email userName')
      .populate('sellerId', 'firstName lastName email userName')
      .populate('productId', 'title price product_photos')
      .populate('investigation.assignedTo', 'firstName lastName email')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count
    const totalFlags = await CounterfeitFlag.countDocuments(filter);

    return successResponse(res, 'Counterfeit flags retrieved successfully', {
      flags,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalFlags / parseInt(limit)),
        totalFlags,
        hasNext: skip + parseInt(limit) < totalFlags,
        hasPrev: parseInt(page) > 1
      }
    });

  } catch (error) {
    console.error('Get all flags error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Get flag by ID
exports.getFlagById = async (req, res) => {
  try {
    const { flagId } = req.params;

    const flag = await CounterfeitFlag.findById(flagId)
      .populate('reporterId', 'firstName lastName email userName profile')
      .populate('sellerId', 'firstName lastName email userName profile')
      .populate('productId', 'title price product_photos description brand')
      .populate('investigation.assignedTo', 'firstName lastName email')
      .populate('investigation.notes.adminId', 'firstName lastName email')
      .populate('actions.performedBy', 'firstName lastName email')
      .populate('resolvedBy', 'firstName lastName email')
      .populate('additionalReporters.userId', 'firstName lastName email userName')
      .lean();

    if (!flag) {
      return errorResponse(res, 'Counterfeit flag not found', 404);
    }

    return successResponse(res, 'Flag details retrieved successfully', { flag });

  } catch (error) {
    console.error('Get flag by ID error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Assign flag for investigation
exports.assignInvestigation = async (req, res) => {
  try {
    const { flagId } = req.params;
    const { adminId } = req.body;

    const flag = await CounterfeitFlag.findById(flagId);
    if (!flag) {
      return errorResponse(res, 'Flag not found', 404);
    }

    flag.status = 'under_investigation';
    flag.investigation.assignedTo = adminId || req.admin._id;
    flag.investigation.startedAt = new Date();

    // Add investigation note
    flag.investigation.notes.push({
      adminId: req.admin._id,
      note: 'Investigation started',
      isInternal: true
    });

    await flag.save();

    return successResponse(res, 'Investigation assigned successfully', {
      flag: {
        id: flag._id,
        flagId: flag.flagId,
        status: flag.status,
        assignedTo: flag.investigation.assignedTo
      }
    });

  } catch (error) {
    console.error('Assign investigation error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Add investigation note
exports.addInvestigationNote = async (req, res) => {
  try {
    const { flagId } = req.params;
    const { note, isInternal = true } = req.body;

    if (!note) {
      return errorResponse(res, 'Note is required', 400);
    }

    const flag = await CounterfeitFlag.findById(flagId);
    if (!flag) {
      return errorResponse(res, 'Flag not found', 404);
    }

    flag.investigation.notes.push({
      adminId: req.admin._id,
      note,
      isInternal
    });

    await flag.save();

    return successResponse(res, 'Investigation note added successfully', {
      note: flag.investigation.notes[flag.investigation.notes.length - 1]
    });

  } catch (error) {
    console.error('Add investigation note error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Update flag priority
exports.updatePriority = async (req, res) => {
  try {
    const { flagId } = req.params;
    const { priority } = req.body;

    if (!['low', 'medium', 'high', 'urgent'].includes(priority)) {
      return errorResponse(res, 'Invalid priority level', 400);
    }

    const flag = await CounterfeitFlag.findByIdAndUpdate(
      flagId,
      { priority },
      { new: true }
    );

    if (!flag) {
      return errorResponse(res, 'Flag not found', 404);
    }

    // Add investigation note
    flag.investigation.notes.push({
      adminId: req.admin._id,
      note: `Priority updated to ${priority}`,
      isInternal: true
    });
    await flag.save();

    return successResponse(res, 'Priority updated successfully', {
      flag: {
        id: flag._id,
        priority: flag.priority
      }
    });

  } catch (error) {
    console.error('Update priority error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Complete investigation with verdict
exports.completeInvestigation = async (req, res) => {
  try {
    const { flagId } = req.params;
    const { verdict, verdictReason } = req.body;

    const validVerdicts = ['counterfeit_confirmed', 'legitimate_product', 'insufficient_evidence', 'requires_further_investigation'];
    if (!validVerdicts.includes(verdict)) {
      return errorResponse(res, 'Invalid verdict', 400);
    }

    const flag = await CounterfeitFlag.findById(flagId);
    if (!flag) {
      return errorResponse(res, 'Flag not found', 404);
    }

    flag.investigation.verdict = verdict;
    flag.investigation.verdictReason = verdictReason;
    flag.investigation.completedAt = new Date();

    // Update status based on verdict
    if (verdict === 'counterfeit_confirmed') {
      flag.status = 'verified';
    } else if (verdict === 'legitimate_product') {
      flag.status = 'dismissed';
    } else {
      flag.status = 'under_investigation';
    }

    // Add investigation note
    flag.investigation.notes.push({
      adminId: req.admin._id,
      note: `Investigation completed. Verdict: ${verdict}. ${verdictReason || ''}`,
      isInternal: false
    });

    await flag.save();

    return successResponse(res, 'Investigation completed successfully', {
      flag: {
        id: flag._id,
        flagId: flag.flagId,
        status: flag.status,
        verdict: flag.investigation.verdict
      }
    });

  } catch (error) {
    console.error('Complete investigation error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Take action on counterfeit flag
exports.takeAction = async (req, res) => {
  try {
    const { flagId } = req.params;
    const { actionType, description } = req.body;

    const validActions = ['product_removed', 'seller_warned', 'seller_suspended', 'listing_updated', 'no_action'];
    if (!validActions.includes(actionType)) {
      return errorResponse(res, 'Invalid action type', 400);
    }

    const flag = await CounterfeitFlag.findById(flagId);
    if (!flag) {
      return errorResponse(res, 'Flag not found', 404);
    }

    // Add action to flag
    flag.actions.push({
      type: actionType,
      description,
      performedBy: req.admin._id
    });

    // Execute the action
    if (actionType === 'product_removed') {
      await Product.findByIdAndUpdate(flag.productId, { status: 'removed' });
    } else if (actionType === 'seller_suspended') {
      await User.findByIdAndUpdate(flag.sellerId, { deletedAt: new Date() });
    }

    // Update flag status if resolved
    if (['product_removed', 'seller_suspended', 'no_action'].includes(actionType)) {
      flag.status = 'resolved';
      flag.resolvedAt = new Date();
      flag.resolvedBy = req.admin._id;
    }

    await flag.save();

    return successResponse(res, 'Action taken successfully', {
      flag: {
        id: flag._id,
        flagId: flag.flagId,
        status: flag.status,
        actionTaken: actionType
      }
    });

  } catch (error) {
    console.error('Take action error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Dismiss flag
exports.dismissFlag = async (req, res) => {
  try {
    const { flagId } = req.params;
    const { reason } = req.body;

    const flag = await CounterfeitFlag.findById(flagId);
    if (!flag) {
      return errorResponse(res, 'Flag not found', 404);
    }

    flag.status = 'dismissed';
    flag.resolvedAt = new Date();
    flag.resolvedBy = req.admin._id;

    // Add dismissal note
    flag.investigation.notes.push({
      adminId: req.admin._id,
      note: `Flag dismissed. Reason: ${reason || 'No reason provided'}`,
      isInternal: false
    });

    await flag.save();

    return successResponse(res, 'Flag dismissed successfully');

  } catch (error) {
    console.error('Dismiss flag error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Get counterfeit statistics
exports.getCounterfeitStats = async (req, res) => {
  try {
    const [
      totalFlags,
      pendingFlags,
      underInvestigationFlags,
      verifiedFlags,
      dismissedFlags,
      resolvedFlags,
      flagsByType,
      flagsByPriority,
      topReportedProducts
    ] = await Promise.all([
      CounterfeitFlag.countDocuments(),
      CounterfeitFlag.countDocuments({ status: 'pending' }),
      CounterfeitFlag.countDocuments({ status: 'under_investigation' }),
      CounterfeitFlag.countDocuments({ status: 'verified' }),
      CounterfeitFlag.countDocuments({ status: 'dismissed' }),
      CounterfeitFlag.countDocuments({ status: 'resolved' }),
      CounterfeitFlag.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      CounterfeitFlag.aggregate([
        { $group: { _id: '$priority', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      CounterfeitFlag.aggregate([
        { $group: { _id: '$productId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
        { $unwind: '$product' },
        { $project: { title: '$product.title', count: 1 } }
      ])
    ]);

    return successResponse(res, 'Counterfeit statistics retrieved successfully', {
      stats: {
        totalFlags,
        pendingFlags,
        underInvestigationFlags,
        verifiedFlags,
        dismissedFlags,
        resolvedFlags,
        flagsByType,
        flagsByPriority,
        topReportedProducts
      }
    });

  } catch (error) {
    console.error('Get counterfeit stats error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};
