const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI;

  // Reuse connection across serverless invocations
  if (!global.mongoose) {
    global.mongoose = { conn: null, promise: null };
  }

  const cached = global.mongoose;

  // If we already have an open connection, reuse it
  if (cached.conn && mongoose.connection?.readyState === 1) {
    console.log('[DB] Reusing existing MongoDB connection');
    return cached.conn;
  }

  try {
    // Optional: enable query logging in dev
    if (process.env.NODE_ENV !== 'production') {
      mongoose.set('debug', false); // set true if you want verbose logs
    }

    if (!cached.promise) {
      console.log('[DB] Creating new MongoDB connection');
      // Production-friendly defaults for serverless
      mongoose.set('strictQuery', true);
      // Avoid buffering commands for too long in serverless functions
      mongoose.set('bufferCommands', false);

      cached.promise = mongoose
        .connect(uri, {
          // Add options here if needed; Mongoose v6+ has good defaults
        })
        .then((m) => m)
        .catch((err) => {
          // Reset the promise so future calls can retry
          cached.promise = null;
          throw err;
        });
    }
    const m = await cached.promise;
    cached.conn = m;

    // Connection name may be undefined on serverless cold start; avoid crashing
    const dbName = m?.connection?.name || m?.connection?.db?.databaseName || '(unknown)';
    if (mongoose.connection?.readyState === 1) {
      console.log(`[DB] MongoDB connected: ${dbName}`);
    }

    // Optional health ping (guarded to avoid undefined access on serverless)
    try {
      if (m.connection.db && typeof m.connection.db.admin === 'function') {
        await m.connection.db.admin().command({ ping: 1 });
        console.log('[DB] MongoDB ping OK');
      } else {
        console.log('[DB] MongoDB ping skipped (admin not available yet)');
      }
    } catch (pingErr) {
      console.warn('[DB] MongoDB ping skipped:', pingErr.message);
    }

    // Clean shutdown (only once per process)
    if (!global.__mongoose_sigint_bound) {
      global.__mongoose_sigint_bound = true;
      process.on('SIGINT', async () => {
        await mongoose.connection.close();
        console.log('[DB] MongoDB connection closed');
        process.exit(0);
      });
    }

    return m;
  } catch (err) {
    console.error('[DB] MongoDB connection failed:', err.message);
    // In serverless, avoid process.exit to let function return 500 instead of crashing the runtime
    throw err;
  }
}

module.exports = connectDB;
