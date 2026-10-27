const Fastify = require('fastify');
const cors = require('@fastify/cors');
const helmet = require('@fastify/helmet');
const rateLimit = require('@fastify/rate-limit');
const jwt = require('@fastify/jwt');
const mongoose = require('mongoose');

const Lead = require('../models/Lead');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const Pipeline = require('../models/Pipeline');
const { paginateWithCursor } = require('../utils/cursorPagination');
const { cacheService } = require('../config/redis');
const { signDirectUpload } = require('../controllers/mediaController');
const { leadQuerySchema, leadCreateSchema, leadUpdateSchema } = require('./schemas/leadSchemas');
const { loginSchema, registerSchema } = require('./schemas/authSchemas');

function buildFastifyApp(opts = {}) {
  const app = Fastify({
    logger: opts.logger !== undefined ? opts.logger : (process.env.NODE_ENV === 'development' ? { level: 'warn' } : false),
    trustProxy: true,
  });

  // 1. Core Security Plugins
  app.register(helmet, {
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  app.register(cors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  });

  app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
  });

  // 2. JWT Authentication Plugin
  app.register(jwt, {
    secret: process.env.JWT_SECRET || 'fastify-super-secret-jwt-key-2026',
  });

  // Authentication Decorator Hook
  app.decorate('authenticate', async function (request, reply) {
    try {
      await request.jwtVerify();
      const decoded = request.user;
      
      // Load user & active workspace
      const user = await User.findById(decoded.id || decoded.userId || decoded._id).select('-password').lean();
      if (!user) {
        return reply.status(401).send({ success: false, message: 'User not found or token expired' });
      }
      request.authUser = user;

      // Extract workspace from header or user defaults
      const wsHeader = request.headers['x-workspace-id'];
      request.workspaceId = wsHeader || user.workspaceId || user.companyId || user._id;
    } catch (err) {
      reply.status(401).send({ success: false, message: 'Authentication required' });
    }
  });

  // Health checks
  app.get('/health', async () => {
    return {
      status: 'UP',
      engine: 'Fastify',
      dbState: mongoose.connection.readyState === 1 ? 'CONNECTED' : 'DISCONNECTED',
      redis: cacheService.isAvailable() ? 'ONLINE' : 'FALLBACK_MEMORY',
      timestamp: Date.now(),
    };
  });

  // API Routes Plugin Prefix: /api
  app.register(async function apiRoutes(api) {

    // ─────────────────────────────────────────────────────────────
    // 1. BOOTSTRAP (High-Speed Single Aggregation Query)
    // ─────────────────────────────────────────────────────────────
    api.get('/bootstrap', { preHandler: [app.authenticate] }, async (req, reply) => {
      const user = req.authUser;
      const workspaceId = req.workspaceId;
      const cacheKey = `bootstrap:${user._id}:${workspaceId}`;

      // Redis cache check
      const cached = await cacheService.getJson(cacheKey);
      if (cached) {
        return reply.send({ ...cached, cached: true, timestamp: Date.now() });
      }

      const now = new Date();
      const [workspace, dueFollowUps, leadsCount, defaultPipeline] = await Promise.all([
        Workspace.findById(workspaceId).lean().catch(() => null),
        Lead.countDocuments({
          workspaceId,
          followUpDate: { $lte: now, $ne: null },
          status: { $nin: ['Closed', 'Lost', 'closed', 'lost'] },
        }),
        Lead.countDocuments({ workspaceId }),
        Pipeline.findOne({ workspaceId, isDefault: true }).lean().catch(() => null),
      ]);

      const payload = {
        success: true,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          industryType: user.industryType,
        },
        workspace: workspace || { id: workspaceId, name: 'Main Workspace' },
        counts: {
          dueFollowUps,
          totalLeads: leadsCount,
        },
        pipeline: defaultPipeline,
      };

      await cacheService.setJson(cacheKey, payload, 45); // 45s TTL
      return reply.send(payload);
    });

    // ─────────────────────────────────────────────────────────────
    // 2. LEADS (Cursor-based Pagination + 100% Lean Compound Indexing)
    // ─────────────────────────────────────────────────────────────
    api.get('/leads', { preHandler: [app.authenticate] }, async (req, reply) => {
      const queryValidation = leadQuerySchema.safeParse(req.query);
      if (!queryValidation.success) {
        return reply.status(400).send({ success: false, errors: queryValidation.error.format() });
      }

      const { cursor, limit, status, stage, temperature, search, assignedTo } = queryValidation.data;
      const filter = { workspaceId: req.workspaceId, deletedAt: null };

      if (status) filter.status = status;
      if (stage) filter.pipelineStage = stage;
      if (temperature) filter.temperature = temperature;
      if (assignedTo) filter.assignedTo = assignedTo;

      if (search && search.trim()) {
        const clean = search.trim();
        filter.$or = [
          { nameLower: { $regex: '^' + clean.toLowerCase() } },
          { phoneDigits: { $regex: clean.replace(/\D/g, '') } },
        ];
      }

      const paginated = await paginateWithCursor(Lead, {
        query: filter,
        cursor,
        limit,
        sortField: '_id',
        sortOrder: -1,
        projection: 'name phone email status pipelineStage temperature score shortlistedColleges followUpDate createdAt version',
      });

      return reply.send({
        success: true,
        leads: paginated.items,
        nextCursor: paginated.nextCursor,
        hasMore: paginated.hasMore,
      });
    });

    api.get('/leads/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
      const lead = await Lead.findOne({ _id: req.params.id, workspaceId: req.workspaceId }).lean();
      if (!lead) {
        return reply.status(404).send({ success: false, message: 'Lead not found' });
      }
      return reply.send({ success: true, lead });
    });

    api.post('/leads', { preHandler: [app.authenticate] }, async (req, reply) => {
      const bodyValidation = leadCreateSchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return reply.status(400).send({ success: false, errors: bodyValidation.error.format() });
      }

      const leadData = {
        ...bodyValidation.data,
        workspaceId: req.workspaceId,
        userId: req.authUser._id,
        createdAt: new Date(),
      };

      const newLead = await Lead.create(leadData);
      // Invalidate dashboard counts in Redis
      await cacheService.delPattern(`bootstrap:*:${req.workspaceId}`);

      return reply.status(201).send({ success: true, lead: newLead });
    });

    api.put('/leads/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
      const bodyValidation = leadUpdateSchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return reply.status(400).send({ success: false, errors: bodyValidation.error.format() });
      }

      const updateData = { ...bodyValidation.data, updatedAt: new Date() };
      
      // Optimistic Locking Check
      if (typeof updateData.version === 'number') {
        const existing = await Lead.findById(req.params.id).select('version').lean();
        if (existing && existing.version !== updateData.version) {
          return reply.status(409).send({
            success: false,
            message: 'Conflict: This lead was modified by another user. Please refresh.',
            currentVersion: existing.version,
          });
        }
        updateData.version = (updateData.version || 1) + 1;
      }

      const updated = await Lead.findOneAndUpdate(
        { _id: req.params.id, workspaceId: req.workspaceId },
        { $set: updateData },
        { new: true, runValidators: true }
      ).lean();

      if (!updated) {
        return reply.status(404).send({ success: false, message: 'Lead not found or permission denied' });
      }

      return reply.send({ success: true, lead: updated });
    });

    // ─────────────────────────────────────────────────────────────
    // 3. MEDIA (Direct Client-to-Cloudinary Signed Uploads)
    // ─────────────────────────────────────────────────────────────
    api.post('/media/sign-upload', { preHandler: [app.authenticate] }, async (req, reply) => {
      // Proxy to media controller
      return signDirectUpload(req, reply);
    });

  }, { prefix: '/api' });

  return app;
}

module.exports = {
  buildFastifyApp,
};
