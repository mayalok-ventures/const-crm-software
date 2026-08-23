"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loggingController = exports.LoggingController = void 0;
const SystemLog_1 = require("../models/SystemLog");
const logger_1 = require("../logging/logger");
class LoggingController {
    /**
     * GET /api/admin/logs
     * Query filterable structured system logs with pagination
     */
    getLogs = async (req, res) => {
        try {
            const { level, service, module: logModule, server, dateFrom, dateTo, requestId, userId, search, page = '1', limit = '50', } = req.query;
            const query = {};
            if (level && level !== 'ALL') {
                query.level = String(level).toUpperCase();
            }
            if (service) {
                query.service = String(service);
            }
            if (logModule && logModule !== 'ALL') {
                query.module = String(logModule).toLowerCase();
            }
            if (server && server !== 'ALL') {
                query.serverId = String(server);
            }
            if (requestId) {
                query.requestId = String(requestId);
            }
            if (userId) {
                query.userId = String(userId);
            }
            if (dateFrom || dateTo) {
                query.timestamp = {};
                if (dateFrom)
                    query.timestamp.$gte = new Date(String(dateFrom));
                if (dateTo)
                    query.timestamp.$lte = new Date(String(dateTo));
            }
            if (search) {
                query.message = { $regex: String(search), $options: 'i' };
            }
            const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
            const limitNum = Math.min(200, Math.max(1, parseInt(String(limit), 10) || 50));
            const skip = (pageNum - 1) * limitNum;
            const [logs, total] = await Promise.all([
                SystemLog_1.SystemLog.find(query)
                    .sort({ timestamp: -1 })
                    .skip(skip)
                    .limit(limitNum)
                    .lean(),
                SystemLog_1.SystemLog.countDocuments(query),
            ]);
            res.status(200).json({
                success: true,
                logs,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    pages: Math.ceil(total / limitNum) || 1,
                },
            });
        }
        catch (error) {
            console.error('[LoggingController] getLogs error:', error.message);
            res.status(500).json({ success: false, message: error.message });
        }
    };
    /**
     * GET /api/admin/logs/stream
     * Fetch in-memory ring-buffer for live stream visualization
     */
    getLiveStream = async (req, res) => {
        try {
            const limit = parseInt(String(req.query.limit || '100'), 10);
            const liveLogs = logger_1.logger.getLiveStream(limit);
            res.status(200).json({ success: true, logs: liveLogs });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    };
    /**
     * GET /api/admin/logs/:id
     * Get complete log item by ID
     */
    getLogById = async (req, res) => {
        try {
            const { id } = req.params;
            const log = await SystemLog_1.SystemLog.findById(id).lean();
            if (!log) {
                res.status(404).json({ success: false, message: 'Log not found' });
                return;
            }
            res.status(200).json({ success: true, log });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    };
}
exports.LoggingController = LoggingController;
exports.loggingController = new LoggingController();
exports.default = exports.loggingController;
