require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

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

const app = express();

// Trust reverse proxy (Nginx & Cloudflare) for accurate client IP identification and rate-limiting
app.set('trust proxy', 1);

// Security & CORS Configuration
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
}));

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5000',
  'https://crm.coresetu.com',
  'http://crm.coresetu.com',
  'http://13.51.219.53',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    
    // Check if origin is explicitly allowed or matches Cloudflare Pages/custom domains
    const isAllowed =
      allowedOrigins.includes(origin) ||
      origin.endsWith('.pages.dev') ||
      origin.endsWith('.coresetu.com') ||
      origin.includes('13.51.219.53') ||
      process.env.NODE_ENV !== 'production';

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error(`CORS Error: Origin ${origin} is not allowed`));
    }
  },
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

// Request logger
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.originalUrl}`);
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

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// 404
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

const { seedSuperAdmin } = require('./src/utils/seedSuperAdmin');
const { seedPlans } = require('./src/utils/seedPlans');
const { runAgencyRolesMigration } = require('./src/utils/seedAgencyRoles');

// Start server after DB is ready
connectDB().then(async () => {
  // Seed superadmin if not exists
  await seedSuperAdmin();

  // Seed standard subscription plans if not exists
  await seedPlans();

  // Run agency roles & permissions migration
  await runAgencyRolesMigration().catch(err => console.error('[Migration Error]:', err.message));

  // Start cron jobs
  startFollowUpCron();

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`\n🚀 Real Estate CRM Backend running on http://localhost:${PORT}`);
    console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}\n`);
    
    // Auto-restore saved WhatsApp sessions
    waSession.initSessions().catch(console.error);

    // Start campaign background worker
    campaignWorker.startWorker();
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
});
