/**
 * Debug script to check admin user permissions
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('./db/models/adminModel');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
};

const debugAdminPermissions = async () => {
  try {
    console.log('🔍 Checking admin users and permissions...\n');

    // Get all admin users
    const admins = await Admin.find().select('-password -refreshToken');
    
    if (admins.length === 0) {
      console.log('❌ No admin users found');
      return;
    }

    console.log(`📊 Found ${admins.length} admin user(s):\n`);

    admins.forEach((admin, index) => {
      console.log(`👤 Admin ${index + 1}:`);
      console.log(`   Email: ${admin.email}`);
      console.log(`   Name: ${admin.firstName} ${admin.lastName}`);
      console.log(`   Role: ${admin.role}`);
      console.log(`   ID: ${admin._id}`);
      
      if (admin.permissions) {
        console.log(`   Permissions:`);
        console.log(`     Categories: ${JSON.stringify(admin.permissions.categories || 'Not set')}`);
        console.log(`     Users: ${JSON.stringify(admin.permissions.users || 'Not set')}`);
        console.log(`     Listings: ${JSON.stringify(admin.permissions.listings || 'Not set')}`);
        console.log(`     Analytics: ${JSON.stringify(admin.permissions.analytics || 'Not set')}`);
      } else {
        console.log(`   Permissions: Not set`);
      }
      console.log('');
    });

    // Check if any admin has super_admin role
    const superAdmins = admins.filter(admin => admin.role === 'super_admin');
    console.log(`🔑 Super admins: ${superAdmins.length}`);

    // Check if any admin has categories.view permission
    const adminsWithCategoryView = admins.filter(admin => 
      admin.role === 'super_admin' || 
      (admin.permissions?.categories?.view === true)
    );
    console.log(`👁️ Admins with categories.view permission: ${adminsWithCategoryView.length}`);

    if (adminsWithCategoryView.length === 0) {
      console.log('\n⚠️ ISSUE FOUND: No admin has categories.view permission!');
      console.log('💡 Solutions:');
      console.log('   1. Change admin role to "super_admin"');
      console.log('   2. Add categories.view permission to admin');
    }

  } catch (error) {
    console.error('❌ Error checking admin permissions:', error);
  }
};

const fixAdminPermissions = async () => {
  try {
    console.log('\n🔧 Fixing admin permissions...');

    // Find the first admin and give them super_admin role
    const firstAdmin = await Admin.findOne();
    
    if (!firstAdmin) {
      console.log('❌ No admin found to fix');
      return;
    }

    // Update to super_admin role
    firstAdmin.role = 'super_admin';
    
    // Also ensure they have all permissions
    firstAdmin.permissions = {
      users: {
        view: true,
        create: true,
        edit: true,
        delete: true
      },
      categories: {
        view: true,
        create: true,
        edit: true,
        delete: true
      },
      listings: {
        view: true,
        create: true,
        edit: true,
        delete: true
      },
      analytics: {
        view: true,
        export: true
      },
      menus: {
        view: true,
        create: true,
        edit: true,
        delete: true
      }
    };

    await firstAdmin.save();

    console.log(`✅ Fixed permissions for admin: ${firstAdmin.email}`);
    console.log(`   Role: ${firstAdmin.role}`);
    console.log(`   Categories permissions: ${JSON.stringify(firstAdmin.permissions.categories)}`);

  } catch (error) {
    console.error('❌ Error fixing admin permissions:', error);
  }
};

const main = async () => {
  await connectDB();
  await debugAdminPermissions();
  
  // Ask if user wants to fix permissions
  console.log('\n❓ Do you want to fix admin permissions? (This will make the first admin a super_admin)');
  console.log('   Uncomment the line below and run again to fix:');
  console.log('   // await fixAdminPermissions();');
  
  // Uncomment this line to automatically fix permissions:
  await fixAdminPermissions();
  
  await mongoose.disconnect();
  console.log('\n🔌 Database connection closed');
};

main();
