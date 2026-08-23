require('dotenv').config();
process.env.JWT_SECRET = process.env.JWT_SECRET || 'crm_jwt_secret_dev_key_2026';
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
const campaignRoutes = require('./src/routes/campaigns');
const paymentRoutes = require('./src/routes/payments');
const companyRoutes = require('./src/routes/company');
const projectsRoutes = require('./src/routes/projects');
const notificationsRoutes = require('./src/routes/notifications');
const subscriptionRoutes = require('./src/routes/subscriptionRoutes');
const waSession = require('./src/services/waSession');
const campaignWorker = require('./src/services/campaignWorker');
const integrationRoutes = require('./src/routes/integrationRoutes');
const catalogueRoutes = require('./src/routes/catalogue');
const agencyRoutes = require('./src/routes/agency');
const monitoringRoutes = require('./src/routes/monitoring').default;
const { apiPerformance } = require('./src/monitoring/apiPerformance');

const app = express();

// Trust reverse proxy (Nginx & Cloudflare) for accurate client IP identification and rate-limiting
app.set('trust proxy', 1);

// Security & CORS Configuration
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
}));

// Pre-flight handling
app.options('*', cors());

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
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api', shareRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/catalogue', catalogueRoutes);
app.use('/api/agency', agencyRoutes);

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

// 404
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

// Error Tracking interceptor & Global error handler
app.use(errorTracker.expressMiddleware);
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

const { seedSuperAdmin } = require('./src/utils/seedSuperAdmin');
const { seedPlans } = require('./src/utils/seedPlans');
const { runAgencyRolesMigration } = require('./src/utils/seedAgencyRoles');

// Start server after DB is ready
connectDB().then(async () => {
  // Attach Mongoose slow query interceptor
  try {
    const slowQueryInterceptor = require('./src/monitoring/database/slowQueryInterceptor').default || require('./src/monitoring/database/slowQueryInterceptor');
    slowQueryInterceptor.attach(mongoose);
  } catch (sqErr) {
    console.warn('[SlowQueryInterceptor] Hook initialization notice:', sqErr.message);
  }

  // Seed superadmin if not exists
  await seedSuperAdmin();

  // Seed standard subscription plans if not exists
  await seedPlans();

  // Run agency roles & permissions migration
  await runAgencyRolesMigration().catch(err => console.error('[Migration Error]:', err.message));

  // Initialize security rules & IP blacklist cache
  await securityTracker.initDefaultRules().catch(err => console.error('[Security Rules Init Error]:', err.message));
  await ipBlocker.initSync().catch(err => console.error('[IP Blocker Sync Error]:', err.message));

  // Start cron jobs
  startFollowUpCron();

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Real Estate CRM Backend running on http://localhost:${PORT}`);
    console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}\n`);
    
    // Auto-restore saved WhatsApp sessions
    waSession.initSessions().catch(console.error);

    // Start campaign background worker
    campaignWorker.startWorker();

    // Start background monitoring agents and workers (except in testing)
    if (process.env.NODE_ENV !== 'test') {
      const MonitoringAgent = require('./src/monitoring/MonitoringAgent').default;
      const ServerHeartbeat = require('./src/monitoring/ServerHeartbeat').default;
      const StatusEvaluator = require('./src/monitoring/StatusEvaluator').default;
      const MetricsAggregator = require('./src/monitoring/MetricsAggregator').default;
      const databaseMonitorWorker = require('./src/monitoring/database/DatabaseMonitorWorker').databaseMonitorWorker || require('./src/monitoring/database/DatabaseMonitorWorker').default || require('./src/monitoring/database/DatabaseMonitorWorker');
      const backupMonitorWorker = require('./src/monitoring/backup/BackupMonitorWorker').backupMonitorWorker || require('./src/monitoring/backup/BackupMonitorWorker').default || require('./src/monitoring/backup/BackupMonitorWorker');
      const alertMonitorWorker = require('./src/monitoring/alerts/AlertMonitorWorker').alertMonitorWorker || require('./src/monitoring/alerts/AlertMonitorWorker').default || require('./src/monitoring/alerts/AlertMonitorWorker');
      const integrationMonitorWorker = require('./src/monitoring/integrations/IntegrationMonitorWorker').integrationMonitorWorker || require('./src/monitoring/integrations/IntegrationMonitorWorker').default || require('./src/monitoring/integrations/IntegrationMonitorWorker');

      const agent = new MonitoringAgent();
      const heartbeat = new ServerHeartbeat();
      const statusEvaluator = new StatusEvaluator();
      const aggregator = new MetricsAggregator();

      agent.start();
      heartbeat.start();
      statusEvaluator.start();
      aggregator.start();
      databaseMonitorWorker.start(30000);
      backupMonitorWorker.start(60000);
      alertMonitorWorker.start(30000);
      integrationMonitorWorker.start(60000);

      const shutdownWorkers = () => {
        console.log('Stopping background monitoring workers...');
        agent.stop();
        heartbeat.stop();
        statusEvaluator.stop();
        aggregator.stop();
        databaseMonitorWorker.stop();
        backupMonitorWorker.stop();
        alertMonitorWorker.stop();
        integrationMonitorWorker.stop();
      };
      process.on('SIGTERM', shutdownWorkers);
      process.on('SIGINT', shutdownWorkers);
    }
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
});
