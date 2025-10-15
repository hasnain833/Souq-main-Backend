const { UserRes } = require("../../profile/dto/user.dto");
const Category = require('../../../../db/models/categoryModel');
exports.buildProductReq = (userId, body, files) => {
  // Convert uploaded files (memory storage) into buffers for MongoDB
  const uploadedImages = Array.isArray(files)
    ? files.map((file) => ({ data: file.buffer, contentType: file.mimetype }))
    : [];

  // Keep legacy external or local paths if provided in body for backward compatibility
  let existingUrls = [];
  if (body.product_photos) {
    existingUrls = Array.isArray(body.product_photos)
      ? body.product_photos
      : [body.product_photos];
  }

  return {
    user: userId,
    // Keep legacy paths (if any) so older entries continue to work
    product_photos: existingUrls,
    // New in-DB images array
    images: uploadedImages,
    title: body.title,
    description: body.description,
    category: body.category,
    brand: body.brand,
    size: body.size,
    colors: body.colors,
    material: body.material,
    condition: body.condition,
    price: body.price,
    quantity: body.quantity ?? 1,
    shipping_cost: body.shipping_cost,
    package_size: body.package_size,
  };
};


const BASE_URL = process.env.BASE_URL || process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
const toAbsoluteUrl = (u) => {
  if (!u) return u;
  if (typeof u === 'object' && u.url) return u.url; // If already processed
  if (/^(https?:)?\/\//i.test(u)) return u;
  
  // Handle Windows paths by normalizing them
  let path = String(u).replace(/\\/g, '/');
  
  // Remove any leading slashes or backslashes
  path = path.replace(/^[\\/]+/, '');
  
  // Remove 'uploads/' if it's at the start to avoid duplication
  path = path.replace(/^uploads[\\/]?/, '');
  
  // Construct the final URL
  return `${BASE_URL}/uploads/${path}`;
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
    quantity: product.quantity,
    shipping_cost: product.shipping_cost,
    package_size: product.package_size,
    // New: expose DB-stored images via streaming endpoint
    images: Array.isArray(product.images)
      ? product.images.map((_, idx) => `${BASE_URL}/api/user/product/image/${product._id}/${idx}`)
      : [],
    // Legacy fallback: absolute URLs for old path-based images
    product_photos: Array.isArray(product.product_photos)
      ? product.product_photos.map(toAbsoluteUrl)
      : [],
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
    quantity: product.quantity,
    shipping_cost: product.shipping_cost,
    package_size: product.package_size,
    status: product.status,
    hide: product.hide || false,
    // New: expose DB-stored images via streaming endpoint (list view)
    images: Array.isArray(product.images)
      ? product.images.map((_, idx) => ({
          url: `${BASE_URL}/api/user/product/image/${product._id}/${idx}`,
          index: idx
        }))
      : [],
    // Legacy fallback for old items referencing local/remote paths
    product_photos: Array.isArray(product.product_photos)
      ? product.product_photos.map(photo => ({
          url: toAbsoluteUrl(photo),
          path: photo
        }))
      : [],
    favoriteCount: product.favoritedBy ? product.favoritedBy.length : 0,
    views: product.views || 0,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt
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
    images: Array.isArray(product.images)
      ? product.images.map((_, idx) => `${BASE_URL}/api/user/product/image/${product._id}/${idx}`)
      : [],
    product_photos: Array.isArray(product.product_photos)
      ? product.product_photos.map(toAbsoluteUrl)
      : [],
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
    images: Array.isArray(product.images)
      ? product.images.map((_, idx) => `${BASE_URL}/api/user/product/image/${product._id}/${idx}`)
      : [],
    product_photos: Array.isArray(product.product_photos)
      ? product.product_photos.map(toAbsoluteUrl)
      : [],
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

