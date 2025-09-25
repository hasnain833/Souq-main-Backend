// controllers/sizeChartController.js
const SizeChart = require('../../../../db/models/sizeChartModel');
const Category = require('../../../../db/models/categoryModel');
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');
const slugify = require('slugify');

// Helper function to find child category and get its slug
const findChildCategoryWithSlug = async (childCategoryId) => {
  const category = await Category.findOne({ 'subCategories.childCategories._id': childCategoryId });
  
  if (!category) {
    return null;
  }
  
  for (const subCat of category.subCategories) {
    const childCat = subCat.childCategories.id(childCategoryId);
    if (childCat) {
      // Ensure slug exists
      if (!childCat.slug && childCat.name) {
        childCat.slug = slugify(childCat.name, { lower: true });
        await category.save();
      }
      
      return {
        _id: childCat._id,
        name: childCat.name,
        slug: childCat.slug
      };
    }
  }
  
  return null;
};

exports.createSizeChart = async (req, res) => {
  try {
    const { childCategoryId, childCategorySlug, sizes } = req.body;

    if (!childCategoryId || !sizes || !Array.isArray(sizes)) {
      return errorResponse(res, 'Child category ID and sizes array are required', 400);
    }

    // Get child category details and ensure slug exists
    const childCategoryInfo = await findChildCategoryWithSlug(childCategoryId);
    
    if (!childCategoryInfo) {
      return errorResponse(res, 'Child category not found', 404);
    }

    const existing = await SizeChart.findOne({ 'childCategory._id': childCategoryId });
    if (existing) {
      return errorResponse(res, 'Size chart already exists for this child category', 400);
    }

    const chart = new SizeChart({
      childCategory: {
        _id: childCategoryId,
        slug: childCategoryInfo.slug
      },
      sizes
    });

    await chart.save();

    const populatedChart = await SizeChart.findById(chart._id)
      .populate('childCategory._id', 'name slug');

    return successResponse(res, 'Size chart created successfully', { sizeChart: populatedChart }, 201);
  } catch (error) {
    console.error('Create size chart error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

exports.getSizesByChildCategory = async (req, res) => {
  try {
    const { childCategoryId, slug } = req.params;

    let chart;
    if (childCategoryId) {
      chart = await SizeChart.findOne({ "childCategory._id": childCategoryId })
        .populate('childCategory._id', 'name slug');
    } else if (slug) {
      chart = await SizeChart.findOne({ "childCategory.slug": slug })
        .populate('childCategory._id', 'name slug');
    }

    if (!chart) {
      return errorResponse(res, 'Size chart not found for the given child category', 404);
    }

    return successResponse(res, 'Size chart fetched successfully', {
      sizeChart: chart,
      sizes: chart.sizes
    });
  } catch (error) {
    console.error('Get sizes by child category error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};



// Get all size charts with pagination
exports.getAllSizeCharts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    // Build search query
    let query = {};
    if (search) {
      query = {
        $or: [
          { 'childCategory.slug': { $regex: search, $options: 'i' } },
          { 'sizes': { $in: [new RegExp(search, 'i')] } }
        ]
      };
    }

    const sizeCharts = await SizeChart.find(query)
      .populate('childCategory._id', 'name slug')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await SizeChart.countDocuments(query);

    return successResponse(res, 'Size charts fetched successfully', {
      sizeCharts,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit
      }
    });
  } catch (error) {
    console.error('Get all size charts error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Get size chart by ID
exports.getSizeChartById = async (req, res) => {
  try {
    const { id } = req.params;

    const sizeChart = await SizeChart.findById(id)
      .populate('childCategory._id', 'name slug');

    if (!sizeChart) {
      return errorResponse(res, 'Size chart not found', 404);
    }

    return successResponse(res, 'Size chart fetched successfully', { sizeChart });
  } catch (error) {
    console.error('Get size chart by ID error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Update size chart
exports.updateSizeChart = async (req, res) => {
  try {
    const { id } = req.params;
    const { childCategoryId, childCategorySlug, sizes } = req.body;

    const sizeChart = await SizeChart.findById(id);
    if (!sizeChart) {
      return errorResponse(res, 'Size chart not found', 404);
    }

    // Check if another size chart exists for the new child category (if changed)
    if (childCategoryId && childCategoryId !== sizeChart.childCategory._id.toString()) {
      const existing = await SizeChart.findOne({
        'childCategory._id': childCategoryId,
        _id: { $ne: id }
      });
      if (existing) {
        return errorResponse(res, 'Size chart already exists for this child category', 400);
      }
    }

    // Update fields
    if (childCategoryId) sizeChart.childCategory._id = childCategoryId;
    if (childCategorySlug) sizeChart.childCategory.slug = childCategorySlug;
    if (sizes) sizeChart.sizes = sizes;

    await sizeChart.save();

    const updatedSizeChart = await SizeChart.findById(id)
      .populate('childCategory._id', 'name slug');

    return successResponse(res, 'Size chart updated successfully', { sizeChart: updatedSizeChart });
  } catch (error) {
    console.error('Update size chart error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Delete size chart
exports.deleteSizeChart = async (req, res) => {
  try {
    const { id } = req.params;

    const sizeChart = await SizeChart.findById(id);
    if (!sizeChart) {
      return errorResponse(res, 'Size chart not found', 404);
    }

    await SizeChart.findByIdAndDelete(id);

    return successResponse(res, 'Size chart deleted successfully');
  } catch (error) {
    console.error('Delete size chart error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Get all child categories for dropdown
exports.getChildCategories = async (req, res) => {
  try {
    const categories = await Category.find({}, 'name slug subCategories');

    let childCategories = [];
    let hasUpdates = false;
    
    for (const category of categories) {
      category.subCategories.forEach(subCategory => {
        subCategory.childCategories.forEach(childCategory => {
          // Ensure child category has slug
          if (!childCategory.slug && childCategory.name) {
            childCategory.slug = slugify(childCategory.name, { lower: true });
            hasUpdates = true;
          }
          
          childCategories.push({
            _id: childCategory._id,
            name: childCategory.name,
            slug: childCategory.slug,
            parentCategory: category.name,
            parentSubCategory: subCategory.name
          });
        });
      });
      
      // Save if any slugs were added
      if (hasUpdates) {
        await category.save();
        hasUpdates = false;
      }
    }

    return successResponse(res, 'Child categories fetched successfully', { childCategories });
  } catch (error) {
    console.error('Get child categories error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

exports.addSize = async (req, res) => {
  try {
    const { childCategoryId, slug } = req.params;
    const { sizes } = req.body;

    if (!sizes || !Array.isArray(sizes)) {
      return errorResponse(res, 'Sizes array is required', 400);
    }

    // Get child category details and ensure slug exists
    const childCategoryInfo = await findChildCategoryWithSlug(childCategoryId);
    
    if (!childCategoryInfo) {
      return errorResponse(res, 'Child category not found', 404);
    }

    // Use the slug from database if not provided in params
    const categorySlug = slug || childCategoryInfo.slug;

    // Check if size chart already exists
    const existing = await SizeChart.findOne({
      'childCategory._id': childCategoryId,
    });

    if (existing) {
      existing.sizes = sizes;
      // Ensure slug is updated if it was missing
      existing.childCategory.slug = categorySlug;
      await existing.save();
      return successResponse(res, 'Size chart updated successfully', { sizeChart: existing });
    }

    const newChart = new SizeChart({
      childCategory: {
        _id: childCategoryId,
        slug: categorySlug,
      },
      sizes
    });

    await newChart.save();
    return successResponse(res, 'Size chart created successfully', { sizeChart: newChart }, 201);
  } catch (error) {
    console.error('Add size error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};
