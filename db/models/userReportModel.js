const mongoose = require('mongoose');

const userReportSchema = new mongoose.Schema({
  reporter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reported: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reason: {
    type: String,
    enum: [
      'spam',
      'harassment',
      'inappropriate_content',
      'fake_profile',
      'scam_fraud',
      'hate_speech',
      'violence_threats',
      'copyright_violation',
      'other'
    ],
    required: true
  },
  description: {
    type: String,
    required: true,
    maxlength: 1000
  },
  evidence: [{
    type: {
      type: String,
      enum: ['screenshot', 'message', 'link', 'other'],
      required: true
    },
    content: {
      type: String,
      required: true
    },
    description: String
  }],
  status: {
    type: String,
    enum: ['pending', 'under_review', 'resolved', 'dismissed'],
    default: 'pending'
  },
  adminNotes: {
    type: String,
    maxlength: 1000
  },
  resolvedAt: Date,
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { 
  timestamps: true 
});

// Indexes
userReportSchema.index({ reporter: 1, reported: 1 });
userReportSchema.index({ status: 1 });
userReportSchema.index({ createdAt: -1 });

// Instance methods
userReportSchema.methods.toJSON = function() {
  const report = this.toObject();
  return {
    id: report._id,
    reporter: report.reporter,
    reported: report.reported,
    reason: report.reason,
    description: report.description,
    evidence: report.evidence,
    status: report.status,
    adminNotes: report.adminNotes,
    resolvedAt: report.resolvedAt,
    resolvedBy: report.resolvedBy,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt
  };
};

// Static methods
userReportSchema.statics.createReport = async function(reportData) {
  const { reporter, reported, reason, description, evidence = [] } = reportData;
  
  // Validate that user is not reporting themselves
  if (reporter.toString() === reported.toString()) {
    throw new Error('You cannot report yourself');
  }
  
  // Create the report
  const report = await this.create({
    reporter,
    reported,
    reason,
    description,
    evidence
  });
  
  return report;
};

userReportSchema.statics.getUserReports = async function(userId, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  
  const reports = await this.find({ reporter: userId })
    .populate('reported', 'userName firstName lastName profile')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
    
  const total = await this.countDocuments({ reporter: userId });
  
  return {
    reports,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1
    }
  };
};

userReportSchema.statics.getReportsAgainstUser = async function(userId, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  
  const reports = await this.find({ reported: userId })
    .populate('reporter', 'userName firstName lastName profile')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
    
  const total = await this.countDocuments({ reported: userId });
  
  return {
    reports,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1
    }
  };
};

module.exports = mongoose.model('UserReport', userReportSchema);
