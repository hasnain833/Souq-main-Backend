// const mongoose = require('mongoose');

// const itemSchema = new mongoose.Schema({
//   name: String,
//   slug: String,
// });

// const childSubCategorySchema = new mongoose.Schema({
//   name: String,
//   slug: String,
//   items: [itemSchema]
// });

// const subCategorySchema = new mongoose.Schema({
//   name: { type: String, required: true },
//   slug: { type: String, required: true },
//   subcategories: [childSubCategorySchema]
// });

// const categorySchema = new mongoose.Schema({
//   name: { type: String, required: true },
//   slug: { type: String, required: true, unique: true },
//   subcategories: [subCategorySchema]
// }, { timestamps: true });

// module.exports = mongoose.model('Category', categorySchema);

const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  name: String,
  slug: String
});

const childCategorySchema = new mongoose.Schema({
  name: String,
  slug: String,
  items: [itemSchema]
});

const subCategorySchema = new mongoose.Schema({
  name: String,
  slug: String,
  childCategories: [childCategorySchema]
});

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  subCategories: [subCategorySchema]
}, { timestamps: true });

// Useful indexes for category lookups
categorySchema.index({ name: 1 });
categorySchema.index({ slug: 1 });
// Optional: if you frequently query child slugs
// categorySchema.index({ 'subCategories.childCategories.slug': 1 });

module.exports = mongoose.model('Category', categorySchema);
