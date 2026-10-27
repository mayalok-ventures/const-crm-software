const net = require('net');
const path = require('path');
const { spawn } = require('child_process');

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

async function waitForPort(port = 27017, maxAttempts = 30, intervalMs = 500) {
  for (let i = 0; i < maxAttempts; i++) {
    if (await isPortActive(port)) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

const fs = require('fs');

async function ensureMongo() {
  const active = await isPortActive(27017);
  if (active) {
    console.log('\x1b[32m[MongoDB]\x1b[0m Local MongoDB is already active on 127.0.0.1:27017');
    return;
  }

  console.log('\x1b[33m[MongoDB]\x1b[0m Starting persistent local MongoDB background daemon...');
  const scriptPath = path.join(__dirname, 'start-local-mongo.js');
  const logFile = path.join(__dirname, 'mongo-daemon.log');
  const out = fs.openSync(logFile, 'a');
  const err = fs.openSync(logFile, 'a');

  const child = spawn(process.execPath, [scriptPath], {
    detached: true,
    stdio: ['ignore', out, err],
    cwd: __dirname,
    windowsHide: true,
  });

  child.unref();

  const isReady = await waitForPort(27017, 40, 500);
  if (!isReady) {
    let recentLog = '';
    try {
      recentLog = fs.readFileSync(logFile, 'utf8').slice(-800);
    } catch (_) {}
    console.error('\x1b[31m[MongoDB] Failed to start local MongoDB daemon on port 27017 within 20 seconds.\x1b[0m');
    if (recentLog) console.error('[MongoDB Startup Log]:\n' + recentLog);
    process.exit(1);
  }

  console.log('\x1b[32m[MongoDB]\x1b[0m ✅ Persistent MongoDB background daemon is ready on 127.0.0.1:27017');
}

if (require.main === module) {
  ensureMongo().then(() => {
    process.exit(0);
  }).catch((err) => {
    console.error('[MongoDB Error]:', err.message);
    process.exit(1);
  });
}

module.exports = { ensureMongo, isPortActive, waitForPort };
