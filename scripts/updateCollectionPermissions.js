const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

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
    },
    sizes: {
      view: { type: Boolean, default: true },
      create: { type: Boolean, default: true },
      edit: { type: Boolean, default: true },
      delete: { type: Boolean, default: true }
    },
    shipping: {
      view: { type: Boolean, default: true },
      create: { type: Boolean, default: true },
      update: { type: Boolean, default: true },
      delete: { type: Boolean, default: false }
    },
    notifications: {
      read: { type: Boolean, default: true },
      create: { type: Boolean, default: true },
      update: { type: Boolean, default: true },
      delete: { type: Boolean, default: false }
    },
    orders: {
      view: { type: Boolean, default: true },
      update: { type: Boolean, default: true },
      delete: { type: Boolean, default: false }
    },
    ratings: {
      view: { type: Boolean, default: true },
      update: { type: Boolean, default: true },
      delete: { type: Boolean, default: false }
    },
    reports: {
      view: { type: Boolean, default: true },
      update: { type: Boolean, default: true },
      delete: { type: Boolean, default: false }
    },
    // New collection permissions
    addresses: {
      view: { type: Boolean, default: true },
      edit: { type: Boolean, default: true },
      delete: { type: Boolean, default: false }
    },
    blockedUsers: {
      view: { type: Boolean, default: true },
      edit: { type: Boolean, default: true },
      delete: { type: Boolean, default: true }
    },
    notificationSettings: {
      view: { type: Boolean, default: true },
      edit: { type: Boolean, default: true },
      delete: { type: Boolean, default: false }
    },
    platformFees: {
      view: { type: Boolean, default: true },
      create: { type: Boolean, default: false },
      edit: { type: Boolean, default: false },
      delete: { type: Boolean, default: false }
    },
    shippingProviders: {
      view: { type: Boolean, default: true },
      create: { type: Boolean, default: true },
      edit: { type: Boolean, default: true },
      delete: { type: Boolean, default: false }
    }
  },
  isActive: { type: Boolean, default: true },
  lastLoginAt: { type: Date, default: null },
  refreshToken: { type: String, default: null }
}, { timestamps: true });

const Admin = mongoose.model('Admin', adminSchema);

async function updateAdminPermissions() {
  try {
    console.log('🔄 Starting admin permissions update...');

    // Get all admins
    const admins = await Admin.find({});
    console.log(`📊 Found ${admins.length} admin(s) to update`);

    let updatedCount = 0;

    for (const admin of admins) {
      let needsUpdate = false;
      const updates = {};

      // Check and add missing collection permissions
      const newPermissions = {
        addresses: {
          view: true,
          edit: true,
          delete: false
        },
        blockedUsers: {
          view: true,
          edit: true,
          delete: true
        },
        notificationSettings: {
          view: true,
          edit: true,
          delete: false
        },
        platformFees: {
          view: true,
          create: admin.role === 'super_admin',
          edit: admin.role === 'super_admin',
          delete: false
        },
        shippingProviders: {
          view: true,
          create: true,
          edit: true,
          delete: false
        }
      };

      // Check each new permission
      for (const [resource, actions] of Object.entries(newPermissions)) {
        if (!admin.permissions[resource]) {
          console.log(`➕ Adding ${resource} permissions for ${admin.email}`);
          updates[`permissions.${resource}`] = actions;
          needsUpdate = true;
        } else {
          // Check individual actions
          for (const [action, defaultValue] of Object.entries(actions)) {
            if (admin.permissions[resource][action] === undefined) {
              console.log(`➕ Adding ${resource}.${action} permission for ${admin.email}`);
              updates[`permissions.${resource}.${action}`] = defaultValue;
              needsUpdate = true;
            }
          }
        }
      }

      if (needsUpdate) {
        await Admin.updateOne({ _id: admin._id }, { $set: updates });
        updatedCount++;
        console.log(`✅ Updated permissions for ${admin.email}`);
      } else {
        console.log(`✨ ${admin.email} already has all required permissions`);
      }
    }

    console.log(`\n🎉 Update completed!`);
    console.log(`📈 Updated ${updatedCount} admin(s) out of ${admins.length} total`);

    // Verify the updates
    console.log('\n🔍 Verifying updates...');
    const updatedAdmins = await Admin.find({});
    
    for (const admin of updatedAdmins) {
      const missingPermissions = [];
      
      const requiredPermissions = [
        'addresses.view', 'addresses.edit', 'addresses.delete',
        'blockedUsers.view', 'blockedUsers.edit', 'blockedUsers.delete',
        'notificationSettings.view', 'notificationSettings.edit', 'notificationSettings.delete',
        'platformFees.view', 'platformFees.create', 'platformFees.edit', 'platformFees.delete',
        'shippingProviders.view', 'shippingProviders.create', 'shippingProviders.edit', 'shippingProviders.delete'
      ];

      for (const permission of requiredPermissions) {
        const [resource, action] = permission.split('.');
        if (!admin.permissions[resource] || admin.permissions[resource][action] === undefined) {
          missingPermissions.push(permission);
        }
      }

      if (missingPermissions.length === 0) {
        console.log(`✅ ${admin.email}: All collection permissions present`);
      } else {
        console.log(`❌ ${admin.email}: Missing permissions: ${missingPermissions.join(', ')}`);
      }
    }

    console.log('\n✨ Permission update script completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error updating admin permissions:', error);
    process.exit(1);
  }
}

// Run the update
updateAdminPermissions();
