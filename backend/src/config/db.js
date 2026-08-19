const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

let isReconnecting = false;
let listenersAttached = false;

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
              serverSelectionTimeoutMS: 5000,
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
  try {
    let mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

    if (mongoUri && mongoUri.startsWith('mongodb')) {
      try {
        const conn = await mongoose.connect(mongoUri, {
          maxPoolSize: 50,
          minPoolSize: 5,
          serverSelectionTimeoutMS: 15000,
          socketTimeoutMS: 45000,
        });
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        attachConnectionListeners(mongoUri);
        await seedAdminUser();
        return;
      } catch (e) {
        console.log(`Direct MongoDB connection failed (${e.message}). Initializing resilient embedded MongoDB...`);
      }
    }

    let defaultLocalUri = 'mongodb://127.0.0.1:27017/mobile-crm';

    // First, test if a local MongoDB is already running on port 27017
    try {
      const conn = await mongoose.connect(defaultLocalUri, {
        maxPoolSize: 50,
        minPoolSize: 5,
        serverSelectionTimeoutMS: 1500,
        socketTimeoutMS: 45000,
      });
      console.log(`✅ Local MongoDB Connected: ${conn.connection.host} (${defaultLocalUri})`);
      process.env.MONGO_URI = defaultLocalUri;
      attachConnectionListeners(defaultLocalUri);
      await seedAdminUser();
      return;
    } catch (localErr) {
      // Port 27017 not yet active, spawn embedded instance
    }

    const { MongoMemoryServer } = require('mongodb-memory-server');
    const dbPath = path.join(__dirname, '..', '..', 'data', 'db');
    if (!fs.existsSync(dbPath)) fs.mkdirSync(dbPath, { recursive: true });

    // Clean up stale lock files from previous unclean shutdowns
    const lockFile = path.join(dbPath, 'mongod.lock');
    const wtLockFile = path.join(dbPath, 'WiredTiger.lock');
    try { if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile); } catch {}
    try { if (fs.existsSync(wtLockFile)) fs.unlinkSync(wtLockFile); } catch {}

    if (!global.__mongodInstance) {
      try {
        global.__mongodInstance = await MongoMemoryServer.create({
          instance: {
            port: 27017,
            dbPath: dbPath,
            storageEngine: 'wiredTiger',
            dbName: 'mobile-crm',
          }
        });
      } catch (err) {
        console.warn('WiredTiger persistent instance busy or unavailable, launching in-memory engine on port 27017...');
        try {
          global.__mongodInstance = await MongoMemoryServer.create({
            instance: {
              port: 27017,
              dbName: 'mobile-crm',
            }
          });
        } catch (e2) {
          console.warn('Port 27017 busy, launching on dynamic port...');
          global.__mongodInstance = await MongoMemoryServer.create({
            instance: {
              dbName: 'mobile-crm',
            }
          });
        }
      }
    }
    mongoUri = global.__mongodInstance ? global.__mongodInstance.getUri() : defaultLocalUri;
    process.env.MONGO_URI = mongoUri;

    const conn = await mongoose.connect(mongoUri, {
      maxPoolSize: 50,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log(`✅ Resilient MongoDB Connected: ${conn.connection.host} (${mongoUri})`);
    attachConnectionListeners(mongoUri);
    await seedAdminUser();
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
};

const seedAdminUser = async () => {
  const User = require('../models/User');
  const adminEmail = 'admin@crm.com';
  const adminExists = await User.findOne({ email: adminEmail });
  if (!adminExists) {
    console.log('Seeding Super Admin user...');
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
    await User.create({
      name: 'Super Admin',
      email: adminEmail,
      password: adminPassword,
      username: 'ADMIN77',
      isAdmin: true,
      role: 'superadmin',
      plan: 'pro',
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorRecoveryCodes: [],
    });
    console.log('Super Admin user seeded successfully!');
  } else {
    // Explicitly reset 2FA on admin user as requested
    adminExists.twoFactorEnabled = false;
    adminExists.twoFactorSecret = null;
    adminExists.twoFactorRecoveryCodes = [];
    adminExists.twoFactorOtp = null;
    adminExists.twoFactorOtpExpires = null;
    await adminExists.save();
    console.log('🔒 Super Admin 2FA explicitly cleared for direct password login.');
  }
};

module.exports = connectDB;
