/**
 * Script to seed initial categories for testing
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('../db/models/categoryModel');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
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
