const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Import the actual Admin model
const Admin = require('./db/models/adminModel');

const checkMenuPermissions = async () => {
  try {
    console.log('🔍 Checking current admin permissions...\n');

    // Find all admin users
    const admins = await Admin.find();
    console.log(`📊 Found ${admins.length} admin user(s)\n`);

    admins.forEach((admin, index) => {
      console.log(`👤 Admin ${index + 1}:`);
      console.log(`   Email: ${admin.email}`);
      console.log(`   Name: ${admin.firstName} ${admin.lastName}`);
      console.log(`   Role: ${admin.role}`);
      console.log(`   ID: ${admin._id}`);
      
      if (admin.permissions && admin.permissions.menus) {
        console.log(`   Menu Permissions:`);
        console.log(`     View: ${admin.permissions.menus.view}`);
        console.log(`     Create: ${admin.permissions.menus.create}`);
        console.log(`     Edit: ${admin.permissions.menus.edit}`);
        console.log(`     Delete: ${admin.permissions.menus.delete}`);
      } else {
        console.log(`   Menu Permissions: Not set`);
      }
      console.log('');
    });

    // Quick fix: Update the first admin to super_admin
    if (admins.length > 0) {
      const firstAdmin = admins[0];
      console.log('🔧 Quick fix: Updating first admin to super_admin...');
      
      firstAdmin.role = 'super_admin';
      
      // Also ensure menu permissions are set
      if (!firstAdmin.permissions.menus) {
        firstAdmin.permissions.menus = {
          view: true,
          create: true,
          edit: true,
          delete: true
        };
      } else {
        firstAdmin.permissions.menus.delete = true;
      }
      
      await firstAdmin.save();
      console.log(`✅ Updated ${firstAdmin.email} to super_admin with full menu permissions`);
    }

  } catch (error) {
    console.error('❌ Error checking permissions:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n📝 Database connection closed');
    process.exit(0);
  }
};

// Run the check
const main = async () => {
  console.log('🚀 Menu Permissions Debug Script');
  console.log('=================================\n');
  
  await connectDB();
  await checkMenuPermissions();
};

main().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
