const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { getDbPath, cleanLockFiles } = require('./getDbPath');

let isReconnecting = false;
let listenersAttached = false;
let isSeeded = false;

function isPortActive(port = 27017, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(800);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

const attachConnectionListeners = (activeUri) => {
  if (listenersAttached) return;
  listenersAttached = true;

  mongoose.connection.on('disconnected', () => {
    if (!isReconnecting && mongoose.connection.readyState === 0) {
      isReconnecting = true;
      console.warn('⚠️ [MongoDB] Connection lost. Reconnecting in 3 seconds...');
      setTimeout(async () => {
        try {
          if (mongoose.connection.readyState === 0 && activeUri) {
            await mongoose.connect(activeUri, {
              maxPoolSize: 50,
              minPoolSize: 5,
              serverSelectionTimeoutMS: 10000,
              socketTimeoutMS: 45000,
            });
            console.log('✅ [MongoDB] Reconnection successful!');
          }
        } catch (err) {
          console.error('❌ [MongoDB] Reconnection attempt failed:', err.message);
        } finally {
          isReconnecting = false;
        }
      }, 3000);
    }
  });

  mongoose.connection.on('error', (err) => {
    console.error('❌ [MongoDB] Database connection error event:', err.message);
  });
};

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  if (mongoose.connection.readyState === 2 && isReconnecting) {
    return mongoose.connection;
  }

  try {
    const rawUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    const hasConfiguredUri = Boolean(rawUri && rawUri.trim().length > 0);

    // In production environments (such as Zoho AppSail), strictly require a valid remote MongoDB URI.
    // Never fall back to localhost in production.
    if (process.env.NODE_ENV === 'production' && !hasConfiguredUri) {
      const configErrMsg = 'FATAL: Production database URI is missing. Neither MONGO_URI nor MONGODB_URI is configured in the environment. Localhost fallback is disabled in production.';
      console.error(`❌ [Production MongoDB Configuration Error] ${configErrMsg}`);
      // Schedule retry so that if runtime configuration or secrets are injected, connection can recover without restarting container
      setTimeout(() => {
        connectDB().catch(err => console.error('Background DB retry error:', err.message));
      }, 10000);
      return;
    }

    let mongoUri = rawUri;
    if (!mongoUri) {
      mongoUri = 'mongodb://127.0.0.1:27017/admission-consultant-crm';
    }

    const isLocal = mongoUri.includes('127.0.0.1') || mongoUri.includes('localhost');

    if (isLocal && process.env.NODE_ENV === 'production') {
      const localhostProdErr = 'FATAL: A localhost MongoDB URI cannot be used in a production container environment. Please provide a valid remote MongoDB Atlas URI.';
      console.error(`❌ [Production MongoDB Configuration Error] ${localhostProdErr}`);
      setTimeout(() => {
        connectDB().catch(err => console.error('Background DB retry error:', err.message));
      }, 10000);
      return;
    }

    // If targeting local MongoDB in non-production, ensure MongoDB is actively running
    if (isLocal && process.env.NODE_ENV !== 'production') {
      const portActive = await isPortActive(27017);
      if (!portActive) {
        console.log('[MongoDB] Port 27017 inactive. Automatically launching embedded MongoDB engine...');
        try {
          const { ensureLocalMongoRunning } = require('./embeddedMongo');
          await ensureLocalMongoRunning();
        } catch (e) {
          console.warn('[MongoDB] Embedded engine load notice:', e.message);
        }
      }
    }

    const safeUri = mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
    try {
      const conn = await mongoose.connect(mongoUri, {
        maxPoolSize: 50,
        minPoolSize: 5,
        serverSelectionTimeoutMS: isLocal ? 8000 : 15000,
        socketTimeoutMS: 45000,
      });
      console.log(`✅ MongoDB Connected: ${conn.connection.host} (${safeUri})`);
      attachConnectionListeners(mongoUri);
      await seedAdminUser();
      return conn;
    } catch (directErr) {
      const sanitizedMsg = (directErr.message || '').replace(/\/\/([^:]+):([^@]+)@/g, '//***:***@');
      if (process.env.NODE_ENV === 'production') {
        console.warn('⚠️ [Production MongoDB] Direct connection failed. Scheduling background reconnection loop...', sanitizedMsg);
        setTimeout(() => {
          connectDB().catch(err => {
            const retryMsg = (err.message || '').replace(/\/\/([^:]+):([^@]+)@/g, '//***:***@');
            console.error('Background DB retry error:', retryMsg);
          });
        }, 5000);
        return;
      }

      console.warn(`[MongoDB] Initial connection attempt failed (${directErr.message}). Triggering auto-recovery...`);
      try {
        const { ensureLocalMongoRunning } = require('./embeddedMongo');
        await ensureLocalMongoRunning();
      } catch (e) {
        console.warn('[MongoDB] Embedded engine load notice:', e.message);
      }

      const conn = await mongoose.connect(mongoUri, {
        maxPoolSize: 50,
        minPoolSize: 5,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
      });
      console.log(`✅ Resilient MongoDB Connected: ${conn.connection.host} (${safeUri})`);
      attachConnectionListeners(mongoUri);
      await seedAdminUser();
      return conn;
    }
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
  }
};

const seedAdminUser = async () => {
  if (isSeeded) return;
  isSeeded = true;

  try {
    const { seedSuperAdmin } = require('../utils/seedSuperAdmin');
    const { seedPlans } = require('../utils/seedPlans');
    const { seedDemoData } = require('../utils/seedDemoData');
    await seedSuperAdmin();
    await seedPlans();
    if (process.env.NODE_ENV !== 'production') {
      await seedDemoData();
    }
  } catch (err) {
    console.error('[Seed Error]:', err.message);
  }
};

module.exports = connectDB;
