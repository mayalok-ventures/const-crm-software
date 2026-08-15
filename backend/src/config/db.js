const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

let mongodInstance = null;
let isReconnecting = false;
let listenersAttached = false;

const attachConnectionListeners = (activeUri) => {
  if (listenersAttached) return;
  listenersAttached = true;

  mongoose.connection.on('disconnected', () => {
    // Only attempt reconnect if we did not deliberately disconnect
    if (!isReconnecting && mongoose.connection.readyState === 0) {
      isReconnecting = true;
      console.warn('⚠️ [MongoDB] Connection lost. Reconnecting in 5 seconds...');
      setTimeout(async () => {
        try {
          if (mongoose.connection.readyState === 0) {
            const uri = process.env.MONGO_URI || activeUri;
            await mongoose.connect(uri, {
              maxPoolSize: 50,
              minPoolSize: 10,
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
      }, 5000);
    }
  });

  mongoose.connection.on('error', (err) => {
    console.error('❌ [MongoDB] Database connection error event:', err.message);
  });
};

const connectDB = async () => {
  try {
    let mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mobile-crm';

    try {
      const conn = await mongoose.connect(mongoUri, {
        maxPoolSize: 50,
        minPoolSize: 10,
        serverSelectionTimeoutMS: 2000,
        socketTimeoutMS: 45000,
      });
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      attachConnectionListeners(mongoUri);
    } catch (connErr) {
      console.log(`Direct MongoDB connection failed. Initializing resilient embedded MongoDB...`);

      const { MongoMemoryServer } = require('mongodb-memory-server');
      const dbPath = path.join(__dirname, '..', '..', 'data', 'db');
      if (!fs.existsSync(dbPath)) fs.mkdirSync(dbPath, { recursive: true });

      // Clean up stale lock files from previous unclean shutdowns
      const lockFile = path.join(dbPath, 'mongod.lock');
      const wtLockFile = path.join(dbPath, 'WiredTiger.lock');
      try { if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile); } catch {}
      try { if (fs.existsSync(wtLockFile)) fs.unlinkSync(wtLockFile); } catch {}

      if (!mongodInstance) {
        mongodInstance = await MongoMemoryServer.create({
          instance: {
            dbPath: dbPath,
            storageEngine: 'wiredTiger',
            dbName: 'mobile-crm',
          }
        });
      }
      mongoUri = mongodInstance.getUri();
      process.env.MONGO_URI = mongoUri;

      const conn = await mongoose.connect(mongoUri, {
        maxPoolSize: 50,
        minPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      console.log(`Embedded MongoDB Connected: ${conn.connection.host} (${mongoUri})`);
      attachConnectionListeners(mongoUri);
    }

    // Auto-seed Super Admin User if it doesn't exist
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
      });
      console.log('Super Admin user seeded successfully!');
    }
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
