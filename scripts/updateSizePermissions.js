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
const Admin = require('../db/models/adminModel');

const updateSizePermissions = async () => {
  try {
    console.log('🔄 Starting size permissions update...\n');

    // Find all admin users
    const admins = await Admin.find();
    console.log(`📊 Found ${admins.length} admin user(s) to update\n`);

    let updatedCount = 0;

    for (const admin of admins) {
      console.log(`👤 Checking admin: ${admin.email}`);
      
      let needsUpdate = false;
      
      // Check if sizes permissions exist
      if (!admin.permissions.sizes) {
        console.log('   ➕ Adding sizes permissions');
        admin.permissions.sizes = {
          view: true,
          create: true,
          edit: true,
          delete: true
        };
        needsUpdate = true;
      } else {
        console.log('   ✅ Size permissions already exist');
      }

      // Also ensure they have super_admin role for full access
      if (admin.role !== 'super_admin') {
        console.log('   🔑 Upgrading to super_admin role');
        admin.role = 'super_admin';
        needsUpdate = true;
      }

      if (needsUpdate) {
        await admin.save();
        updatedCount++;
        console.log('   ✅ Updated successfully');
      }
      
      console.log('');
    }

    console.log(`🎉 Update completed! Updated ${updatedCount} admin user(s)`);
    
    // Verify the updates
    console.log('\n🔍 Verifying updates...');
    const updatedAdmins = await Admin.find();
    
    updatedAdmins.forEach((admin, index) => {
      console.log(`👤 Admin ${index + 1}: ${admin.email}`);
      console.log(`   Role: ${admin.role}`);
      console.log(`   Size permissions: ${JSON.stringify(admin.permissions.sizes)}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error updating size permissions:', error);
  } finally {
    await mongoose.connection.close();
    console.log('📝 Database connection closed');
    process.exit(0);
  }
};

// Run the update
const main = async () => {
  console.log('🚀 Size Permissions Update Script');
  console.log('==================================\n');
  
  await connectDB();
  await updateSizePermissions();
};

main().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
