const { UserRes } = require("../../profile/dto/user.dto");
const Category = require('../../../../db/models/categoryModel');
exports.buildProductReq = (userId, body, files) => {
  // ✅ Cloudinary URLs directly from multer response
  const uploadedPhotos = files?.map(file => file.path) || [];

  // Handle existing image URLs (e.g. during update)
  let existingUrls = [];
  if (body.product_photos) {
    existingUrls = Array.isArray(body.product_photos)
      ? body.product_photos
      : [body.product_photos];
  }

  return {
    user: userId,
    product_photos: [...existingUrls, ...uploadedPhotos], // ✅ Cloudinary URLs saved
    title: body.title,
    description: body.description,
    category: body.category,
    brand: body.brand,
    size: body.size,
    colors: body.colors,
    material: body.material,
    condition: body.condition,
    price: body.price,
    shipping_cost: body.shipping_cost,
    package_size: body.package_size,
  };
};


exports.buildProductRes = (product) => {
  return {
    id: product._id,
    user: product.user,
    user: UserRes(product.user),
    user: product.user ? UserRes(product.user) : null,
    title: product.title,
    description: product.description,
    brand: product.brand,
    category: product.category,
    size: product.size,
    colors: product.colors,
    material: product.material,
    condition: product.condition,
    price: product.price,
    shipping_cost: product.shipping_cost,
    package_size: product.package_size,
    product_photos: product.product_photos,
    status: product.status,
    hide: product.hide,
    views: product.views || 0,
    favoriteCount: product.favoritedBy.length,
    createdAt: product.createdAt,
  };
};

exports.getAllProductRes = (product) => {
  return {
    id: product._id,
    user: product.user ? UserRes(product.user) : null,
    title: product.title,
    description: product.description,
    brand: product.brand,
    size: product.size,
    colors: product.colors,
    material: product.material,
    category: product.category,
    condition: product.condition,
    price: product.price,
    shipping_cost: product.shipping_cost,
    package_size: product.package_size,
    stauts: product.stauts,
    product_photos: product.product_photos,
    status: product.status,
    favoriteCount: product.favoritedBy ? product.favoritedBy.length : 0,
    views: product.views || 0,
    createdAt: product.createdAt,
  };
};


exports.updateProductRes = (product) => {
  return {
    id: product._id,
    user: product.user,
    user: {
      id: product.user._id,
      name: product.user.name,
      email: product.user.email
    },
    title: product.title,
    description: product.description,
    brand: product.brand,
    size: product.size,
    colors: product.colors,
    material: product.material,
    category: product.category,
    condition: product.condition,
    price: product.price,
    shipping_cost: product.shipping_cost,
    package_size: product.package_size,
    status: product.status,
    product_photos: product.product_photos,
    updatedAt: product.updatedAt,
  };
};

exports.productRes = (product) => {
  return {
    id: product._id,
    title: product.title,
    description: product.description,
    brand: product.brand,
    size: product.size,
    colors: product.colors,
    material: product.material,
    category: product.category,
    condition: product.condition,
    price: product.price,
    shipping_cost: product.shipping_cost,
    package_size: product.package_size,
    stauts: product.stauts,
    product_photos: product.product_photos,
    status: product.status,
    hide: product.hide,
    favoriteCount: product.favoritedBy ? product.favoritedBy.length : 0,
    views: product.views || 0,
    createdAt: product.createdAt,
  };
}

exports.buildSearchQuery = (q) => {
  if (!q || q.trim() === '') return {};

  const keywords = q.trim().split(/\s+/); // split into words

  const regexQueries = keywords.map((word) => {
    const regex = new RegExp(word, 'i'); // case-insensitive
    return {
      $or: [
        { title: { $regex: regex } },
        { description: { $regex: regex } },
        { brand: { $regex: regex } }
      ]
    };
  });

  return { $and: regexQueries };
};


