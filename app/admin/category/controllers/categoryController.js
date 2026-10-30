// const slugify = require('slugify');
// const Category = require('../../../../db/models/categoryModel')

// const generateSlug = (name) => slugify(name, {lower:true})

// exports.getAllCategories = async (req, res) => {
//   try {
//     const categories = await Category.find();
//     res.json({ message: 'All categories fetched successfully', categories });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };


// exports.createCategory = async(req,res) => {
//     try {
//         const {name} = req.body;
//         if(!name) return res.status(400).json({message:"Name required"});

//         const slug = generateSlug(name)
//         const exists = await Category.findOne({slug});

//         if(exists) return res.status(400).json({message:"Category alreadz exists"});

//         const category = new Category({name, slug, subcategories: []});

//         await category.save();

//         res.status(201).json({message:"Category Created",category});    
//     } catch (error) {
//         res.status(500).json({message:error.message});
//     }
// }

// // exports.getCategory = async (req, res) => {
// //     try {
// //         const { _id } = req.params;

// //         if (!mongoose.Types.ObjectId.isValid(_id)) {
// //             return res.status(400).json({ message: "Invalid Category ID" });
// //         }

// //         const category = await Category.findById(id);

// //         if (!category) {
// //             return res.status(404).json({ message: "Category not found" });
// //         }

// //         res.json({
// //             message: "Category fetched successfully",
// //             category
// //         });
// //     } catch (error) {
// //         res.status(500).json({ message: error.message });
// //     }
// // };
// exports.getCategory = async (req, res) => {
//   try {
//     const category = await Category.findById(req.params.id);
//     if (!category) return res.status(404).json({ message: 'Category not found' });

//     res.json({ message: 'Category fetched', category });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

// exports.updateCategory = async (req,res) => {
//     try {
//         const {name} = req.body;
//         if(!name) return res.status(400).json({message:"Name Required"});

//         const category = await Category.findById(req.params.id);
//         if(!category) return res.status(400).json({message:"Category Not Found"});

//         category.name = name;
//         category.slug = generateSlug(name);

//         await category.save();
//         res.json({message:"Category Updates",category});
//     } catch (error) {
//         res.status(500).json({message:error.message});
//     }
// }

// exports.deleteCategory = async (req, res) => {
//     try {
//         const deleted = await Category.findByIdAndDelete(req.params.id);
//         if(!deleted) return res.status(404).json({message:"Category not found"});

//         res.json({message:"Category deleted"});
//     } catch (error) {
//         res.status(500).json({message:error.message})
//     }
// }


// exports.CreateSubCategory = async (req, res) => {
//     try {
//         const {categoryId} = req.params;
//         console.log(categoryId);
        
//         const {name} = req.body

//         if(!name) return res.status(400).json({message:"SubCategory name required"});

//         const slug = generateSlug(name);

//         const category = await Category.findById(categoryId);
//         if(!category) return res.status(404).json({message:"Category not found"});

//         if(category.subcategories.some(s => s.slug === slug))
//             return res.status(400).json({messageL:"SuubCategory already exists"});

//         category.subcategories.push({name, slug, subcategories: [] });
//         await category.save();

//         res.status(201).json({ message: 'Subcategory added', category });
//     } catch (error) {
//          res.status(500).json({ message: error.message });
//     }
// }

// exports.updateSubCategory = async (req, res) => {
//     try {
//         const {categoryId,subCategorySlug} = req.params;
//         const {name} = req.body;

//         if(!name) return res.status(400).json({message:"Name Required"});

//         const category = await Category.findById(categoryId);
//         if(!category) return res.status(404).json({message:"Category not found"});

//         const subcategory = category.subcategories.find(s => s.slug === subCategorySlug);
//         if (!subcategory) return res.status(404).json({ message: 'Subcategory not found' });


//         subcategory.name = name;
//         subcategory.slug = generateSlug(name);

//         await category.save();
//         res.status(201).json({ message: 'Subcategory updated', category })

//     } catch (err) {
//         res.status(500).json({ message: err.message });
//     }
// }

// exports.deleteSubCategory = async (req, res) => {
//   try {
//     const { categoryId, subCategorySlug } = req.params;

