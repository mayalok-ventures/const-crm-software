const path = require('path');
const fs = require('fs');

/**
 * Resolves the appropriate database storage directory for local MongoDB.
 * Critical: If running within a cloud-synced folder like Microsoft OneDrive,
 * WiredTiger file-locks trigger instant process resets/crashes (ECONNRESET).
 * To ensure 100% stability, store data in LOCALAPPDATA or standard data path.
 */
function getDbPath() {
  const isOneDrive = __dirname.toLowerCase().includes('onedrive');
  let baseDir;

  if (process.env.MONGO_DATA_DIR) {
    baseDir = path.resolve(process.env.MONGO_DATA_DIR);
  } else if (isOneDrive && process.env.LOCALAPPDATA) {
    baseDir = path.join(process.env.LOCALAPPDATA, 'SahyakCRM', 'data', 'db');
  } else if (process.env.LOCALAPPDATA) {
    baseDir = path.join(process.env.LOCALAPPDATA, 'SahyakCRM', 'data', 'db');
  } else {
    baseDir = path.join(__dirname, '..', '..', 'data', 'db');
  }

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  return baseDir;
}

function cleanLockFiles(dbPath) {
  if (!dbPath || !fs.existsSync(dbPath)) return;
  const lockFiles = ['mongod.lock', 'WiredTiger.lock'];
  for (const file of lockFiles) {
    const filePath = path.join(dbPath, file);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {}
  }
}

module.exports = { getDbPath, cleanLockFiles };
