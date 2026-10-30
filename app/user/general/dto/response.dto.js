exports.getAllProductRes = (product) => {
  return {
    id: product._id,
    // user: product.user,
    user: product.user ? {
      id: product.user._id,
      name: product.user.name || product.user.userName,
      email: product.user.email
    } : null,
    title: product.title,
    description: product.description,
    brand: product.brand,
    size: product.size,
    colors: product.colors,
    material: product.material,
    condition:product.condition,
    price: product.price,
    shipping_cost:product.shipping_cost,
    package_size: product.package_size,
    product_photos: product.product_photos,
    // product_photos: product.product_photos.map(photo => `${process.env.BASE_URL}/uploads/${photo}`),
    createdAt: product.createdAt,
  };
};