//     const category = await Category.findById(categoryId);
//     if (!category) return res.status(404).json({ message: 'Category not found' });

//     const index = category.subcategories.findIndex(s => s.slug === subCategorySlug);
//     if (index === -1) return res.status(404).json({ message: 'Subcategory not found' });

//     category.subcategories.splice(index, 1);
//     await category.save();

//     res.json({ message: 'Subcategory deleted', category });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

// exports.addChildSubCategory = async (req, res) => {
//   try {
//     const { categoryId, subCategorySlug } = req.params;
//     const { name } = req.body;
//     if (!name) return res.status(400).json({ message: 'Child subcategory name required' });

//     const slug = generateSlug(name);

//     const category = await Category.findById(categoryId);
//     if (!category) return res.status(404).json({ message: 'Category not found' });

//     const subcategory = category.subcategories.find(s => s.slug === subCategorySlug);
//     if (!subcategory) return res.status(404).json({ message: 'Subcategory not found' });

//     // Prevent duplicate child subcategory slug
//     if (subcategory.subcategories.some(c => c.slug === slug))
//       return res.status(400).json({ message: 'Child subcategory already exists' });

//     subcategory.subcategories.push({ name, slug });
//     await category.save();

//     res.status(201).json({ message: 'Child subcategory added', category });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

// exports.updateChildSubCategory = async (req, res) => {
//   try {
//     const { categoryId, subCategorySlug, childSlug } = req.params;
//     const { name } = req.body;
//     if (!name) return res.status(400).json({ message: 'Name required' });

//     const category = await Category.findById(categoryId);
//     if (!category) return res.status(404).json({ message: 'Category not found' });

//     const subcategory = category.subcategories.find(s => s.slug === subCategorySlug);
//     if (!subcategory) return res.status(404).json({ message: 'Subcategory not found' });

//     const childSubcategory = subcategory.subcategories.find(c => c.slug === childSlug);
//     if (!childSubcategory) return res.status(404).json({ message: 'Child subcategory not found' });

//     childSubcategory.name = name;
//     childSubcategory.slug = generateSlug(name);

//     await category.save();
//     res.json({ message: 'Child subcategory updated', category });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

// exports.deleteChildSubCategory = async (req, res) => {
//   try {
//     const { categoryId, subCategorySlug, childSlug } = req.params;

//     const category = await Category.findById(categoryId);
//     if (!category) return res.status(404).json({ message: 'Category not found' });

//     const subcategory = category.subcategories.find(s => s.slug === subCategorySlug);
//     if (!subcategory) return res.status(404).json({ message: 'Subcategory not found' });

//     const index = subcategory.subcategories.findIndex(c => c.slug === childSlug);
//     if (index === -1) return res.status(404).json({ message: 'Child subcategory not found' });

//     subcategory.subcategories.splice(index, 1);
//     await category.save();

//     res.json({ message: 'Child subcategory deleted', category });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };


// exports.searchCategories = async (req, res) => {
//   try {
//     const { keyword } = req.query;

//     if (!keyword) {
//       return res.status(400).json({ message: 'Keyword is required' });
//     }

//     const regex = new RegExp(keyword, 'i'); // case-insensitive

//     const categories = await Category.find({
//       $or: [
//         { name: regex },
//         { 'subcategories.name': regex },
//         { 'subcategories.subcategories.name': regex },
//         // {'subcategories.childSubCategorySchema.name':regex},
//       ]
//     });

//     res.json({ message: 'Search results', data: categories });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };




// ----------------------------------------------

const Category = require('../../../../db/models/categoryModel');
const slugify = require('slugify');

// Helper function to ensure slugs exist
const ensureSlugsExist = (category) => {
  // Ensure main category has slug
  if (!category.slug && category.name) {
    category.slug = slugify(category.name, { lower: true });
  }
  
  // Ensure subcategories have slugs
  if (category.subCategories && Array.isArray(category.subCategories)) {
    category.subCategories.forEach(subCat => {
      if (!subCat.slug && subCat.name) {
        subCat.slug = slugify(subCat.name, { lower: true });
      }
      
      // Ensure child categories have slugs
      if (subCat.childCategories && Array.isArray(subCat.childCategories)) {
        subCat.childCategories.forEach(childCat => {
          if (!childCat.slug && childCat.name) {
            childCat.slug = slugify(childCat.name, { lower: true });
          }
          
          // Ensure items have slugs
          if (childCat.items && Array.isArray(childCat.items)) {
            childCat.items.forEach(item => {
              if (!item.slug && item.name) {
                item.slug = slugify(item.name, { lower: true });
              }
            });
          }
        });
      }
    });
  }
  
  return category;
};

