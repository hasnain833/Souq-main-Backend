const mongoose = require('mongoose');
const {CONDITIONS, PACKAGE_SIZE, PRODUCT_STATUS} = require('../../constants/enum')

const productSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  product_photos: [
    {
      type: String, // URLs or paths
      required: true,
    }
  ],
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: String,
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: false,
  },
  brand: String,
  size: String,
  condition: {
    type: String,
    enum: CONDITIONS
  },
  colors: String,
  material: String,
  price: {
    type: Number,
    required: false,
  },
  shipping_cost:{
    type: Number
  },
  package_size: {
    type: String,
    enum: PACKAGE_SIZE,
    default: 'medium',
  },
  hide:{
    type: Boolean,
    default:false
  },
  status: {
    type: String,
    enum: PRODUCT_STATUS,
    default: 'active'
  },
  favoritedBy: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }
  ],
  views: {
    type: Number,
    default: 0,
  },
  viewedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Bump/Promotion functionality
  bumpedAt: {
    type: Date,
    default: null
  },
  bumpCount: {
    type: Number,
    default: 0
  },

  // Status tracking
  statusHistory: [{
    status: {
      type: String,
      enum: ['active','sold','reserved','cancelled','rejected','draft']
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    note: String
  }],
}, {
  timestamps: true
});

productSchema.statics.createProduct = async function (userId, data) {
  const product = new this({
    ...data,
    user: userId,
  });
  const product_photos = req.files.map(file => file.filename);
  return await product.save();
};

productSchema.virtual('favoriteCount').get(function () {
  return this.favoritedBy?.length || 0;
});

// Instance methods
productSchema.methods.bumpProduct = function(userId) {
  this.bumpedAt = new Date();
  this.bumpCount += 1;
  this.statusHistory.push({
    status: this.status,
    changedAt: new Date(),
    changedBy: userId,
    note: 'Product bumped'
  });
  return this.save();
};

productSchema.methods.updateStatus = function(newStatus, userId, note = '') {
  const oldStatus = this.status;
  this.status = newStatus;
  this.statusHistory.push({
    status: newStatus,
    changedAt: new Date(),
    changedBy: userId,
    note: note || `Status changed from ${oldStatus} to ${newStatus}`
  });
  return this.save();
};

productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Product', productSchema);



