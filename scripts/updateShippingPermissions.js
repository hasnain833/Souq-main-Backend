require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../db/models/adminModel');

const updateShippingPermissions = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Update all existing admin users to include shipping permissions
    const result = await Admin.updateMany(
      {},
      {
        $set: {
          'permissions.shipping': {
            view: true,
            create: true,
            update: true,
            delete: false
          }
        }
      }
    );

    console.log(`Updated ${result.modifiedCount} admin users with shipping permissions`);

    // Verify the update
    const admins = await Admin.find({}, 'firstName lastName email permissions.shipping');
    console.log('\nAdmin users with shipping permissions:');
    admins.forEach(admin => {
      console.log(`- ${admin.firstName} ${admin.lastName} (${admin.email}): shipping permissions =`, admin.permissions.shipping);
    });

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
    console.log('Shipping permissions update completed successfully!');

  } catch (error) {
    console.error('Error updating shipping permissions:', error);
    process.exit(1);
  }
};

updateShippingPermissions();
