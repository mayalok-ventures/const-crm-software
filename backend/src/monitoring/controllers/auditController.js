"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditController = void 0;
const AuditLog_1 = require("../models/AuditLog");
const auditArchiver_1 = require("../audit/auditArchiver");
exports.auditController = {
    /**
     * GET /api/admin/audit/timeline
     * Returns filterable, paginated audit log timeline
     */
    getAuditTimeline: async (req, res) => {
        try {
            const { action, resourceType, actorEmail, organizationId, from, to, search, limit = '50', page = '1', } = req.query;
            const query = {};
            if (action && action !== 'ALL') {
                query.action = action;
            }
            if (resourceType && resourceType !== 'ALL') {
                query.resourceType = resourceType;
            }
            if (actorEmail) {
                query.actorEmail = { $regex: String(actorEmail), $options: 'i' };
            }
            if (organizationId) {
                query.organizationId = organizationId;
            }
            // Date Range Filter
            if (from || to) {
                query.timestamp = {};
                if (from)
                    query.timestamp.$gte = new Date(String(from));
                if (to)
                    query.timestamp.$lte = new Date(String(to));
            }
            // Keyword Search
            if (search) {
                const s = String(search).trim();
                query.$or = [
                    { actorEmail: { $regex: s, $options: 'i' } },
                    { actorName: { $regex: s, $options: 'i' } },
                    { resourceName: { $regex: s, $options: 'i' } },
                    { resourceId: { $regex: s, $options: 'i' } },
                    { requestId: { $regex: s, $options: 'i' } },
                    { ip: { $regex: s, $options: 'i' } },
                ];
            }
            const limitNum = Math.min(200, parseInt(String(limit), 10) || 50);
            const skipNum = (Math.max(1, parseInt(String(page), 10) || 1) - 1) * limitNum;
            const [logs, total] = await Promise.all([
                AuditLog_1.AuditLog.find(query)
                    .sort({ timestamp: -1 })
                    .skip(skipNum)
                    .limit(limitNum)
                    .lean(),
                AuditLog_1.AuditLog.countDocuments(query),
            ]);
            res.json({
                success: true,
                logs,
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
     * GET /api/admin/audit/stats
     * Returns audit statistics and breakdown
     */
    getAuditStats: async (req, res) => {
        try {
            const now = new Date();
            const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const past7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const [totalLogs24h, totalLogs7d, totalAllTime, actionBreakdown, topResources] = await Promise.all([
                AuditLog_1.AuditLog.countDocuments({ timestamp: { $gte: past24h } }),
                AuditLog_1.AuditLog.countDocuments({ timestamp: { $gte: past7d } }),
                AuditLog_1.AuditLog.countDocuments(),
                AuditLog_1.AuditLog.aggregate([
                    { $match: { timestamp: { $gte: past7d } } },
                    { $group: { _id: '$action', count: { $sum: 1 } } },
                    { $sort: { count: -1 } },
                ]),
                AuditLog_1.AuditLog.aggregate([
                    { $match: { timestamp: { $gte: past7d } } },
                    { $group: { _id: '$resourceType', count: { $sum: 1 } } },
                    { $sort: { count: -1 } },
                    { $limit: 8 },
                ]),
            ]);
            res.json({
                success: true,
                stats: {
                    totalLogs24h,
                    totalLogs7d,
                    totalAllTime,
                    actionBreakdown: actionBreakdown.map((a) => ({ action: a._id, count: a.count })),
                    topResources: topResources.map((r) => ({ resourceType: r._id, count: r.count })),
                },
            });
        }
        catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },
    /**
     * GET /api/admin/audit/:id
     * Returns single audit log detail with full diffs
     */
    getAuditLogById: async (req, res) => {
        try {
            const { id } = req.params;
            const log = await AuditLog_1.AuditLog.findById(id).lean();
            if (!log) {
                res.status(404).json({ success: false, message: 'Audit record not found' });
                return;
            }
            res.json({
                success: true,
                log,
            });
        }
        catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },
    /**
     * GET /api/admin/audit/export
     * Exports filtered audit log trail as CSV or JSON
     */
    exportAuditLogs: async (req, res) => {
        try {
            const { action, resourceType, from, to, search, format = 'csv' } = req.query;
            const query = {};
            if (action && action !== 'ALL')
                query.action = action;
            if (resourceType && resourceType !== 'ALL')
                query.resourceType = resourceType;
            if (from || to) {
                query.timestamp = {};
                if (from)
                    query.timestamp.$gte = new Date(String(from));
                if (to)
                    query.timestamp.$lte = new Date(String(to));
            }
            if (search) {
                const s = String(search).trim();
                query.$or = [
                    { actorEmail: { $regex: s, $options: 'i' } },
                    { actorName: { $regex: s, $options: 'i' } },
                    { resourceName: { $regex: s, $options: 'i' } },
                    { requestId: { $regex: s, $options: 'i' } },
                ];
            }
            const logs = await AuditLog_1.AuditLog.find(query).sort({ timestamp: -1 }).limit(2000).lean();
            if (format === 'json') {
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Disposition', `attachment; filename="audit_trail_${new Date().toISOString().slice(0, 10)}.json"`);
                res.send(JSON.stringify(logs, null, 2));
                return;
            }
            // Format as CSV
            const headers = [
                'Timestamp',
                'Request ID',
                'Actor Name',
                'Actor Email',
                'Actor Role',
                'Action',
                'Resource Type',
                'Resource ID',
                'Resource Name',
                'Field Changes Summary',
                'Client IP',
                'User Agent',
            ];
            const csvRows = [headers.join(',')];
            for (const log of logs) {
                const changesSummary = log.changes
                    ? Object.entries(log.changes)
                        .map(([field, chg]) => `${field}: ${JSON.stringify(chg.from)} -> ${JSON.stringify(chg.to)}`)
                        .join(' | ')
                    : '';
                const row = [
                    `"${new Date(log.timestamp).toISOString()}"`,
                    `"${log.requestId || ''}"`,
                    `"${(log.actorName || '').replace(/"/g, '""')}"`,
                    `"${(log.actorEmail || '').replace(/"/g, '""')}"`,
                    `"${log.actorRole || ''}"`,
                    `"${log.action || ''}"`,
                    `"${log.resourceType || ''}"`,
                    `"${log.resourceId || ''}"`,
                    `"${(log.resourceName || '').replace(/"/g, '""')}"`,
                    `"${changesSummary.replace(/"/g, '""')}"`,
                    `"${log.ip || ''}"`,
                    `"${(log.userAgent || '').replace(/"/g, '""')}"`,
                ];
                csvRows.push(row.join(','));
            }
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="audit_trail_${new Date().toISOString().slice(0, 10)}.csv"`);
            res.send(csvRows.join('\n'));
        }
        catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },
    /**
     * POST /api/admin/audit/archive
     * Triggers cold storage archive with SHA256 integrity seal
     */
    archiveAuditLogs: async (req, res) => {
        try {
            const { retentionDays = 90 } = req.body;
            const result = await auditArchiver_1.AuditArchiver.archiveOldLogs(parseInt(String(retentionDays), 10) || 90);
            res.json({
                success: true,
                message: `Successfully processed archive partition [${result.partitionId}]`,
                archive: result,
            });
        }
        catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },
};
