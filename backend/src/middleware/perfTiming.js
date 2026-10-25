const { monitorEventLoopDelay } = require('perf_hooks');

const isPerfDebug = process.env.PERF_DEBUG === '1' || process.env.PERF_DEBUG === 'true';

let eventLoopHistogram = null;
let lastCpuUsage = null;
let eventLoopInterval = null;

function sanitizeUrl(req) {
  try {
    const parsed = new URL(req.originalUrl || req.url, 'http://localhost');
    const safeParams = new URLSearchParams();
    for (const [key, value] of parsed.searchParams.entries()) {
      if (/token|password|secret|auth|key|authorization/i.test(key)) {
        safeParams.set(key, '[REDACTED]');
      } else {
        safeParams.set(key, value.length > 50 ? value.substring(0, 50) + '...' : value);
      }
    }
    const queryStr = safeParams.toString();
    return parsed.pathname + (queryStr ? '?' + queryStr : '');
  } catch {
    return req.path || req.url;
  }
}

/**
 * Express middleware for per-request timing and Server-Timing header
 */
function perfTimingMiddleware(req, res, next) {
  if (!isPerfDebug) {
    return next();
  }

  const startHr = process.hrtime.bigint();
  req._perf = {
    start: startHr,
    authMs: 0,
    wsMs: 0,
    ctrlMs: 0,
    dbMs: 0,
  };

  const originalWriteHead = res.writeHead;
  res.writeHead = function (statusCode, ...args) {
    try {
      const endHr = process.hrtime.bigint();
      const totalMs = Number(endHr - startHr) / 1e6;
      req._perf.totalMs = totalMs;

      const timingParts = [
        `total;dur=${totalMs.toFixed(2)}`,
      ];

      if (req._perf.authMs > 0) {
        timingParts.push(`auth;dur=${req._perf.authMs.toFixed(2)}`);
      }
      if (req._perf.wsMs > 0) {
        timingParts.push(`ws;dur=${req._perf.wsMs.toFixed(2)}`);
      }
      if (req._perf.authMs > 0 || req._perf.wsMs > 0) {
        const accounted = (req._perf.authMs || 0) + (req._perf.wsMs || 0);
        req._perf.ctrlMs = Math.max(0, totalMs - accounted);
        timingParts.push(`ctrl;dur=${req._perf.ctrlMs.toFixed(2)}`);
      }
      if (req._perf.dbMs > 0) {
        timingParts.push(`db;dur=${req._perf.dbMs.toFixed(2)}`);
      }

      res.setHeader('Server-Timing', timingParts.join(', '));
    } catch (err) {
      // Don't fail response if header formatting fails
    }

    return originalWriteHead.call(this, statusCode, ...args);
  };

  res.on('finish', () => {
    const endHr = process.hrtime.bigint();
    const duration = Number(endHr - startHr) / 1e6;
    if (duration > 500) {
      const sanitized = sanitizeUrl(req);
      console.warn(
        `⚠️ [SLOW REQUEST >500ms] ${req.method} ${sanitized} - ${duration.toFixed(2)}ms ` +
        `(auth: ${req._perf.authMs.toFixed(2)}ms, ws: ${req._perf.wsMs.toFixed(2)}ms, ctrl: ${req._perf.ctrlMs.toFixed(2)}ms)`
      );
    }
  });

  next();
}

/**
 * Start event loop delay & memory/CPU monitor
 */
function startEventLoopMonitor(intervalMs = 60000) {
  if (!isPerfDebug) {
    return;
  }

  try {
    eventLoopHistogram = monitorEventLoopDelay({ resolution: 20 });
    eventLoopHistogram.enable();
    lastCpuUsage = process.cpuUsage();

    console.log('⏱️ [PerfMonitor] Event loop delay & memory monitoring started.');

    eventLoopInterval = setInterval(() => {
      if (!eventLoopHistogram) return;

      const p50 = (eventLoopHistogram.percentile(50) / 1e6).toFixed(2);
      const p90 = (eventLoopHistogram.percentile(90) / 1e6).toFixed(2);
      const p99 = (eventLoopHistogram.percentile(99) / 1e6).toFixed(2);
      const max = (eventLoopHistogram.max / 1e6).toFixed(2);

      const mem = process.memoryUsage();
      const rssMb = (mem.rss / 1024 / 1024).toFixed(1);
      const heapUsedMb = (mem.heapUsed / 1024 / 1024).toFixed(1);
      const heapTotalMb = (mem.heapTotal / 1024 / 1024).toFixed(1);

      const currentCpu = process.cpuUsage(lastCpuUsage);
      lastCpuUsage = process.cpuUsage();
      const totalCpuMs = (currentCpu.user + currentCpu.system) / 1000;
      const cpuPercent = ((totalCpuMs / intervalMs) * 100).toFixed(1);

      console.log(
        `📊 [EventLoop & System] p50: ${p50}ms | p90: ${p90}ms | p99: ${p99}ms | max: ${max}ms | ` +
        `RSS: ${rssMb}MB (Heap: ${heapUsedMb}/${heapTotalMb}MB) | CPU: ~${cpuPercent}%`
      );

      if (eventLoopHistogram.max / 1e6 > 100) {
        console.warn(`🚨 [EventLoop LAG WARNING] Event loop max lag exceeded 100ms (${max}ms)`);
      }

      eventLoopHistogram.reset();
    }, intervalMs);

    if (eventLoopInterval.unref) {
      eventLoopInterval.unref();
    }
  } catch (err) {
    console.error('Failed to start event loop monitor:', err.message);
  }
}

function stopEventLoopMonitor() {
  if (eventLoopInterval) {
    clearInterval(eventLoopInterval);
    eventLoopInterval = null;
  }
  if (eventLoopHistogram) {
    eventLoopHistogram.disable();
    eventLoopHistogram = null;
  }
}

module.exports = {
  perfTimingMiddleware,
  startEventLoopMonitor,
  stopEventLoopMonitor,
  isPerfDebug,
};
