const Category = require('../../../../db/models/categoryModel')
const {successResponse , errorResponse} = require('../../../../utils/responseHandler')
const SizeChart = require('../../../../db/models/sizeChartModel')
const cache = require('../../../../utils/cache')
// Get All Category
exports.getAllCategories = async (req, res) => {
  try {
    const cacheKey = 'general:categories:v1';
    let categories = cache.get(cacheKey);
    if (!categories) {
      categories = await Category.find({}, {
        name: 1,
        subCategories: 1,
        createdAt: 1
      })
        .lean()
        .maxTimeMS(8000);
      cache.set(cacheKey, categories, 90_000); // 90s TTL
    }
    return successResponse(res, 'Categories fetched', categories);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch category', 500, error.message);
  }
};

// Get One Main Category
exports.getCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id)
      .select('name subCategories childCategories items createdAt')
      .lean()
      .maxTimeMS(8000);
    if (!category) return res.status(404).json({ message: 'Category not found' });
    return successResponse(res, 'Categories fetched', category);
    
  } catch (error) {
    return errorResponse(res, 'Failed to fetch category', 500, error.message);    
  }
};

exports.getSizesByChildCategory = async (req, res) => {
  try {
    const { childCategoryId, slug } = req.params;

    let chart;
    if (childCategoryId) {
      chart = await SizeChart.findOne({ "childCategory._id": childCategoryId }).lean().maxTimeMS(8000);
    } else if (slug) {
      chart = await SizeChart.findOne({ "childCategory.slug": slug }).lean().maxTimeMS(8000);
    }

    if (!chart) {
      return res.status(404).json({ message: 'Size chart not found for the given child category' });
    }

    return res.status(200).json({
      message: 'Size chart fetched successfully',
      sizes: chart.sizes
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

