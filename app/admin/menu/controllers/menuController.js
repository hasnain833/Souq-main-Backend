const Menu = require('../../../../db/models/menuModel');
const Category = require('../../../../db/models/categoryModel');
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');

// Get all menus
exports.getAllMenus = async (req, res) => {
  try {
    const menus = await Menu.find()
      .populate('categories', 'name slug')
      .sort({ order: 1, createdAt: -1 });

    return successResponse(res, 'Menus retrieved successfully', { menus });
  } catch (error) {
    console.error('Get all menus error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Get menu by ID
exports.getMenuById = async (req, res) => {
  try {
    const { menuId } = req.params;
    
    const menu = await Menu.findById(menuId)
      .populate('categories', 'name slug subCategories');

    if (!menu) {
      return errorResponse(res, 'Menu not found', 404);
    }

    return successResponse(res, 'Menu retrieved successfully', { menu });
  } catch (error) {
    console.error('Get menu by ID error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Create new menu
exports.createMenu = async (req, res) => {
  try {
    const { name, categories, subcategories, isActive, order } = req.body;
    console.log('📝 Creating menu with data:', { name, categories, subcategories, isActive, order });

    if (!name) {
      return errorResponse(res, 'Menu name is required', 400);
    }

    // Check if menu with same name exists
    const existingMenu = await Menu.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existingMenu) {
      return errorResponse(res, 'Menu with this name already exists', 400);
    }

    // Convert category names to ObjectIds
    let categoryIds = [];
    if (categories && Array.isArray(categories)) {
      const foundCategories = await Category.find({ name: { $in: categories } });
      categoryIds = foundCategories.map(cat => cat._id);
      console.log('🔍 Found categories:', foundCategories.map(c => ({ name: c.name, id: c._id })));
    }

    // Convert subcategory names to proper format
    let subcategoryData = [];
    if (subcategories && Array.isArray(subcategories)) {
      for (const subName of subcategories) {
        // Find the category that contains this subcategory
        const categoryWithSub = await Category.findOne({
          'subCategories.name': subName
        });

        if (categoryWithSub) {
          const subcategory = categoryWithSub.subCategories.find(sub => sub.name === subName);
          if (subcategory) {
            subcategoryData.push({
              categoryId: categoryWithSub._id,
              subcategoryId: subcategory._id,
              name: subName
            });
          }
        }
      }
      console.log('🔍 Processed subcategories:', subcategoryData);
    }

    const menu = new Menu({
      name,
      categories: categoryIds,
      subcategories: subcategoryData,
      isActive: isActive !== undefined ? isActive : true,
      order: order || 0
    });

    await menu.save();

    const populatedMenu = await Menu.findById(menu._id)
      .populate('categories', 'name slug');

    return successResponse(res, 'Menu created successfully', { menu: populatedMenu }, 201);
  } catch (error) {
    console.error('Create menu error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Update menu
exports.updateMenu = async (req, res) => {
  try {
    const { menuId } = req.params;
    const { name, categories, subcategories, isActive, order } = req.body;
    console.log('📝 Updating menu with data:', { menuId, name, categories, subcategories, isActive, order });

    const menu = await Menu.findById(menuId);
    if (!menu) {
      return errorResponse(res, 'Menu not found', 404);
    }

    // Check if another menu with same name exists
    if (name && name !== menu.name) {
      const existingMenu = await Menu.findOne({
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        _id: { $ne: menuId }
      });
      if (existingMenu) {
        return errorResponse(res, 'Menu with this name already exists', 400);
      }
    }

    // Update fields
    if (name) menu.name = name;

    // Convert category names to ObjectIds if provided
    if (categories !== undefined) {
      if (Array.isArray(categories)) {
        const foundCategories = await Category.find({ name: { $in: categories } });
        menu.categories = foundCategories.map(cat => cat._id);
        console.log('🔍 Updated categories:', foundCategories.map(c => ({ name: c.name, id: c._id })));
      } else {
        menu.categories = categories;
      }
    }

    // Convert subcategory names to proper format if provided
    if (subcategories !== undefined) {
      if (Array.isArray(subcategories) && subcategories.length > 0 && typeof subcategories[0] === 'string') {
        let subcategoryData = [];

        for (const subName of subcategories) {
          // Find the category that contains this subcategory
          const categoryWithSub = await Category.findOne({
            'subCategories.name': subName
          });

          if (categoryWithSub) {
            const subcategory = categoryWithSub.subCategories.find(sub => sub.name === subName);
            if (subcategory) {
              subcategoryData.push({
                categoryId: categoryWithSub._id,
                subcategoryId: subcategory._id,
                name: subName
              });
            }
          }
        }
        menu.subcategories = subcategoryData;
        console.log('🔍 Updated subcategories:', subcategoryData);
      } else {
        menu.subcategories = subcategories;
      }
    }

    if (isActive !== undefined) menu.isActive = isActive;
    if (order !== undefined) menu.order = order;

    await menu.save();

    const populatedMenu = await Menu.findById(menu._id)
      .populate('categories', 'name slug');

    return successResponse(res, 'Menu updated successfully', { menu: populatedMenu });
  } catch (error) {
    console.error('Update menu error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Delete menu
exports.deleteMenu = async (req, res) => {
  try {
    const { menuId } = req.params;

    const menu = await Menu.findById(menuId);
    if (!menu) {
      return errorResponse(res, 'Menu not found', 404);
    }

    await Menu.findByIdAndDelete(menuId);

    return successResponse(res, 'Menu deleted successfully');
  } catch (error) {
    console.error('Delete menu error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

// Get menu statistics
exports.getMenuStats = async (req, res) => {
  try {
    const [totalMenus, activeMenus, inactiveMenus] = await Promise.all([
      Menu.countDocuments(),
      Menu.countDocuments({ isActive: true }),
      Menu.countDocuments({ isActive: false })
    ]);

    return successResponse(res, 'Menu statistics retrieved successfully', {
      stats: {
        totalMenus,
        activeMenus,
        inactiveMenus
      }
    });
  } catch (error) {
    console.error('Get menu stats error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};
