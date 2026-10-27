const { spawn } = require('child_process');
const net = require('net');
const path = require('path');

function isPortActive(port, host = '127.0.0.1') {
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

async function waitForPort(port, maxAttempts = 30, intervalMs = 1000) {
  for (let i = 0; i < maxAttempts; i++) {
    if (await isPortActive(port)) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

const processes = [];

function startProcess(name, command, args, cwd, colorCode) {
  const isWindows = process.platform === 'win32';
  const proc = spawn(command, args, {
    cwd,
    shell: isWindows,
    stdio: ['inherit', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'development', FORCE_COLOR: '1' },
  });

  processes.push({ name, proc });

  const prefix = `\x1b[${colorCode}m[${name}]\x1b[0m`;

  proc.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach((line) => {
      if (line.trim()) console.log(`${prefix} ${line}`);
    });
  });

  proc.stderr.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach((line) => {
      if (line.trim()) console.error(`${prefix} ${line}`);
    });
  });

  proc.on('close', (code) => {
    if (code !== 0 && code !== null) {
      console.log(`${prefix} Process exited with code ${code}`);
    }
  });

  return proc;
}

async function main() {
  console.log('\n======================================================');
  console.log('🚀 Starting Sahyak CRM Development Environment');
  console.log('======================================================\n');

  // 1. Ensure Local MongoDB is running
  const mongoAlreadyRunning = await isPortActive(27017);
  if (mongoAlreadyRunning) {
    console.log('\x1b[32m[MongoDB]\x1b[0m Local MongoDB is already active on 127.0.0.1:27017 (Persistent DB)');
  } else {
    console.log('\x1b[33m[MongoDB]\x1b[0m Starting local MongoDB server on 127.0.0.1:27017...');
    startProcess('MongoDB', 'node', ['start-local-mongo.js'], path.join(__dirname, 'backend'), '33');
    const isReady = await waitForPort(27017, 30, 1000);
    if (!isReady) {
      console.error('\x1b[31m[MongoDB] Failed to start local MongoDB on port 27017 in 30 seconds.\x1b[0m');
      process.exit(1);
    }
    console.log('\x1b[32m[MongoDB]\x1b[0m ✅ MongoDB is ready on 127.0.0.1:27017!');
  }

  // 2. Start Backend API
  console.log('\x1b[34m[Backend]\x1b[0m Starting Express API server on http://localhost:5000...');
  startProcess('Backend', 'npm', ['run', 'dev'], path.join(__dirname, 'backend'), '34');

  // 3. Start Frontend
  console.log('\x1b[36m[Frontend]\x1b[0m Starting Next.js frontend on http://localhost:3000...');
  startProcess('Frontend', 'npm', ['run', 'dev'], path.join(__dirname, 'frontend'), '36');

  console.log('\n------------------------------------------------------');
  console.log('✨ All services initiated!');
  console.log('  🌐 Frontend : http://localhost:3000');
  console.log('  🔌 Backend  : http://localhost:5000');
  console.log('  🍃 MongoDB  : mongodb://127.0.0.1:27017/mobile-crm');
  console.log('  🧭 Compass  : Pre-configured in Antigravity IDE ("Local Mobile CRM")');
  console.log('------------------------------------------------------\n');

  const shutdown = () => {
    console.log('\n🛑 Shutting down all local CRM processes...');
    processes.forEach(({ name, proc }) => {
      try {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', proc.pid, '/f', '/t']);
        } else {
          proc.kill('SIGTERM');
        }
      } catch { }
    });
    setTimeout(() => process.exit(0), 1000);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
