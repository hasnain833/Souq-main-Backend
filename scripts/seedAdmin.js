require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Admin = require('../db/models/adminModel');
const connectDB = require('../db');

(async () => {
  try {
    await connectDB();

    const email = process.env.ADMIN_SEED_EMAIL;
    const password = process.env.ADMIN_SEED_PASSWORD;
    const firstName = process.env.ADMIN_SEED_FIRST_NAME || 'Admin';
    const lastName = process.env.ADMIN_SEED_LAST_NAME || 'User';
    const role = process.env.ADMIN_SEED_ROLE || 'admin';

    if (!email || !password) {
      console.error('Missing ADMIN_SEED_EMAIL or ADMIN_SEED_PASSWORD in .env');
      process.exit(1);
    }

    const existing = await Admin.findOne({ email });
    if (existing) {
      console.log(`Admin already exists for ${email}. No changes made.`);
      process.exit(0);
    }

    const hashed = await bcrypt.hash(password, 10);
    const admin = new Admin({ firstName, lastName, email, password: hashed, role });
    await admin.save();

    console.log('✅ Admin seeded successfully');
    console.log({ email, role, id: admin.id, _id: admin._id.toString() });
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to seed admin:', err?.message || err);
    process.exit(1);
  } finally {
    try { await mongoose.connection.close(); } catch {}
  }
})();