// Create Main Category
exports.createMainCategory = async (req, res) => {
  try {
    // Handle both 'name' and 'category' field names from frontend
    const { name, category: categoryName, subcategories, isSubCategories } = req.body;
    const categoryTitle = name || categoryName;

    console.log('Create category request body:', req.body);

    if (!categoryTitle) {
      return res.status(400).json({ message: 'Category name is required' });
    }

    const slug = slugify(categoryTitle, { lower: true });

    const exists = await Category.findOne({ slug });
    if (exists) return res.status(400).json({ message: 'Main category already exists' });

    // Prepare subcategories with proper slug generation
    let subCategoriesArray = [];
    if (subcategories && Array.isArray(subcategories)) {
      subCategoriesArray = subcategories.map(sub => {
        if (typeof sub === 'string') {
          return {
            name: sub,
            slug: slugify(sub, { lower: true }),
            childCategories: []
          };
        } else if (sub && typeof sub === 'object') {
          // Ensure existing objects have slugs
          const processedSub = {
            name: sub.name,
            slug: sub.slug || slugify(sub.name, { lower: true }),
            childCategories: []
          };
          
          // Process child categories if they exist
          if (sub.childCategories && Array.isArray(sub.childCategories)) {
            processedSub.childCategories = sub.childCategories.map(child => ({
              name: child.name,
              slug: child.slug || slugify(child.name, { lower: true }),
              items: child.items || []
            }));
          }
          
          return processedSub;
        }
        return sub;
      });
    }

    const category = await Category.create({
      name: categoryTitle,
      slug,
      subCategories: subCategoriesArray
    });

    res.status(201).json({ message: 'Main category created', category });
  } catch (err) {
    console.error('Create category error:', err);
    res.status(500).json({ message: err.message });
  }
};

// Get All Categories
exports.getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find();
    
    // Ensure all categories have proper slugs
    const updatedCategories = [];
    for (const category of categories) {
      const updatedCategory = ensureSlugsExist(category);
      
      // Save if any slugs were missing
      if (JSON.stringify(category) !== JSON.stringify(updatedCategory)) {
        await updatedCategory.save();
      }
      
      updatedCategories.push(updatedCategory);
    }
    
    res.json({ message: 'Categories fetched', categories: updatedCategories });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get One Main Category
exports.getCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found' });
    
    // Ensure category has proper slugs
    const updatedCategory = ensureSlugsExist(category);
    
    // Save if any slugs were missing
    if (JSON.stringify(category) !== JSON.stringify(updatedCategory)) {
      await updatedCategory.save();
    }
    
    res.json({ message: 'Category fetched', category: updatedCategory });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update Main Category
exports.updateMainCategory = async (req, res) => {
  try {
    // Handle both 'name' and 'category' field names from frontend
    const { name, category: categoryName, subcategories, isSubCategories } = req.body;
    const categoryTitle = name || categoryName;

    console.log('Update category request body:', req.body);

    if (!categoryTitle) {
      return res.status(400).json({ message: 'Category name is required' });
    }

    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found' });

    // Update basic fields
    category.name = categoryTitle;
    category.slug = slugify(categoryTitle, { lower: true });

    // Handle subcategories if provided
    if (subcategories !== undefined) {
      // Convert string subcategories to proper subcategory objects if needed
      if (Array.isArray(subcategories)) {
        category.subCategories = subcategories.map(sub => {
          if (typeof sub === 'string') {
            return {
              name: sub,
              slug: slugify(sub, { lower: true }),
              childCategories: []
            };
          } else if (sub && typeof sub === 'object') {
            // Ensure existing objects have slugs
            const processedSub = {
              _id: sub._id,
              name: sub.name,
              slug: sub.slug || slugify(sub.name, { lower: true }),
              childCategories: []
            };
            
            // Process child categories if they exist
            if (sub.childCategories && Array.isArray(sub.childCategories)) {
              processedSub.childCategories = sub.childCategories.map(child => ({
                _id: child._id,
                name: child.name,
                slug: child.slug || slugify(child.name, { lower: true }),
                items: child.items || []
              }));
            }
            
            return processedSub;
          }
          return sub;
        });
      }
    }

    await category.save();

    res.json({ message: 'Main category updated', category });
  } catch (err) {
    console.error('Update category error:', err);
    res.status(500).json({ message: err.message });
  }
};

