require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../db/models/adminModel');

const updateNotificationPermissions = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('🔗 Connected to MongoDB');
    console.log('🔔 Updating admin notification permissions...\n');

    // Get all admin users
    const admins = await Admin.find();
    
    if (admins.length === 0) {
      console.log('❌ No admin users found');
      return;
    }

    console.log(`📊 Found ${admins.length} admin user(s) to update\n`);

    let updatedCount = 0;

    for (const admin of admins) {
      console.log(`👤 Checking admin: ${admin.email}`);
      
      let needsUpdate = false;
      
      // Check if notification permissions exist
      if (!admin.permissions.notifications) {
        console.log('   ➕ Adding notification permissions');
        admin.permissions.notifications = {
          read: true,
          create: true,
          update: true,
          delete: false
        };
        needsUpdate = true;
      } else {
        console.log('   ✅ Notification permissions already exist');
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
      console.log(`   Notification permissions: ${JSON.stringify(admin.permissions.notifications)}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error updating notification permissions:', error);
  } finally {
    await mongoose.connection.close();
    console.log('📝 Database connection closed');
    process.exit(0);
  }
};

// Run the update
updateNotificationPermissions();
