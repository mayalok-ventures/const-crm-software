require('dotenv').config();
const { validateEnvironment } = require('./src/config/envValidator');
validateEnvironment();

// Process-level uncaught exception & unhandled rejection resilience
process.on('uncaughtException', (err) => {
  console.error('💥 [Fatal] Uncaught Exception:', err.stack || err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('⚠️ [Warning] Unhandled Promise Rejection:', reason instanceof Error ? reason.message : reason);
});

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const mongoose = require('mongoose');

const connectDB = require('./src/config/db');
const { apiLimiter } = require('./src/middleware/rateLimiter');
const { startFollowUpCron } = require('./src/utils/cron');

// Route imports
const authRoutes = require('./src/routes/auth');
const leadsRoutes = require('./src/routes/leads');
const templatesRoutes = require('./src/routes/templates');
const recordingsRoutes = require('./src/routes/recordings');
const groupsRoutes = require('./src/routes/groups');
const analyticsRoutes = require('./src/routes/analytics');
const adminRoutes = require('./src/routes/admin');
const shareRoutes = require('./src/routes/share');
const whatsappRoutes = require('./src/routes/whatsapp');
const metaWhatsAppRoutes = require('./src/routes/metaWhatsAppRoutes');
const campaignRoutes = require('./src/routes/campaigns');
const paymentRoutes = require('./src/routes/payments');
const notificationsRoutes = require('./src/routes/notifications');
const subscriptionRoutes = require('./src/routes/subscriptionRoutes');
const waSession = require('./src/services/waSession');
const campaignWorker = require('./src/services/campaignWorker');
const integrationRoutes = require('./src/routes/integrationRoutes');
const catalogueRoutes = require('./src/routes/catalogue');
const workspaceRoutes = require('./src/routes/workspaceRoutes');
const pipelineRoutes = require('./src/routes/pipelineRoutes');
const dealRoutes = require('./src/routes/dealRoutes');
const mediaRoutes = require('./src/routes/mediaRoutes');
const emailRoutes = require('./src/routes/emailRoutes');
const automationRoutes = require('./src/routes/automationRoutes');
const monitoringRoutes = require('./src/routes/monitoring').default;
const { apiPerformance } = require('./src/monitoring/apiPerformance');
const { perfTimingMiddleware, startEventLoopMonitor, stopEventLoopMonitor } = require('./src/middleware/perfTiming');

const app = express();

// Performance Timing Instrumentation (active if PERF_DEBUG=1)
app.use(perfTimingMiddleware);

// Trust reverse proxy (Nginx & Cloudflare) for accurate client IP identification and rate-limiting
app.set('trust proxy', 1);

// Security & CORS Configuration
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
}));

// Bulletproof Universal CORS Configuration
const getAllowedOrigins = () => {
  const envOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  const defaultOrigins = [
    'https://app.sahyak.com',
    'https://crm.sahyak.com',
  ];

  if (process.env.NODE_ENV !== 'production') {
    defaultOrigins.push(
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5000',
      'http://127.0.0.1:5000'
    );
  }

  return Array.from(new Set([...defaultOrigins, ...envOrigins]));
};

const isOriginAllowed = (origin) => {
  if (!origin) return true; // Allow non-browser requests, webhooks (Meta, Google, Razorpay)
  const allowed = getAllowedOrigins();
  if (allowed.includes(origin)) return true;
  // Allow all sahyak.com subdomains (app.sahyak.com, crm.sahyak.com, etc.)
  if (/^https:\/\/([a-zA-Z0-9-]+\.)*sahyak\.com$/.test(origin)) return true;
  // Allow Cloudflare Pages deployments (e.g. const-crm-software.pages.dev and branch previews)
  if (/^https:\/\/([a-zA-Z0-9-]+\.)*pages\.dev$/.test(origin)) return true;
  // Allow Catalyst AppSail container URLs
  if (/^https:\/\/([a-zA-Z0-9-]+\.)*catalystappsail\.[a-z]+$/.test(origin)) return true;
  if (process.env.NODE_ENV !== 'production') {
    // In development, allow localhost with any port or local private LAN IPs
    if (/^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin)) {
      return true;
    }
  }
  return false;
};