// Delete Main Category
exports.deleteMainCategory = async (req, res) => {
  try {
    const deleted = await Category.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Category not found' });
    res.json({ message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


exports.addSubCategory = async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'Sub-category name is required' });
    }
    
    const category = await Category.findById(req.params.categoryId);
    if (!category) return res.status(404).json({ message: 'Main category not found' });

    const slug = slugify(name, { lower: true });
    
    // Check if subcategory with same slug already exists
    const existingSubCat = category.subCategories.find(sub => sub.slug === slug);
    if (existingSubCat) {
      return res.status(400).json({ message: 'Sub-category with this name already exists' });
    }
    
    category.subCategories.push({ name, slug, childCategories: [] });
    await category.save();

    res.status(201).json({ message: 'Sub-category added', category });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔹 Update Sub-category
exports.updateSubCategory = async (req, res) => {
  try {
    const { subCategoryId } = req.params;
    const { name } = req.body;

    const category = await Category.findOne({ 'subCategories._id': subCategoryId });
    if (!category) return res.status(404).json({ message: 'Sub-category not found' });

    const subCat = category.subCategories.id(subCategoryId);
    subCat.name = name;
    subCat.slug = slugify(name, { lower: true });
    await category.save();

    res.json({ message: 'Sub-category updated', category });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔹 Delete Sub-category
exports.deleteSubCategory = async (req, res) => {
  try {
    const { subCategoryId } = req.params;
    const category = await Category.findOne({ 'subCategories._id': subCategoryId });
    if (!category) return res.status(404).json({ message: 'Sub-category not found' });

    category.subCategories.id(subCategoryId).remove();
    await category.save();

    res.json({ message: 'Sub-category deleted', category });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔹 Add Child-category
exports.addChildCategory = async (req, res) => {
  try {
    const { name } = req.body;
    const { subCategoryId } = req.params;

    if (!name) {
      return res.status(400).json({ message: 'Child-category name is required' });
    }

    const category = await Category.findOne({ 'subCategories._id': subCategoryId });
    if (!category) return res.status(404).json({ message: 'Sub-category not found' });

    const subCat = category.subCategories.id(subCategoryId);
    const slug = slugify(name, { lower: true });
    
    // Check if child category with same slug already exists
    const existingChildCat = subCat.childCategories.find(child => child.slug === slug);
    if (existingChildCat) {
      return res.status(400).json({ message: 'Child-category with this name already exists' });
    }
    
    subCat.childCategories.push({ name, slug, items: [] });
    await category.save();

    res.status(201).json({ message: 'Child-category added', category });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔹 Update Child-category
exports.updateChildCategory = async (req, res) => {
  try {
    const { childCategoryId } = req.params;
    const { name } = req.body;

    const category = await Category.findOne({ 'subCategories.childCategories._id': childCategoryId });
    if (!category) return res.status(404).json({ message: 'Child-category not found' });

    for (const subCat of category.subCategories) {
      const childCat = subCat.childCategories.id(childCategoryId);
      if (childCat) {
        childCat.name = name;
        childCat.slug = slugify(name, { lower: true });
        await category.save();
        return res.json({ message: 'Child-category updated', category });
      }
    }

    res.status(404).json({ message: 'Child-category not found' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔹 Delete Child-category
exports.deleteChildCategory = async (req, res) => {
  try {
    const { childCategoryId } = req.params;

    const category = await Category.findOne({ 'subCategories.childCategories._id': childCategoryId });
    if (!category) return res.status(404).json({ message: 'Child-category not found' });

    for (const subCat of category.subCategories) {
      const index = subCat.childCategories.findIndex(cc => cc._id.toString() === childCategoryId);
      if (index !== -1) {
        subCat.childCategories.splice(index, 1);
        await category.save();
        return res.json({ message: 'Child-category deleted', category });
      }
    }

    res.status(404).json({ message: 'Child-category not found' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔹 Add Item
exports.addItem = async (req, res) => {
  try {
    const { name } = req.body;
    const { childCategoryId } = req.params;

    if (!name) {
      return res.status(400).json({ message: 'Item name is required' });
    }

    const category = await Category.findOne({ 'subCategories.childCategories._id': childCategoryId });
    if (!category) return res.status(404).json({ message: 'Child-category not found' });

    const slug = slugify(name, { lower: true });

    for (const subCat of category.subCategories) {
      const childCat = subCat.childCategories.id(childCategoryId);
      if (childCat) {
        // Check if item with same slug already exists
        const existingItem = childCat.items.find(item => item.slug === slug);
        if (existingItem) {
          return res.status(400).json({ message: 'Item with this name already exists' });
        }
        
        childCat.items.push({ name, slug });
        await category.save();
        return res.status(201).json({ message: 'Item added', category });
      }
    }

    res.status(404).json({ message: 'Child-category not found' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { name } = req.body;

    const category = await Category.findOne({
      'subCategories.childCategories.items._id': itemId,
    });
    if (!category) return res.status(404).json({ message: 'Item not found' });

    for (const subCat of category.subCategories) {
      for (const childCat of subCat.childCategories) {
        const item = childCat.items.id(itemId);
        if (item) {
          item.name = name;
          item.slug = slugify(name, { lower: true });
          await category.save();
          return res.json({ message: 'Item updated', category });
        }
      }
    }

    res.status(404).json({ message: 'Item not found in document structure' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔹 Delete Item
exports.deleteItem = async (req, res) => {
  try {
    const { itemId } = req.params;

    const category = await Category.findOne({ 'subCategories.childCategories.items._id': itemId });
    if (!category) return res.status(404).json({ message: 'Item not found' });

    for (const subCat of category.subCategories) {
      for (const childCat of subCat.childCategories) {
        const index = childCat.items.findIndex(i => i._id.toString() === itemId);
        if (index !== -1) {
          childCat.items.splice(index, 1);
          await category.save();
          return res.json({ message: 'Item deleted', category });
        }
      }
    }

    res.status(404).json({ message: 'Item not found' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Fix missing slugs in existing categories
exports.fixMissingSlugs = async (req, res) => {
  try {
    const categories = await Category.find();
    let fixedCount = 0;
    
    for (const category of categories) {
      let hasChanges = false;
      
      // Fix main category slug
      if (!category.slug && category.name) {
        category.slug = slugify(category.name, { lower: true });
        hasChanges = true;
      }
      
      // Fix subcategory slugs
      if (category.subCategories && Array.isArray(category.subCategories)) {
        category.subCategories.forEach(subCat => {
          if (!subCat.slug && subCat.name) {
            subCat.slug = slugify(subCat.name, { lower: true });
            hasChanges = true;
          }
          
          // Fix child category slugs
          if (subCat.childCategories && Array.isArray(subCat.childCategories)) {
            subCat.childCategories.forEach(childCat => {
              if (!childCat.slug && childCat.name) {
                childCat.slug = slugify(childCat.name, { lower: true });
                hasChanges = true;
              }
              
              // Fix item slugs
              if (childCat.items && Array.isArray(childCat.items)) {
                childCat.items.forEach(item => {
                  if (!item.slug && item.name) {
                    item.slug = slugify(item.name, { lower: true });
                    hasChanges = true;
                  }
                });
              }
            });
          }
        });
      }
      
      if (hasChanges) {
        await category.save();
        fixedCount++;
      }
    }
    
    res.json({ 
      message: `Fixed slugs for ${fixedCount} categories`, 
      fixedCount,
      totalCategories: categories.length 
    });
  } catch (err) {
    console.error('Fix slugs error:', err);
    res.status(500).json({ message: err.message });
  }
};