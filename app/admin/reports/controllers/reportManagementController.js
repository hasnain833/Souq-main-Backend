const UserReport = require('../../../../db/models/userReportModel');
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');

/**
 * Get all user reports with pagination and filters
 */
exports.getAllReports = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      reason = '',
      status = '',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      dateFrom = '',
      dateTo = ''
    } = req.query;

    const skip = (page - 1) * limit;
    const query = {};

    // Search filter (search in description)
    if (search) {
      query.description = { $regex: search, $options: 'i' };
    }

    // Reason filter
    if (reason) {
      query.reason = reason;
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

    // Get reports with populated data
    const reports = await UserReport.find(query)
      .populate('reporter', 'firstName lastName email username profile')
      .populate('reported', 'firstName lastName email username profile')
      .populate('resolvedBy', 'firstName lastName email username')
      .sort(sortConfig)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await UserReport.countDocuments(query);

    // Calculate pagination
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return successResponse(res, 'Reports retrieved successfully', {
      reports,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalReports: total,
        hasNext,
        hasPrev,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get all reports error:', error);
    return errorResponse(res, 'Failed to retrieve reports', 500);
  }
};

/**
 * Get report statistics
 */
exports.getReportStats = async (req, res) => {
  try {
    // Get total reports
    const totalReports = await UserReport.countDocuments();

    // Get reports by status
    const statusStats = await UserReport.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get reports by reason
    const reasonStats = await UserReport.aggregate([
      {
        $group: {
          _id: '$reason',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Get recent reports (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentReports = await UserReport.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    // Get pending reports
    const pendingReports = await UserReport.countDocuments({ status: 'pending' });

    // Get resolved reports
    const resolvedReports = await UserReport.countDocuments({ status: 'resolved' });

    // Get monthly report trends (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyTrends = await UserReport.aggregate([
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
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    // Get most reported users
    const mostReportedUsers = await UserReport.aggregate([
      {
        $group: {
          _id: '$reported',
          reportCount: { $sum: 1 }
        }
      },
      {
        $sort: { reportCount: -1 }
      },
      {
        $limit: 10
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      {
        $unwind: '$userInfo'
      },
      {
        $project: {
          reportCount: 1,
          'userInfo.firstName': 1,
          'userInfo.lastName': 1,
          'userInfo.email': 1,
          'userInfo.username': 1
        }
      }
    ]);

    return successResponse(res, 'Report statistics retrieved successfully', {
      totalReports,
      statusBreakdown: statusStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {}),
      reasonBreakdown: reasonStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {}),
      recentReports,
      pendingReports,
      resolvedReports,
      monthlyTrends,
      mostReportedUsers
    });

  } catch (error) {
    console.error('Get report stats error:', error);
    return errorResponse(res, 'Failed to retrieve report statistics', 500);
  }
};

/**
 * Get report by ID
 */
exports.getReportById = async (req, res) => {
  try {
    const { reportId } = req.params;

    const report = await UserReport.findById(reportId)
      .populate('reporter', 'firstName lastName email username profile')
      .populate('reported', 'firstName lastName email username profile')
      .populate('resolvedBy', 'firstName lastName email username');

    if (!report) {
      return errorResponse(res, 'Report not found', 404);
    }

    return successResponse(res, 'Report retrieved successfully', { report });

  } catch (error) {
    console.error('Get report by ID error:', error);
    return errorResponse(res, 'Failed to retrieve report', 500);
  }
};

/**
 * Update report status
 */

exports.updateReportStatus = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status, adminNotes } = req.body;
    const adminId = req.admin?._id; // Use MongoDB ObjectId

    if (!reportId?.match(/^[0-9a-fA-F]{24}$/)) {
      return errorResponse(res, 'Invalid report ID format', 400);
    }

    const validStatuses = ['pending', 'under_review', 'resolved', 'dismissed'];
    if (!validStatuses.includes(status)) {
      return errorResponse(res, 'Invalid report status', 400);
    }

    const report = await UserReport.findById(reportId);
    if (!report) {
      return errorResponse(res, 'Report not found', 404);
    }

    report.status = status;
    if (adminNotes) report.adminNotes = adminNotes;

    if ((status === 'resolved' || status === 'dismissed') && adminId) {
      report.resolvedAt = new Date();
      report.resolvedBy = adminId; // Must be ObjectId
    }

    await report.save();

    const populatedReport = await UserReport.findById(reportId)
      .populate('reporter', 'firstName lastName email username profile')
      .populate('reported', 'firstName lastName email username profile')
      .populate('resolvedBy', 'firstName lastName email username');

    return successResponse(res, 'Report status updated successfully', { report: populatedReport });

  } catch (error) {
    console.error('Update report status error:', error.message, error.stack);
    return errorResponse(res, 'Failed to update report status', 500, error.message);
  }
};



/**
 * Delete report
 */
exports.deleteReport = async (req, res) => {
  try {
    const { reportId } = req.params;

    const report = await UserReport.findById(reportId);
    if (!report) {
      return errorResponse(res, 'Report not found', 404);
    }

    await UserReport.findByIdAndDelete(reportId);

    return successResponse(res, 'Report deleted successfully');

  } catch (error) {
    console.error('Delete report error:', error);
    return errorResponse(res, 'Failed to delete report', 500);
  }
};