// Custom CORS and Preflight handler
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    if (isOriginAllowed(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  } else {
    // Server-to-server or curl requests
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Workspace-Id, X-Request-Id');
  res.setHeader('Access-Control-Max-Age', '7200'); // 2 hours browser preflight cache
  
  if (req.method === 'OPTIONS') {
    if (origin && !isOriginAllowed(origin) && process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'CORS policy: Origin not allowed' });
    }
    return res.status(204).end();
  }
  next();
});

app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  maxAge: 7200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-Workspace-Id', 'X-Request-Id'],
}));

// Pre-flight handling
app.options('*', cors({
  origin: (origin, callback) => {
    callback(null, isOriginAllowed(origin));
  },
  credentials: true,
}));

// Body parsing with rawBody capture for webhook signature verification
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));

// Serve recordings & templates statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Dedicated Webhook Route
const { handleSubscriptionWebhook } = require('./src/controllers/subscriptionController');
app.post('/api/webhooks/razorpay', handleSubscriptionWebhook);

// Strict Private Cache-Control for authenticated workspace APIs (prevents CDN/shared proxy leaks)
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Rate limiting (Exempting admin and all external webhook endpoints)
app.use('/api', (req, res, next) => {
  if (
    req.path.startsWith('/admin') ||
    req.path.startsWith('/webhooks') ||
    req.path.includes('/webhook')
  ) {
    return next();
  }
  apiLimiter(req, res, next);
});

const { logger, requestLogger } = require('./src/monitoring/logging/logger');
const { errorTracker } = require('./src/monitoring/errorTracking/errorTracker');
const { ipBlocker } = require('./src/monitoring/security/ipBlockerMiddleware');
const { securityTracker } = require('./src/monitoring/security/securityTracker');

// IP Blocker & Abuse Defense Interceptor (Checks in-memory blacklist immediately)
app.use(ipBlocker.middleware);

// API Performance interceptor (runs on all /api routes)
app.use('/api', apiPerformance);

// Register public monitoring routes
app.use('/api/monitoring', monitoringRoutes);

