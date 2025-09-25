const mongoose = require('mongoose');

const blockedUserSchema = new mongoose.Schema({
  blocker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  blocked: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reason: {
    type: String,
    enum: ['spam', 'harassment', 'inappropriate_content', 'fake_profile', 'other'],
    default: 'other'
  },
  notes: {
    type: String,
    maxlength: 500
  }
}, { 
  timestamps: true 
});

// Compound index to ensure a user can't block the same user twice
blockedUserSchema.index({ blocker: 1, blocked: 1 }, { unique: true });

// Instance methods
blockedUserSchema.methods.toJSON = function() {
  const blockedUser = this.toObject();
  return {
    id: blockedUser._id,
    blocker: blockedUser.blocker,
    blocked: blockedUser.blocked,
    reason: blockedUser.reason,
    notes: blockedUser.notes,
    createdAt: blockedUser.createdAt,
    updatedAt: blockedUser.updatedAt
  };
};

// Static methods
blockedUserSchema.statics.isBlocked = async function(blockerId, blockedId) {
  const blocked = await this.findOne({
    blocker: blockerId,
    blocked: blockedId
  });
  return !!blocked;
};

blockedUserSchema.statics.getBlockedUsers = async function(userId, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  
  const blockedUsers = await this.find({ blocker: userId })
    .populate('blocked', 'userName firstName lastName profile')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
    
  const total = await this.countDocuments({ blocker: userId });
  
  return {
    blockedUsers,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1
    }
  };
};

blockedUserSchema.statics.blockUser = async function(blockerId, blockedId, reason = 'other', notes = '') {
  // Check if already blocked
  const existing = await this.findOne({
    blocker: blockerId,
    blocked: blockedId
  });
  
  if (existing) {
    throw new Error('User is already blocked');
  }
  
  // Create block record
  const blocked = await this.create({
    blocker: blockerId,
    blocked: blockedId,
    reason,
    notes
  });
  
  return blocked;
};

blockedUserSchema.statics.unblockUser = async function(blockerId, blockedId) {
  const result = await this.findOneAndDelete({
    blocker: blockerId,
    blocked: blockedId
  });
  
  if (!result) {
    throw new Error('User is not blocked');
  }
  
  return result;
};

module.exports = mongoose.model('BlockedUser', blockedUserSchema);
