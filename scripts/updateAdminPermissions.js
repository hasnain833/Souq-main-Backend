/**
 * Script to update existing admin users with categories permissions
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../db/models/adminModel');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
};

const updateAdminPermissions = async () => {
  try {
    console.log('🔧 Updating admin permissions...\n');

    // Get all admin users
    const admins = await Admin.find();
    
    if (admins.length === 0) {
      console.log('❌ No admin users found');
      return;
    }

    console.log(`📊 Found ${admins.length} admin user(s) to update\n`);

    let updatedCount = 0;

    for (const admin of admins) {
      console.log(`👤 Updating admin: ${admin.email}`);
      
      // Check if categories permissions exist
      if (!admin.permissions.categories) {
        console.log('   ➕ Adding categories permissions');
        
        // Add categories permissions
        admin.permissions.categories = {
          view: true,
          create: true,
          edit: true,
          delete: false
        };

        // Also ensure they have super_admin role for full access
        if (admin.role !== 'super_admin') {
          console.log('   🔑 Upgrading to super_admin role');
          admin.role = 'super_admin';
        }

        await admin.save();
        updatedCount++;
        console.log('   ✅ Updated successfully');
      } else {
        console.log('   ℹ️ Categories permissions already exist');
      }
      
      console.log('');
    }

    console.log(`🎉 Update complete! Updated ${updatedCount} admin user(s)`);

    // Verify the updates
    console.log('\n🔍 Verifying updates...');
    const updatedAdmins = await Admin.find().select('-password -refreshToken');
    
    updatedAdmins.forEach((admin, index) => {
      console.log(`👤 Admin ${index + 1}: ${admin.email}`);
      console.log(`   Role: ${admin.role}`);
      console.log(`   Categories permissions: ${JSON.stringify(admin.permissions.categories)}`);
    });

  } catch (error) {
    console.error('❌ Error updating admin permissions:', error);
  }
};

const main = async () => {
  await connectDB();
  await updateAdminPermissions();
  await mongoose.disconnect();
  console.log('\n🔌 Database connection closed');
  console.log('\n✨ Admin permissions updated! You can now access categories in the admin panel.');
};

main();
