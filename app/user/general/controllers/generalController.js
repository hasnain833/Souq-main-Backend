const Category = require('../../../../db/models/categoryModel')
const {successResponse , errorResponse} = require('../../../../utils/responseHandler')
const SizeChart = require('../../../../db/models/sizeChartModel')
// Get All Category
exports.getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find();
    return successResponse(res, 'Categories fetched', categories);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch category', 500, error.message);
  }
};

// Get One Main Category
exports.getCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
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
      chart = await SizeChart.findOne({ "childCategory._id": childCategoryId });
    } else if (slug) {
      chart = await SizeChart.findOne({ "childCategory.slug": slug });
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

