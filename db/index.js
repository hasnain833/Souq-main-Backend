const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/Souq';

  try {
    // Optional: enable query logging in dev
    if (process.env.NODE_ENV !== 'production') {
      mongoose.set('debug', false); // set true if you want verbose logs
    }

    await mongoose.connect(uri); // no deprecated options
    console.log('MongoDB Connected:', mongoose.connection.name);

    // Optional health ping
    await mongoose.connection.db.admin().command({ ping: 1 });
    console.log('MongoDB ping OK');
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }

  // Clean shutdown
  process.on('SIGINT', async () => {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    process.exit(0);
  });
}

module.exports = connectDB;
