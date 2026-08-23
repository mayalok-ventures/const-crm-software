"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.securityController = void 0;
const SecurityEvent_1 = require("../models/SecurityEvent");
const SecurityIncident_1 = require("../models/SecurityIncident");
const BlockedIP_1 = require("../models/BlockedIP");
const SecurityRule_1 = require("../models/SecurityRule");
const riskScoreEngine_1 = require("../security/riskScoreEngine");
const ipBlockerMiddleware_1 = require("../security/ipBlockerMiddleware");
const securityTracker_1 = require("../security/securityTracker");
exports.securityController = {
    /**
     * GET /api/admin/security/stats
     * Returns Overall Security Score & Category Breakdown
     */
    getSecurityStats: async (req, res) => {
        try {
            const now = new Date();
            const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const [totalEvents, loginSuccesses, loginFailures, tokenInvalids, tokenExpireds, otpAbuses, permissionDenieds, rateLimits, suspiciousActivities, openIncidents, criticalIncidents, blockedIpsCount,] = await Promise.all([
                SecurityEvent_1.SecurityEvent.countDocuments({ timestamp: { $gte: past24h } }),
                SecurityEvent_1.SecurityEvent.countDocuments({ type: 'LOGIN_SUCCESS', timestamp: { $gte: past24h } }),
                SecurityEvent_1.SecurityEvent.countDocuments({ type: 'LOGIN_FAILED', timestamp: { $gte: past24h } }),
                SecurityEvent_1.SecurityEvent.countDocuments({ type: 'TOKEN_INVALID', timestamp: { $gte: past24h } }),
                SecurityEvent_1.SecurityEvent.countDocuments({ type: 'TOKEN_EXPIRED', timestamp: { $gte: past24h } }),
                SecurityEvent_1.SecurityEvent.countDocuments({ type: 'OTP_ABUSE', timestamp: { $gte: past24h } }),
                SecurityEvent_1.SecurityEvent.countDocuments({ type: 'PERMISSION_DENIED', timestamp: { $gte: past24h } }),
                SecurityEvent_1.SecurityEvent.countDocuments({ type: 'RATE_LIMIT', timestamp: { $gte: past24h } }),
                SecurityEvent_1.SecurityEvent.countDocuments({ type: 'SUSPICIOUS_ACTIVITY', timestamp: { $gte: past24h } }),
                SecurityIncident_1.SecurityIncident.countDocuments({ status: 'OPEN' }),
                SecurityIncident_1.SecurityIncident.countDocuments({ severity: 'CRITICAL', status: { $ne: 'RESOLVED' } }),
                BlockedIP_1.BlockedIP.countDocuments({
                    isActive: true,
                    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
                }),
            ]);
            const scorecard = riskScoreEngine_1.RiskScoreEngine.calculateSecurityScorecard({
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
        }
        catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },
    /**
     * GET /api/admin/security/events
     * Returns filterable security event stream
     */
    getSecurityEvents: async (req, res) => {
        try {
            const { type, severity, search, limit = '50', page = '1' } = req.query;
            const query = {};
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
                SecurityEvent_1.SecurityEvent.find(query)
                    .sort({ timestamp: -1 })
                    .skip(skipNum)
                    .limit(limitNum)
                    .lean(),
                SecurityEvent_1.SecurityEvent.countDocuments(query),
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
        }
        catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },
    /**
     * GET /api/admin/security/incidents
     * Returns security incidents
     */
    getSecurityIncidents: async (req, res) => {
        try {
            const { status, severity, limit = '50' } = req.query;
            const query = {};
            if (status && status !== 'ALL') {
                query.status = status;
            }
            if (severity && severity !== 'ALL') {
                query.severity = severity;
            }
            const incidents = await SecurityIncident_1.SecurityIncident.find(query)
                .sort({ lastSeen: -1 })
                .limit(parseInt(String(limit), 10) || 50)
                .lean();
            res.json({
                success: true,
                incidents,
            });
        }
        catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },
    /**
     * GET /api/admin/security/incidents/:id
     */
    getSecurityIncidentDetails: async (req, res) => {
        try {
            const { id } = req.params;
            const incident = await SecurityIncident_1.SecurityIncident.findOne({ incidentId: id }).lean();
            if (!incident) {
                res.status(404).json({ success: false, message: 'Incident not found' });
                return;
            }
            // Fetch related security events
            const queryOr = [];
            if (incident.targetIp)
                queryOr.push({ ip: incident.targetIp });
            if (incident.targetUserId)
                queryOr.push({ userId: incident.targetUserId });
            const relatedEvents = await SecurityEvent_1.SecurityEvent.find(queryOr.length > 0
                ? {
                    $or: queryOr,
                    timestamp: { $gte: new Date(new Date(incident.firstSeen).getTime() - 3600000) },
                }
                : { timestamp: { $gte: new Date(new Date(incident.firstSeen).getTime() - 3600000) } })
                .sort({ timestamp: -1 })
                .limit(20)
                .lean();
            res.json({
                success: true,
                incident,
                relatedEvents,
            });
        }
        catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },
    /**
     * PATCH /api/admin/security/incidents/:id/status
     */
    updateIncidentStatus: async (req, res) => {
        try {
            const { id } = req.params;
            const { status } = req.body;
            if (!['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'IGNORED'].includes(status)) {
                res.status(400).json({ success: false, message: 'Invalid status' });
                return;
            }
            const updateData = { status };
            if (status === 'RESOLVED') {
                updateData.resolvedBy = req.user?.name || req.user?.email || 'Admin';
                updateData.resolvedAt = new Date();
            }
            const incident = await SecurityIncident_1.SecurityIncident.findOneAndUpdate({ incidentId: id }, { $set: updateData }, { new: true });
            if (!incident) {
                res.status(404).json({ success: false, message: 'Incident not found' });
                return;
            }
            res.json({ success: true, incident });
        }
        catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },
    /**
     * POST /api/admin/security/incidents/:id/notes
     */
    addIncidentNote: async (req, res) => {
        try {
            const { id } = req.params;
            const { note } = req.body;
            if (!note || !String(note).trim()) {
                res.status(400).json({ success: false, message: 'Note is required' });
                return;
            }
            const author = req.user?.name || req.user?.email || 'Admin';
            const incident = await SecurityIncident_1.SecurityIncident.findOneAndUpdate({ incidentId: id }, {
                $push: {
                    adminNotes: {
                        author,
                        note: String(note).trim(),
                        createdAt: new Date(),
                    },
                },
            }, { new: true });
            if (!incident) {
                res.status(404).json({ success: false, message: 'Incident not found' });
                return;
            }
            res.json({ success: true, notes: incident.adminNotes });
        }
        catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },
    /**
     * GET /api/admin/security/blocked-ips
     */
    getBlockedIps: async (req, res) => {
        try {
            const blockedIps = await BlockedIP_1.BlockedIP.find({
                isActive: true,
                $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
            })
                .sort({ createdAt: -1 })
                .lean();
            res.json({
                success: true,
                blockedIps,
            });
        }
        catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },
    /**
     * POST /api/admin/security/blocked-ips
     */
    blockIp: async (req, res) => {
        try {
            const { ip, reason, durationMinutes } = req.body;
            if (!ip || !reason) {
                res.status(400).json({ success: false, message: 'IP address and reason are required' });
                return;
            }
            const adminUser = {
                id: req.user?._id?.toString() || 'admin',
                email: req.user?.email || 'admin@coresetu.com',
            };
            await ipBlockerMiddleware_1.ipBlocker.blockIp(String(ip).trim(), String(reason).trim(), 'ADMIN', durationMinutes ? parseInt(String(durationMinutes), 10) : null, adminUser);
            res.json({
                success: true,
                message: `IP ${ip} has been blocked successfully.`,
            });
        }
        catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },
    /**
     * DELETE /api/admin/security/blocked-ips/:ip
     */
    unblockIp: async (req, res) => {
        try {
            const { ip } = req.params;
            if (!ip) {
                res.status(400).json({ success: false, message: 'IP parameter is required' });
                return;
            }
            const success = await ipBlockerMiddleware_1.ipBlocker.unblockIp(decodeURIComponent(ip).trim());
            res.json({
                success: true,
                message: `IP ${ip} unblocked successfully.`,
            });
        }
        catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },
    /**
     * GET /api/admin/security/rules
     */
    getSecurityRules: async (req, res) => {
        try {
            const rules = await SecurityRule_1.SecurityRule.find().sort({ severity: 1, name: 1 }).lean();
            res.json({
                success: true,
                rules,
            });
        }
        catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },
    /**
     * PATCH /api/admin/security/rules/:ruleId
     */
    updateSecurityRule: async (req, res) => {
        try {
            const { ruleId } = req.params;
            const { threshold, windowSeconds, isActive } = req.body;
            const updateData = {};
            if (threshold !== undefined)
                updateData.threshold = Math.max(1, parseInt(String(threshold), 10));
            if (windowSeconds !== undefined)
                updateData.windowSeconds = Math.max(10, parseInt(String(windowSeconds), 10));
            if (isActive !== undefined)
                updateData.isActive = Boolean(isActive);
            const rule = await SecurityRule_1.SecurityRule.findOneAndUpdate({ ruleId }, { $set: updateData }, { new: true });
            if (!rule) {
                res.status(404).json({ success: false, message: 'Rule not found' });
                return;
            }
            // Reload in security tracker
            await securityTracker_1.securityTracker.loadRules();
            res.json({ success: true, rule });
        }
        catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },
};
