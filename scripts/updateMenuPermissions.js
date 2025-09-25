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

// Admin model
const adminSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: String,
  password: String,
  role: {
    type: String,
    enum: ['super_admin', 'admin', 'moderator'],
    default: 'admin'
  },
  permissions: {
    users: {
      view: { type: Boolean, default: true },
      edit: { type: Boolean, default: true },
      delete: { type: Boolean, default: false },
      suspend: { type: Boolean, default: true }
    },
    categories: {
      view: { type: Boolean, default: true },
      create: { type: Boolean, default: true },
      edit: { type: Boolean, default: true },
      delete: { type: Boolean, default: false }
    },
    listings: {
      view: { type: Boolean, default: true },
      approve: { type: Boolean, default: true },
      reject: { type: Boolean, default: true },
      edit: { type: Boolean, default: true },
      delete: { type: Boolean, default: false }
    },
    disputes: {
      view: { type: Boolean, default: true },
      resolve: { type: Boolean, default: true },
      escalate: { type: Boolean, default: false }
    },
    counterfeit: {
      view: { type: Boolean, default: true },
      investigate: { type: Boolean, default: true },
      resolve: { type: Boolean, default: true }
    },
    analytics: {
      view: { type: Boolean, default: true },
      export: { type: Boolean, default: false }
    },
    menus: {
      view: { type: Boolean, default: true },
      create: { type: Boolean, default: true },
      edit: { type: Boolean, default: true },
      delete: { type: Boolean, default: true }
    }
  },
  isActive: { type: Boolean, default: true },
  lastLoginAt: { type: Date, default: null },
  refreshToken: { type: String, default: null }
}, { timestamps: true });

const Admin = mongoose.model('Admin', adminSchema);

const updateMenuPermissions = async () => {
  try {
    console.log('🔄 Starting menu permissions update...\n');

    // Find all admin users
    const admins = await Admin.find();
    console.log(`📊 Found ${admins.length} admin user(s) to update\n`);

    let updatedCount = 0;

    for (const admin of admins) {
      console.log(`👤 Checking admin: ${admin.email}`);
      
      let needsUpdate = false;
      
      // Check if menus permissions exist
      if (!admin.permissions.menus) {
        console.log('   ➕ Adding menus permissions');
        admin.permissions.menus = {
          view: true,
          create: true,
          edit: true,
          delete: true
        };
        needsUpdate = true;
      } else if (!admin.permissions.menus.delete) {
        console.log('   🔓 Enabling menu delete permission');
        admin.permissions.menus.delete = true;
        needsUpdate = true;
      } else {
        console.log('   ✅ Menu permissions already correct');
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
      console.log(`   Menu permissions: ${JSON.stringify(admin.permissions.menus)}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error updating menu permissions:', error);
  } finally {
    await mongoose.connection.close();
    console.log('📝 Database connection closed');
    process.exit(0);
  }
};

// Run the update
const main = async () => {
  console.log('🚀 Menu Permissions Update Script');
  console.log('==================================\n');
  
  await connectDB();
  await updateMenuPermissions();
};

main().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