// Request ID & Correlation middleware
app.use((req, res, next) => {
  const incomingId = req.headers['x-request-id'];
  req.requestId = (typeof incomingId === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(incomingId))
    ? incomingId
    : `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

// Structured Request logger with duration measurement
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    requestLogger(req, res, duration);
  });
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/recordings', recordingsRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/whatsapp/meta', metaWhatsAppRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api', shareRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/catalogue', catalogueRoutes); // Colleges, Degrees, Specializations & WhatsApp Prospectus
app.use('/api/workspace', workspaceRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/pipelines', pipelineRoutes);
app.use('/api/deals', dealRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/automations', automationRoutes);

// High-speed Single Bootstrap Route (Consolidates startup queries)
const { protect: protectAuth } = require('./src/middleware/auth');
const { resolveWorkspace: resolveWs } = require('./src/middleware/permission');
const { getBootstrapData } = require('./src/controllers/bootstrapController');
app.get('/api/bootstrap', protectAuth, resolveWs, getBootstrapData);

const superAdminRoutes = require('./src/superadmin/routes/superAdminRoutes');
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/superadmin', superAdminRoutes);
app.use('/super-admin', superAdminRoutes);
app.use('/superadmin', superAdminRoutes);

// Public Dynamic Plan Catalog
const planCatalogController = require('./src/superadmin/controllers/planCatalogController');
app.get('/api/plans', planCatalogController.getPublicPlans);
app.get('/plans', planCatalogController.getPublicPlans);

// Customer Checkout Coupon Validation
const couponValidationController = require('./src/controllers/couponValidationController');
app.post('/api/coupons/validate', couponValidationController.validateCouponForCheckout);
app.post('/api/payments/validate-coupon', couponValidationController.validateCouponForCheckout);

// Production-Grade Health Check Framework
const healthController = require('./src/monitoring/controllers/healthController').default || require('./src/monitoring/controllers/healthController');
app.get('/health', healthController.getHealth);
app.get('/health/live', healthController.getLive);
app.get('/health/ready', healthController.getReady);
app.get('/health/detailed', healthController.getDetailed);

app.get('/api/health', healthController.getHealth);
app.get('/api/health/live', healthController.getLive);
app.get('/api/health/ready', healthController.getReady);
app.get('/api/health/detailed', healthController.getDetailed);

// Preserved database health endpoints
const databaseController = require('./src/monitoring/controllers/databaseController').default || require('./src/monitoring/controllers/databaseController');
app.get('/health/database', databaseController.getDatabaseHealthEndpoint);
app.get('/api/health/database', databaseController.getDatabaseHealthEndpoint);

// Root service status endpoint
app.get('/', (req, res) => res.status(200).json({ status: 'OK', service: 'sahyak-backend', timestamp: new Date().toISOString() }));

// 404
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

// Error Tracking interceptor & Global error handler
app.use(errorTracker.expressMiddleware);
app.use((err, req, res, next) => {
  if (err.name === 'CastError') {
    return res.status(400).json({ message: `Invalid identifier format` });
  }
  if (process.env.NODE_ENV === 'production' && (!err.status || err.status >= 500)) {
    console.error(err.stack);
    return res.status(500).json({ message: 'Internal server error' });
  }
  console.error(err.stack);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

const { seedSuperAdmin } = require('./src/utils/seedSuperAdmin');
const { seedPlans } = require('./src/utils/seedPlans');

// Bind HTTP listener immediately so AppSail container health checks succeed without delay
const PORT = Number(process.env.X_ZOHO_CATALYST_LISTEN_PORT || (process.env.NODE_ENV === 'production' ? 9000 : (process.env.PORT || 5000)));
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Admission Consultants CRM Backend running on http://0.0.0.0:${PORT}`);
  console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}\n`);
  
  // Start event loop & memory monitor if PERF_DEBUG=1
  startEventLoopMonitor();
});

// Dual-port safety listener for AppSail reverse proxy (guarantees port 9000 is always reachable in production)
if (process.env.NODE_ENV === 'production' && PORT !== 9000) {
  try {
    app.listen(9000, '0.0.0.0', () => {
      console.log('🚀 Dual-port safety listener active on http://0.0.0.0:9000 for AppSail routing');
    });
  } catch (e) {
    console.warn('Could not bind dual-port 9000:', e.message);
  }
}

let agent, heartbeat, statusEvaluator, aggregator;
let databaseMonitorWorker, backupMonitorWorker, alertMonitorWorker;
let integrationMonitorWorker, usageMonitorWorker, apiKeySecurityWorker;
let deploymentMonitorWorker, healthScoreWorker;

// Asynchronously connect to database and initialize workers
connectDB().then(async () => {
  // Attach Mongoose slow query interceptor
  try {
    const slowQueryInterceptor = require('./src/monitoring/database/slowQueryInterceptor').default || require('./src/monitoring/database/slowQueryInterceptor');
    slowQueryInterceptor.attach(mongoose);
  } catch (sqErr) {
    console.warn('[SlowQueryInterceptor] Hook initialization notice:', sqErr.message);
  }

  // Run self-serve integrations migration (ensures per-integration keys and form keys)
  const { migrateIntegrations } = require('./src/migrations/migrateIntegrations');
  await migrateIntegrations().catch(err => console.error('[Integrations Migration Error]:', err.message));

  // Initialize security rules & IP blacklist cache
  await securityTracker.initDefaultRules().catch(err => console.error('[Security Rules Init Error]:', err.message));
  await ipBlocker.initSync().catch(err => console.error('[IP Blocker Sync Error]:', err.message));

  // Start cron jobs
  startFollowUpCron();

  const runBackgroundWorkers = process.env.RUN_BACKGROUND_WORKERS !== 'false';

  if (runBackgroundWorkers) {
    // Auto-restore saved WhatsApp sessions
    waSession.initSessions().catch(console.error);

    // Start campaign background worker
    campaignWorker.startWorker();
  } else {
    console.log('⚡ [crm-api] Process running in isolated HTTP API mode (workers delegated to crm-worker).');
  }

  // Start background monitoring agents and workers (except in testing or when delegated to dedicated worker)
  if (process.env.NODE_ENV !== 'test' && runBackgroundWorkers) {
    const MonitoringAgent = require('./src/monitoring/MonitoringAgent').default;
    const ServerHeartbeat = require('./src/monitoring/ServerHeartbeat').default;
    const StatusEvaluator = require('./src/monitoring/StatusEvaluator').default;
    const MetricsAggregator = require('./src/monitoring/MetricsAggregator').default;
    const dbWorkerMod = require('./src/monitoring/database/DatabaseMonitorWorker');
    databaseMonitorWorker = dbWorkerMod.databaseMonitorWorker || (dbWorkerMod.DatabaseMonitorWorker && dbWorkerMod.DatabaseMonitorWorker.getInstance()) || dbWorkerMod.default;

    const bkWorkerMod = require('./src/monitoring/backup/BackupMonitorWorker');
    backupMonitorWorker = bkWorkerMod.backupMonitorWorker || (bkWorkerMod.BackupMonitorWorker && bkWorkerMod.BackupMonitorWorker.getInstance()) || bkWorkerMod.default;

    const alWorkerMod = require('./src/monitoring/alerts/AlertMonitorWorker');
    alertMonitorWorker = alWorkerMod.alertMonitorWorker || (alWorkerMod.AlertMonitorWorker && alWorkerMod.AlertMonitorWorker.getInstance()) || alWorkerMod.default;

    const intWorkerMod = require('./src/monitoring/integrations/IntegrationMonitorWorker');
    integrationMonitorWorker = intWorkerMod.integrationMonitorWorker || (intWorkerMod.IntegrationMonitorWorker && intWorkerMod.IntegrationMonitorWorker.getInstance()) || intWorkerMod.default;

    const usWorkerMod = require('./src/monitoring/usage/UsageMonitorWorker');
    usageMonitorWorker = usWorkerMod.usageMonitorWorker || (usWorkerMod.UsageMonitorWorker && usWorkerMod.UsageMonitorWorker.getInstance()) || usWorkerMod.default;

    const akWorkerMod = require('./src/monitoring/apikeys/ApiKeySecurityWorker');
    apiKeySecurityWorker = akWorkerMod.apiKeySecurityWorker || (akWorkerMod.ApiKeySecurityWorker && akWorkerMod.ApiKeySecurityWorker.getInstance()) || akWorkerMod.default;

    const depWorkerMod = require('./src/monitoring/deployment/DeploymentMonitorWorker');
    deploymentMonitorWorker = depWorkerMod.deploymentMonitorWorker || (depWorkerMod.DeploymentMonitorWorker && depWorkerMod.DeploymentMonitorWorker.getInstance()) || depWorkerMod.default;

    const hlthWorkerMod = require('./src/monitoring/health/HealthScoreWorker');
    healthScoreWorker = hlthWorkerMod.healthScoreWorker || (hlthWorkerMod.HealthScoreWorker && hlthWorkerMod.HealthScoreWorker.getInstance()) || hlthWorkerMod.default;

    agent = new MonitoringAgent();
    heartbeat = new ServerHeartbeat();
    statusEvaluator = new StatusEvaluator();
    aggregator = new MetricsAggregator();

    agent.start();
    heartbeat.start();
    statusEvaluator.start();
    aggregator.start();
    if (databaseMonitorWorker && typeof databaseMonitorWorker.start === 'function') databaseMonitorWorker.start(30000);
    if (backupMonitorWorker && typeof backupMonitorWorker.start === 'function') backupMonitorWorker.start(60000);
    if (alertMonitorWorker && typeof alertMonitorWorker.start === 'function') alertMonitorWorker.start(30000);
    if (integrationMonitorWorker && typeof integrationMonitorWorker.start === 'function') integrationMonitorWorker.start(60000);
    if (usageMonitorWorker && typeof usageMonitorWorker.start === 'function') usageMonitorWorker.start(60000);
    if (apiKeySecurityWorker && typeof apiKeySecurityWorker.start === 'function') apiKeySecurityWorker.start(60000);
    if (deploymentMonitorWorker && typeof deploymentMonitorWorker.start === 'function') deploymentMonitorWorker.start(60000);
    if (healthScoreWorker && typeof healthScoreWorker.start === 'function') healthScoreWorker.start(60000);

    // Start Mode B Google Sheets background poller (every 5 minutes)
    const googleSheetsPollingService = require('./src/services/integrations/googleSheetsPollingService');
    const sheetsPollInterval = setInterval(() => {
      googleSheetsPollingService.sweepAll().catch((err) => {
        console.error('[Sheets Poller Interval Error]:', err.message);
      });
    }, 5 * 60 * 1000);
    if (sheetsPollInterval.unref) sheetsPollInterval.unref();
  }
}).catch(err => {
  console.error('Failed to initialize database:', err);
});

let isShuttingDown = false;
const gracefulShutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n🛑 [Shutdown] Received ${signal}. Starting graceful shutdown...`);

  const forceTimer = setTimeout(() => {
    console.error('⚠️ [Shutdown] Timeout reached. Forcefully exiting.');
    process.exit(1);
  }, 10000);
  forceTimer.unref();

  try {
    stopEventLoopMonitor();
    if (agent) agent.stop();
    if (heartbeat) heartbeat.stop();
    if (statusEvaluator) statusEvaluator.stop();
    if (aggregator) aggregator.stop();
    if (databaseMonitorWorker && typeof databaseMonitorWorker.stop === 'function') databaseMonitorWorker.stop();
    if (backupMonitorWorker && typeof backupMonitorWorker.stop === 'function') backupMonitorWorker.stop();
    if (alertMonitorWorker && typeof alertMonitorWorker.stop === 'function') alertMonitorWorker.stop();
    if (integrationMonitorWorker && typeof integrationMonitorWorker.stop === 'function') integrationMonitorWorker.stop();
    if (usageMonitorWorker && typeof usageMonitorWorker.stop === 'function') usageMonitorWorker.stop();
    if (apiKeySecurityWorker && typeof apiKeySecurityWorker.stop === 'function') apiKeySecurityWorker.stop();
    if (deploymentMonitorWorker && typeof deploymentMonitorWorker.stop === 'function') deploymentMonitorWorker.stop();
    if (healthScoreWorker && typeof healthScoreWorker.stop === 'function') healthScoreWorker.stop();

    if (campaignWorker && typeof campaignWorker.stopWorker === 'function') {
      campaignWorker.stopWorker();
    }

    if (server && typeof server.close === 'function') {
      await new Promise((resolve) => server.close(resolve));
      console.log('✅ [Shutdown] HTTP server closed.');
    }

    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close(false);
      console.log('✅ [Shutdown] MongoDB connection closed.');
    }

    if (global.__mongodInstance && typeof global.__mongodInstance.stop === 'function') {
      try {
        await global.__mongodInstance.stop();
        console.log('✅ [Shutdown] Embedded MongoDB instance stopped.');
      } catch {}
    }

    console.log('✅ [Shutdown] Cleanup completed cleanly.');
    process.exit(0);
  } catch (err) {
    console.error('❌ [Shutdown] Error during shutdown:', err.message);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.once('SIGUSR2', async () => {
  await gracefulShutdown('SIGUSR2');
  process.kill(process.pid, 'SIGUSR2');
});
