const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI;

  // Reuse connection across serverless invocations
  if (!global.__mongoose_conn) {
    global.__mongoose_conn = { conn: null, promise: null };
  }

  const cached = global.__mongoose_conn;

  if (cached.conn) {
    return cached.conn;
  }

  try {
    // Optional: enable query logging in dev
    if (process.env.NODE_ENV !== 'production') {
      mongoose.set('debug', false); // set true if you want verbose logs
    }

    if (!cached.promise) {
      cached.promise = mongoose.connect(uri).then((m) => m);
    }
    const m = await cached.promise;
    cached.conn = m;

    // Connection name may be undefined on serverless cold start; avoid crashing
    const dbName = m?.connection?.name || m?.connection?.db?.databaseName || '(unknown)';
    console.log('MongoDB Connected:', dbName);

    // Optional health ping (guarded to avoid undefined access on serverless)
    try {
      if (m.connection.db && typeof m.connection.db.admin === 'function') {
        await m.connection.db.admin().command({ ping: 1 });
        console.log('MongoDB ping OK');
      } else {
        console.log('MongoDB ping skipped (admin not available yet)');
      }
    } catch (pingErr) {
      console.warn('MongoDB ping skipped:', pingErr.message);
    }

    // Clean shutdown (only once per process)
    if (!global.__mongoose_sigint_bound) {
      global.__mongoose_sigint_bound = true;
      process.on('SIGINT', async () => {
        await mongoose.connection.close();
        console.log('MongoDB connection closed');
        process.exit(0);
      });
    }

    return m;
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    // In serverless, avoid process.exit to let function return 500 instead of crashing the runtime
    throw err;
  }
}

module.exports = connectDB;
