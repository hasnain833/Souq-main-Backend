const mongoose = require('mongoose');

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }

  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const productSchema = new mongoose.Schema(
    {
      title: String,
      description: String,
      price: Number,
      condition: { type: String, default: 'new' },
      status: { type: String, default: 'active' },
      product_photos: [String],
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
      category: { type: mongoose.Schema.Types.ObjectId, ref: 'categories' },
      hide: { type: Boolean, default: false },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
    },
    { collection: 'products', timestamps: true }
  );

  const Product = mongoose.model('ProductSeedModel', productSchema);

  const now = new Date();
  const daysAgo = (n) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  const samples = [
    {
      title: 'Vintage Denim Jacket',
      description: 'Classic blue denim, lightly used',
      price: 49.99,
      condition: 'used - good',
      status: 'active',
      product_photos: ['uploads/products/sample-denim-jacket.jpg'],
      hide: false,
      createdAt: daysAgo(5),
      updatedAt: daysAgo(5),
    },
    {
      title: 'Leather Handbag',
      description: 'Genuine leather handbag in great condition',
      price: 89.0,
      condition: 'used - like new',
      status: 'active',
      product_photos: ['uploads/products/sample-handbag.jpg'],
      hide: false,
      createdAt: daysAgo(15),
      updatedAt: daysAgo(15),
    },
    {
      title: 'Running Shoes',
      description: 'Lightweight and comfortable running shoes',
      price: 39.5,
      condition: 'used - good',
      status: 'active',
      product_photos: ['uploads/products/sample-shoes.jpg'],
      hide: false,
      createdAt: daysAgo(29),
      updatedAt: daysAgo(29),
    },
    // Additional recent products
    {
      title: 'Casual Cotton T-Shirt',
      description: 'Soft cotton tee, minimal wear',
      price: 12.99,
      condition: 'used - good',
      status: 'active',
      product_photos: ['uploads/products/sample-tshirt.jpg'],
      hide: false,
      createdAt: daysAgo(7),
      updatedAt: daysAgo(7),
    },
    {
      title: 'Designer Sunglasses',
      description: 'UV protection, premium frame',
      price: 59.99,
      condition: 'used - like new',
      status: 'active',
      product_photos: ['uploads/products/sample-sunglasses.jpg'],
      hide: false,
      createdAt: daysAgo(10),
      updatedAt: daysAgo(10),
    },
    {
      title: 'Classic Wrist Watch',
      description: 'Analog watch with leather strap',
      price: 79.0,
      condition: 'used - good',
      status: 'active',
      product_photos: ['uploads/products/sample-watch.jpg'],
      hide: false,
      createdAt: daysAgo(12),
      updatedAt: daysAgo(12),
    },
    {
      title: 'Backpack',
      description: 'Durable everyday backpack with laptop sleeve',
      price: 29.99,
      condition: 'used - good',
      status: 'active',
      product_photos: ['uploads/products/sample-backpack.jpg'],
      hide: false,
      createdAt: daysAgo(18),
      updatedAt: daysAgo(18),
    },
    {
      title: 'Wireless Headphones',
      description: 'Over-ear, great battery life',
      price: 45.0,
      condition: 'used - good',
      status: 'active',
      product_photos: ['uploads/products/sample-headphones.jpg'],
      hide: false,
      createdAt: daysAgo(20),
      updatedAt: daysAgo(20),
    },
    {
      title: 'Sports Hoodie',
      description: 'Warm hoodie for workouts and casual wear',
      price: 24.5,
      condition: 'used - good',
      status: 'active',
      product_photos: ['uploads/products/sample-hoodie.jpg'],
      hide: false,
      createdAt: daysAgo(22),
      updatedAt: daysAgo(22),
    },
    {
      title: 'Leather Belt',
      description: 'Genuine leather belt, adjustable',
      price: 14.99,
      condition: 'used - like new',
      status: 'active',
      product_photos: ['uploads/products/sample-belt.jpg'],
      hide: false,
      createdAt: daysAgo(25),
      updatedAt: daysAgo(25),
    },
    // An older product to validate cutoff filtering (will not be returned by API when days is small)
    {
      title: 'Old Winter Coat',
      description: 'Warm coat from last season',
      price: 25.0,
      condition: 'used - fair',
      status: 'active',
      product_photos: ['uploads/products/sample-coat.jpg'],
      hide: false,
      createdAt: daysAgo(45),
      updatedAt: daysAgo(45),
    },
  ];

  try {
    const result = await Product.insertMany(samples);
    console.log(`Inserted ${result.length} products.`);
  } catch (err) {
    console.error('Seeding failed:', err);
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
