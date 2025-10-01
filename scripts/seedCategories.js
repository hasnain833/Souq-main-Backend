require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('../db/models/categoryModel');

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGO_URI or MONGODB_URI must be set');
    }
    await mongoose.connect(uri);
    console.log('✅ MongoDB connected');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
};

const seedCategories = async () => {
  try {
    console.log('🌱 Seeding categories...');

    // Check if categories already exist
    const existingCategories = await Category.countDocuments();
    if (existingCategories > 0) {
      console.log(`ℹ️ Found ${existingCategories} existing categories. Skipping seed.`);
      return;
    }

    const categories = [
      {
        name: 'Fashion',
        slug: 'fashion',
        subCategories: [
          {
            name: 'Women\'s Clothing',
            slug: 'womens-clothing',
            childCategories: [
              {
                name: 'Dresses',
                slug: 'dresses',
                items: [
                  { name: 'Casual Dresses', slug: 'casual-dresses' },
                  { name: 'Evening Dresses', slug: 'evening-dresses' }
                ]
              },
              {
                name: 'Tops',
                slug: 'tops',
                items: [
                  { name: 'T-Shirts', slug: 't-shirts' },
                  { name: 'Blouses', slug: 'blouses' }
                ]
              }
            ]
          },
          {
            name: 'Men\'s Clothing',
            slug: 'mens-clothing',
            childCategories: [
              {
                name: 'Shirts',
                slug: 'shirts',
                items: [
                  { name: 'Casual Shirts', slug: 'casual-shirts' },
                  { name: 'Formal Shirts', slug: 'formal-shirts' }
                ]
              }
            ]
          }
        ]
      },
      {
        name: 'Electronics',
        slug: 'electronics',
        subCategories: [
          {
            name: 'Mobile Phones',
            slug: 'mobile-phones',
            childCategories: [
              {
                name: 'Smartphones',
                slug: 'smartphones',
                items: [
                  { name: 'iPhone', slug: 'iphone' },
                  { name: 'Samsung', slug: 'samsung' }
                ]
              }
            ]
          }
        ]
      },
      {
        name: 'Home & Garden',
        slug: 'home-garden',
        subCategories: [
          {
            name: 'Furniture',
            slug: 'furniture',
            childCategories: [
              {
                name: 'Living Room',
                slug: 'living-room',
                items: [
                  { name: 'Sofas', slug: 'sofas' },
                  { name: 'Coffee Tables', slug: 'coffee-tables' }
                ]
              }
            ]
          }
        ]
      },
      {
        name: 'Beauty & Personal Care',
        slug: 'beauty-personal-care',
        subCategories: [
          {
            name: 'Makeup',
            slug: 'makeup',
            childCategories: [
              {
                name: 'Face',
                slug: 'face',
                items: [
                  { name: 'Foundation', slug: 'foundation' },
                  { name: 'Concealer', slug: 'concealer' }
                ]
              },
              {
                name: 'Eyes',
                slug: 'eyes',
                items: [
                  { name: 'Mascara', slug: 'mascara' },
                  { name: 'Eyeliner', slug: 'eyeliner' }
                ]
              }
            ]
          }
        ]
      },
      {
        name: 'Sports & Outdoors',
        slug: 'sports-outdoors',
        subCategories: [
          {
            name: 'Fitness',
            slug: 'fitness',
            childCategories: [
              {
                name: 'Gym Equipment',
                slug: 'gym-equipment',
                items: [
                  { name: 'Dumbbells', slug: 'dumbbells' },
                  { name: 'Yoga Mats', slug: 'yoga-mats' }
                ]
              }
            ]
          }
        ]
      },
      {
        name: 'Kids & Babies',
        slug: 'kids-babies',
        subCategories: [
          {
            name: 'Baby Clothing',
            slug: 'baby-clothing',
            childCategories: [
              {
                name: 'Newborn',
                slug: 'newborn',
                items: [
                  { name: 'Onesies', slug: 'onesies' },
                  { name: 'Booties', slug: 'booties' }
                ]
              }
            ]
          }
        ]
      },
      {
        name: 'Books & Media',
        slug: 'books-media',
        subCategories: [
          {
            name: 'Books',
            slug: 'books',
            childCategories: [
              {
                name: 'Fiction',
                slug: 'fiction',
                items: [
                  { name: 'Novels', slug: 'novels' },
                  { name: 'Short Stories', slug: 'short-stories' }
                ]
              }
            ]
          }
        ]
      },
      {
        name: 'Accessories',
        slug: 'accessories',
        subCategories: [
          {
            name: 'Bags & Wallets',
            slug: 'bags-wallets',
            childCategories: [
              {
                name: 'Bags',
                slug: 'bags',
                items: [
                  { name: 'Handbags', slug: 'handbags' },
                  { name: 'Backpacks', slug: 'backpacks' }
                ]
              }
            ]
          },
          {
            name: 'Jewelry',
            slug: 'jewelry',
            childCategories: [
              {
                name: 'Watches',
                slug: 'watches',
                items: [
                  { name: 'Analog', slug: 'analog' },
                  { name: 'Digital', slug: 'digital' }
                ]
              }
            ]
          }
        ]
      }
    ];

    await Category.insertMany(categories);
    console.log('✅ Categories seeded successfully!');

    const count = await Category.countDocuments();
    console.log(`📊 Total categories in database: ${count}`);

  } catch (error) {
    console.error('❌ Error seeding categories:', error);
  }
};

const main = async () => {
  await connectDB();
  await seedCategories();
  await mongoose.disconnect();
  console.log('🔌 Database connection closed');
};

main();