const getAllNestedItemIds = async (inputId) => {
  const categoryDocs = await Category.find();

  const matchedItemIds = [];

  for (const category of categoryDocs) {
    // Match at category level
    if (category._id.toString() === inputId) {
      for (const sub of category.subCategories || []) {
        for (const child of sub.childCategories || []) {
          for (const item of child.items || []) {
            matchedItemIds.push(item._id);
          }
        }
      }
      return matchedItemIds;
    }

    // Match at subcategory level
    for (const sub of category.subCategories || []) {
      if (sub.id === inputId) {
        for (const child of sub.childCategories || []) {
          for (const item of child.items || []) {
            matchedItemIds.push(item._id);
          }
        }
        return matchedItemIds;
      }

      // Match at childCategory level
      for (const child of sub.childCategories || []) {
        if (child.id === inputId) {
          for (const item of child.items || []) {
            matchedItemIds.push(item._id);
          }
          return matchedItemIds;
        }

        // Match at item level
        for (const item of child.items || []) {
          if (item.id === inputId || item._id.toString() === inputId) {
            matchedItemIds.push(item._id);
            return matchedItemIds;
          }
        }
      }
    }
  }

  return [];
};


exports.buildProductQuery = async (queryParams = {}) => {
  const {
    q,
    search,
    category,
    brand,
    size,
    color,
    condition,
    material,
    package_size,
    minPrice,
    maxPrice
  } = queryParams;

  const query = {
     status: 'active',
    hide: false
  };

  const keyword = search || q;
  if (keyword) {
    const keywords = keyword.trim().split(/\s+/);
    const regexQueries = keywords.map(word => {
      const regex = new RegExp(word, 'i');
      return {
        $or: [
          { title: { $regex: regex } },
          { description: { $regex: regex } },
          { brand: { $regex: regex } }
        ]
      };
    });
    query.$and = regexQueries;
  }

  // ✅ Category filtering with nested support
  if (category) {
    const normalizedCategory = typeof category === 'object' ? category?.id || category?._id : category;
    const itemIds = await getAllNestedItemIds(normalizedCategory);
    if (itemIds.length > 0) {
      query.category = { $in: itemIds };
    } else {
      query.category = normalizedCategory; // fallback if direct item ID
    }
  }

  if (brand) query.brand = brand;
  if (size) query.size = size;
  if (color) query.colors = color;
  if (condition) query.condition = condition;
  if (material) query.material = material;
  if (package_size) query.package_size = package_size;

  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = parseFloat(minPrice);
    if (maxPrice) query.price.$lte = parseFloat(maxPrice);
  }

  return query;
};

exports.buildGetUserProductQuery = async (queryParams = {}) => {
  const {
    q,
    search,
    category,
    brand,
    size,
    color,
    condition,
    material,
    package_size,
    minPrice,
    maxPrice
  } = queryParams;

  const query = {
    status: { $in: ['active', 'sold'] },
    hide: false
  };

  const keyword = search || q;
  if (keyword) {
    const keywords = keyword.trim().split(/\s+/);
    const regexQueries = keywords.map(word => {
      const regex = new RegExp(word, 'i');
      return {
        $or: [
          { title: { $regex: regex } },
          { description: { $regex: regex } },
          { brand: { $regex: regex } }
        ]
      };
    });
    query.$and = regexQueries;
  }

  // ✅ Category filtering with nested support
  if (category) {
    const normalizedCategory = typeof category === 'object' ? category?.id || category?._id : category;
    const itemIds = await getAllNestedItemIds(normalizedCategory);
    if (itemIds.length > 0) {
      query.category = { $in: itemIds };
    } else {
      query.category = normalizedCategory; // fallback if direct item ID
    }
  }

  if (brand) query.brand = brand;
  if (size) query.size = size;
  if (color) query.colors = color;
  if (condition) query.condition = condition;
  if (material) query.material = material;
  if (package_size) query.package_size = package_size;

  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = parseFloat(minPrice);
    if (maxPrice) query.price.$lte = parseFloat(maxPrice);
  }

  return query;
};

