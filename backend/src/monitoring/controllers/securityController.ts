import { Request, Response } from 'express';
import { SecurityEvent, SecurityEventType, SecuritySeverity } from '../models/SecurityEvent';
import { SecurityIncident, IncidentStatus } from '../models/SecurityIncident';
import { BlockedIP } from '../models/BlockedIP';
import { SecurityRule } from '../models/SecurityRule';
import { RiskScoreEngine } from '../security/riskScoreEngine';
import { ipBlocker } from '../security/ipBlockerMiddleware';
import { securityTracker } from '../security/securityTracker';

export const securityController = {
  /**
   * GET /api/admin/security/stats
   * Returns Overall Security Score & Category Breakdown
   */
  getSecurityStats: async (req: Request, res: Response): Promise<void> => {
    try {
      const now = new Date();
      const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const [
        totalEvents,
        loginSuccesses,
        loginFailures,
        tokenInvalids,
        tokenExpireds,
        otpAbuses,
        permissionDenieds,
        rateLimits,
        suspiciousActivities,
        openIncidents,
        criticalIncidents,
        blockedIpsCount,
      ] = await Promise.all([
        SecurityEvent.countDocuments({ timestamp: { $gte: past24h } }),
        SecurityEvent.countDocuments({ type: 'LOGIN_SUCCESS', timestamp: { $gte: past24h } }),
        SecurityEvent.countDocuments({ type: 'LOGIN_FAILED', timestamp: { $gte: past24h } }),
        SecurityEvent.countDocuments({ type: 'TOKEN_INVALID', timestamp: { $gte: past24h } }),
        SecurityEvent.countDocuments({ type: 'TOKEN_EXPIRED', timestamp: { $gte: past24h } }),
        SecurityEvent.countDocuments({ type: 'OTP_ABUSE', timestamp: { $gte: past24h } }),
        SecurityEvent.countDocuments({ type: 'PERMISSION_DENIED', timestamp: { $gte: past24h } }),
        SecurityEvent.countDocuments({ type: 'RATE_LIMIT', timestamp: { $gte: past24h } }),
        SecurityEvent.countDocuments({ type: 'SUSPICIOUS_ACTIVITY', timestamp: { $gte: past24h } }),
        SecurityIncident.countDocuments({ status: 'OPEN' }),
        SecurityIncident.countDocuments({ severity: 'CRITICAL', status: { $ne: 'RESOLVED' } }),
        BlockedIP.countDocuments({
          isActive: true,
          $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
        }),
      ]);

      const scorecard = RiskScoreEngine.calculateSecurityScorecard({
        totalEvents,
        loginSuccesses,
        loginFailures,
        tokenInvalids,
        tokenExpireds,
        otpAbuses,
        permissionDenieds,
        rateLimits,
        suspiciousActivities,
        openIncidents,
        criticalIncidents,
        blockedIpsCount,
      });

      res.json({
        success: true,
        stats: scorecard,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * GET /api/admin/security/events
   * Returns filterable security event stream
   */
  getSecurityEvents: async (req: Request, res: Response): Promise<void> => {
    try {
      const { type, severity, search, limit = '50', page = '1' } = req.query;
      const query: any = {};

      if (type && type !== 'ALL') {
        query.type = type;
      }
      if (severity && severity !== 'ALL') {
        query.severity = severity;
      }
      if (search) {
        query.$or = [
          { ip: { $regex: String(search), $options: 'i' } },
          { userEmail: { $regex: String(search), $options: 'i' } },
          { endpoint: { $regex: String(search), $options: 'i' } },
        ];
      }

      const limitNum = Math.min(200, parseInt(String(limit), 10) || 50);
      const skipNum = (Math.max(1, parseInt(String(page), 10) || 1) - 1) * limitNum;

      const [events, total] = await Promise.all([
        SecurityEvent.find(query)
          .sort({ timestamp: -1 })
          .skip(skipNum)
          .limit(limitNum)
          .lean(),
        SecurityEvent.countDocuments(query),
      ]);

      res.json({
        success: true,
        events,
        pagination: {
          total,
          page: parseInt(String(page), 10) || 1,
          pages: Math.ceil(total / limitNum),
          limit: limitNum,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * GET /api/admin/security/incidents
   * Returns security incidents
   */
  getSecurityIncidents: async (req: Request, res: Response): Promise<void> => {
    try {
      const { status, severity, limit = '50' } = req.query;
      const query: any = {};

      if (status && status !== 'ALL') {
        query.status = status;
      }
      if (severity && severity !== 'ALL') {
        query.severity = severity;
      }

      const incidents = await SecurityIncident.find(query)
        .sort({ lastSeen: -1 })
        .limit(parseInt(String(limit), 10) || 50)
        .lean();

      res.json({
        success: true,
        incidents,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * GET /api/admin/security/incidents/:id
   */
  getSecurityIncidentDetails: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const incident: any = await SecurityIncident.findOne({ incidentId: id }).lean();

      if (!incident) {
        res.status(404).json({ success: false, message: 'Incident not found' });
        return;
      }

      // Fetch related security events
      const queryOr: any[] = [];
      if (incident.targetIp) queryOr.push({ ip: incident.targetIp });
      if (incident.targetUserId) queryOr.push({ userId: incident.targetUserId });

      const relatedEvents = await SecurityEvent.find(
        queryOr.length > 0
          ? {
              $or: queryOr,
              timestamp: { $gte: new Date(new Date(incident.firstSeen).getTime() - 3600000) },
            }
          : { timestamp: { $gte: new Date(new Date(incident.firstSeen).getTime() - 3600000) } }
      )
        .sort({ timestamp: -1 })
        .limit(20)
        .lean();

      res.json({
        success: true,
        incident,
        relatedEvents,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * PATCH /api/admin/security/incidents/:id/status
   */
  updateIncidentStatus: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'IGNORED'].includes(status)) {
        res.status(400).json({ success: false, message: 'Invalid status' });
        return;
      }

      const updateData: any = { status };
      if (status === 'RESOLVED') {
        updateData.resolvedBy = (req as any).user?.name || (req as any).user?.email || 'Admin';
        updateData.resolvedAt = new Date();
      }

      const incident = await SecurityIncident.findOneAndUpdate(
        { incidentId: id },
        { $set: updateData },
        { new: true }
      );

      if (!incident) {
        res.status(404).json({ success: false, message: 'Incident not found' });
        return;
      }

      res.json({ success: true, incident });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * POST /api/admin/security/incidents/:id/notes
   */
  addIncidentNote: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { note } = req.body;

      if (!note || !String(note).trim()) {
        res.status(400).json({ success: false, message: 'Note is required' });
        return;
      }

      const author = (req as any).user?.name || (req as any).user?.email || 'Admin';

      const incident = await SecurityIncident.findOneAndUpdate(
        { incidentId: id },
        {
          $push: {
            adminNotes: {
              author,
              note: String(note).trim(),
              createdAt: new Date(),
            },
          },
        },
        { new: true }
      );

      if (!incident) {
        res.status(404).json({ success: false, message: 'Incident not found' });
        return;
      }

      res.json({ success: true, notes: incident.adminNotes });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * GET /api/admin/security/blocked-ips
   */
  getBlockedIps: async (req: Request, res: Response): Promise<void> => {
    try {
      const blockedIps = await BlockedIP.find({
        isActive: true,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
      })
        .sort({ createdAt: -1 })
        .lean();

      res.json({
        success: true,
        blockedIps,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * POST /api/admin/security/blocked-ips
   */
  blockIp: async (req: Request, res: Response): Promise<void> => {
    try {
      const { ip, reason, durationMinutes } = req.body;

      if (!ip || !reason) {
        res.status(400).json({ success: false, message: 'IP address and reason are required' });
        return;
      }

      const adminUser = {
        id: (req as any).user?._id?.toString() || 'admin',
        email: (req as any).user?.email || 'admin@coresetu.com',
      };

      await ipBlocker.blockIp(
        String(ip).trim(),
        String(reason).trim(),
        'ADMIN',
        durationMinutes ? parseInt(String(durationMinutes), 10) : null,
        adminUser
      );

      res.json({
        success: true,
        message: `IP ${ip} has been blocked successfully.`,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * DELETE /api/admin/security/blocked-ips/:ip
   */
  unblockIp: async (req: Request, res: Response): Promise<void> => {
    try {
      const { ip } = req.params;

      if (!ip) {
        res.status(400).json({ success: false, message: 'IP parameter is required' });
        return;
      }

      const success = await ipBlocker.unblockIp(decodeURIComponent(ip).trim());

      res.json({
        success: true,
        message: `IP ${ip} unblocked successfully.`,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * GET /api/admin/security/rules
   */
  getSecurityRules: async (req: Request, res: Response): Promise<void> => {
    try {
      const rules = await SecurityRule.find().sort({ severity: 1, name: 1 }).lean();
      res.json({
        success: true,
        rules,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * PATCH /api/admin/security/rules/:ruleId
   */
  updateSecurityRule: async (req: Request, res: Response): Promise<void> => {
    try {
      const { ruleId } = req.params;
      const { threshold, windowSeconds, isActive } = req.body;

      const updateData: any = {};
      if (threshold !== undefined) updateData.threshold = Math.max(1, parseInt(String(threshold), 10));
      if (windowSeconds !== undefined) updateData.windowSeconds = Math.max(10, parseInt(String(windowSeconds), 10));
      if (isActive !== undefined) updateData.isActive = Boolean(isActive);

      const rule = await SecurityRule.findOneAndUpdate(
        { ruleId },
        { $set: updateData },
        { new: true }
      );

      if (!rule) {
        res.status(404).json({ success: false, message: 'Rule not found' });
        return;
      }

      // Reload in security tracker
      await securityTracker.loadRules();

      res.json({ success: true, rule });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
};
