"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiKeyController = exports.ApiKeyController = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const ApiKey_1 = __importDefault(require("../models/ApiKey"));
const ApiKeyAuditLog_1 = __importDefault(require("../models/ApiKeyAuditLog"));
const ApiKeySecurityAlert_1 = __importDefault(require("../models/ApiKeySecurityAlert"));
const ApiKeyUsageMetric_1 = __importDefault(require("../models/ApiKeyUsageMetric"));
const apiKeyService_1 = require("../apikeys/apiKeyService");
class ApiKeyController {
    /**
     * GET /api/admin/apikeys/overview
     */
    static async getOverview(req, res) {
        try {
            const orgFilter = req.query.organizationId;
            const overview = await apiKeyService_1.ApiKeyService.getFleetOverview(orgFilter);
            res.json(overview);
        }
        catch (err) {
            console.error('[ApiKeyController] getOverview error:', err.message);
            res.status(500).json({ message: 'Failed to retrieve API key overview', error: err.message });
        }
    }
    /**
     * GET /api/admin/apikeys
     */
    static async getKeys(req, res) {
        try {
            const { organizationId, status, search, sort = 'created_desc', page = '1', limit = '50', } = req.query;
            const filter = {};
            if (organizationId && mongoose_1.default.Types.ObjectId.isValid(organizationId)) {
                filter.organizationId = new mongoose_1.default.Types.ObjectId(organizationId);
            }
            if (status && status !== 'all') {
                filter.status = status;
            }
            if (search) {
                filter.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { keyPrefix: { $regex: search, $options: 'i' } },
                    { organizationName: { $regex: search, $options: 'i' } },
                ];
            }
            let sortQuery = { createdAt: -1 };
            if (sort === 'totalRequests_desc')
                sortQuery = { totalRequests: -1 };
            else if (sort === 'lastUsed_desc')
                sortQuery = { lastUsedAt: -1 };
            else if (sort === 'name_asc')
                sortQuery = { name: 1 };
            const pageNum = parseInt(page, 10) || 1;
            const limitNum = parseInt(limit, 10) || 50;
            const skip = (pageNum - 1) * limitNum;
            const [keys, total] = await Promise.all([
                ApiKey_1.default.find(filter).sort(sortQuery).skip(skip).limit(limitNum).lean(),
                ApiKey_1.default.countDocuments(filter),
            ]);
            res.json({
                keys,
                pagination: {
                    total,
                    page: pageNum,
                    pages: Math.ceil(total / limitNum),
                    limit: limitNum,
                },
            });
        }
        catch (err) {
            console.error('[ApiKeyController] getKeys error:', err.message);
            res.status(500).json({ message: 'Failed to retrieve API keys', error: err.message });
        }
    }
    /**
     * POST /api/admin/apikeys
     */
    static async createKey(req, res) {
        try {
            const { name, organizationId, organizationName, permissions, rateLimitPerMinute, ipWhitelist, expiresAt, } = req.body;
            if (!name || typeof name !== 'string') {
                res.status(400).json({ message: 'API key name is required.' });
                return;
            }
            const orgId = organizationId || req.user?._id || new mongoose_1.default.Types.ObjectId();
            const createdBy = req.user?._id;
            const createdByName = req.user?.name || 'Admin';
            const createdByEmail = req.user?.email || '';
            const { apiKey, rawKey } = await apiKeyService_1.ApiKeyService.generateApiKey({
                name,
                organizationId: orgId,
                organizationName: organizationName || 'Organization',
                createdBy,
                createdByName,
                createdByEmail,
                permissions: permissions || ['leads:read', 'leads:write'],
                rateLimitPerMinute: Number(rateLimitPerMinute) || 120,
                ipWhitelist: Array.isArray(ipWhitelist) ? ipWhitelist : [],
                expiresAt: expiresAt ? new Date(expiresAt) : null,
            });
            res.status(201).json({
                apiKey,
                rawKey, // RETURNED ONLY ONCE TO CLIENT
                message: 'API Key generated successfully. Save this secret key now; it cannot be shown again.',
            });
        }
        catch (err) {
            console.error('[ApiKeyController] createKey error:', err.message);
            res.status(500).json({ message: 'Failed to create API key', error: err.message });
        }
    }
    /**
     * GET /api/admin/apikeys/:id
     */
    static async getKeyById(req, res) {
        try {
            const { id } = req.params;
            const query = mongoose_1.default.Types.ObjectId.isValid(id) ? { _id: id } : { keyId: id };
            const apiKey = (await ApiKey_1.default.findOne(query).lean());
            if (!apiKey) {
                res.status(404).json({ message: 'API key not found' });
                return;
            }
            const [usageMetrics, auditLogs, securityAlerts] = await Promise.all([
                ApiKeyUsageMetric_1.default.find({ keyId: apiKey.keyId }).sort({ timestamp: 1 }).limit(30).lean(),
                ApiKeyAuditLog_1.default.find({ keyId: apiKey.keyId }).sort({ createdAt: -1 }).limit(20).lean(),
                ApiKeySecurityAlert_1.default.find({ keyId: apiKey.keyId }).sort({ createdAt: -1 }).limit(10).lean(),
            ]);
            res.json({
                apiKey,
                usageMetrics,
                auditLogs,
                securityAlerts,
            });
        }
        catch (err) {
            console.error('[ApiKeyController] getKeyById error:', err.message);
            res.status(500).json({ message: 'Failed to retrieve API key details', error: err.message });
        }
    }
    /**
     * PUT /api/admin/apikeys/:id
     */
    static async updateKey(req, res) {
        try {
            const { id } = req.params;
            const { name, permissions, rateLimitPerMinute, ipWhitelist, expiresAt } = req.body;
            const query = mongoose_1.default.Types.ObjectId.isValid(id) ? { _id: id } : { keyId: id };
            const apiKey = await ApiKey_1.default.findOne(query);
            if (!apiKey) {
                res.status(404).json({ message: 'API key not found' });
                return;
            }
            if (name)
                apiKey.name = name;
            if (Array.isArray(permissions))
                apiKey.permissions = permissions;
            if (rateLimitPerMinute !== undefined)
                apiKey.rateLimitPerMinute = Number(rateLimitPerMinute);
            if (Array.isArray(ipWhitelist))
                apiKey.ipWhitelist = ipWhitelist;
            if (expiresAt !== undefined)
                apiKey.expiresAt = expiresAt ? new Date(expiresAt) : null;
            await apiKey.save();
            await apiKeyService_1.ApiKeyService.logAudit({
                keyId: apiKey.keyId,
                keyPrefix: apiKey.keyPrefix,
                organizationId: apiKey.organizationId,
                action: 'PERMISSIONS_UPDATED',
                performedBy: req.user?.name || 'Admin',
                metadata: { permissions, rateLimitPerMinute, ipWhitelist, expiresAt },
            });
            res.json({ apiKey, message: 'API key updated successfully.' });
        }
        catch (err) {
            console.error('[ApiKeyController] updateKey error:', err.message);
            res.status(500).json({ message: 'Failed to update API key', error: err.message });
        }
    }
    /**
     * POST /api/admin/apikeys/:id/rotate
     */
    static async rotateKey(req, res) {
        try {
            const { id } = req.params;
            const { gracePeriodHours = 0 } = req.body;
            const performedBy = req.user?.name || 'Admin';
            const keyRecord = mongoose_1.default.Types.ObjectId.isValid(id) ? await ApiKey_1.default.findById(id) : await ApiKey_1.default.findOne({ keyId: id });
            if (!keyRecord) {
                res.status(404).json({ message: 'API key not found' });
                return;
            }
            const { apiKey, newRawKey } = await apiKeyService_1.ApiKeyService.rotateApiKey(keyRecord.keyId, performedBy, Number(gracePeriodHours));
            res.json({
                apiKey,
                newRawKey, // RETURNED ONLY ONCE TO CLIENT
                message: 'API Key rotated successfully. Store this new secret key now; it cannot be shown again.',
            });
        }
        catch (err) {
            console.error('[ApiKeyController] rotateKey error:', err.message);
            res.status(500).json({ message: 'Failed to rotate API key', error: err.message });
        }
    }
    /**
     * POST /api/admin/apikeys/:id/revoke
     */
    static async revokeKey(req, res) {
        try {
            const { id } = req.params;
            const { reason } = req.body;
            const performedBy = req.user?.name || 'Admin';
            const keyRecord = mongoose_1.default.Types.ObjectId.isValid(id) ? await ApiKey_1.default.findById(id) : await ApiKey_1.default.findOne({ keyId: id });
            if (!keyRecord) {
                res.status(404).json({ message: 'API key not found' });
                return;
            }
            const apiKey = await apiKeyService_1.ApiKeyService.revokeApiKey(keyRecord.keyId, performedBy, reason);
            res.json({ apiKey, message: 'API key has been revoked permanently.' });
        }
        catch (err) {
            console.error('[ApiKeyController] revokeKey error:', err.message);
            res.status(500).json({ message: 'Failed to revoke API key', error: err.message });
        }
    }
    /**
     * POST /api/admin/apikeys/:id/suspend
     */
    static async suspendKey(req, res) {
        try {
            const { id } = req.params;
            const { reason } = req.body;
            const performedBy = req.user?.name || 'Admin';
            const keyRecord = mongoose_1.default.Types.ObjectId.isValid(id) ? await ApiKey_1.default.findById(id) : await ApiKey_1.default.findOne({ keyId: id });
            if (!keyRecord) {
                res.status(404).json({ message: 'API key not found' });
                return;
            }
            const apiKey = await apiKeyService_1.ApiKeyService.suspendApiKey(keyRecord.keyId, performedBy, reason);
            res.json({ apiKey, message: 'API key has been suspended.' });
        }
        catch (err) {
            console.error('[ApiKeyController] suspendKey error:', err.message);
            res.status(500).json({ message: 'Failed to suspend API key', error: err.message });
        }
    }
    /**
     * POST /api/admin/apikeys/:id/reactivate
     */
    static async reactivateKey(req, res) {
        try {
            const { id } = req.params;
            const performedBy = req.user?.name || 'Admin';
            const keyRecord = mongoose_1.default.Types.ObjectId.isValid(id) ? await ApiKey_1.default.findById(id) : await ApiKey_1.default.findOne({ keyId: id });
            if (!keyRecord) {
                res.status(404).json({ message: 'API key not found' });
                return;
            }
            const apiKey = await apiKeyService_1.ApiKeyService.reactivateApiKey(keyRecord.keyId, performedBy);
            res.json({ apiKey, message: 'API key has been reactivated successfully.' });
        }
        catch (err) {
            console.error('[ApiKeyController] reactivateKey error:', err.message);
            res.status(500).json({ message: 'Failed to reactivate API key', error: err.message });
        }
    }
    /**
     * DELETE /api/admin/apikeys/:id
     */
    static async deleteKey(req, res) {
        try {
            const { id } = req.params;
            const query = mongoose_1.default.Types.ObjectId.isValid(id) ? { _id: id } : { keyId: id };
            const deleted = await ApiKey_1.default.findOneAndDelete(query);
            if (!deleted) {
                res.status(404).json({ message: 'API key not found' });
                return;
            }
            await Promise.all([
                ApiKeyAuditLog_1.default.deleteMany({ keyId: deleted.keyId }),
                ApiKeySecurityAlert_1.default.deleteMany({ keyId: deleted.keyId }),
                ApiKeyUsageMetric_1.default.deleteMany({ keyId: deleted.keyId }),
            ]);
            res.json({ message: 'API key and associated logs deleted permanently.' });
        }
        catch (err) {
            console.error('[ApiKeyController] deleteKey error:', err.message);
            res.status(500).json({ message: 'Failed to delete API key', error: err.message });
        }
    }
    /**
     * GET /api/admin/apikeys/alerts
     */
    static async getAlerts(req, res) {
        try {
            const { isResolved, limit = '50' } = req.query;
            const filter = {};
            if (isResolved !== undefined) {
                filter.isResolved = isResolved === 'true';
            }
            const alerts = await ApiKeySecurityAlert_1.default.find(filter)
                .sort({ createdAt: -1 })
                .limit(parseInt(limit, 10))
                .lean();
            res.json({ alerts });
        }
        catch (err) {
            console.error('[ApiKeyController] getAlerts error:', err.message);
            res.status(500).json({ message: 'Failed to retrieve API key alerts', error: err.message });
        }
    }
    /**
     * POST /api/admin/apikeys/alerts/:id/resolve
     */
    static async resolveAlert(req, res) {
        try {
            const { id } = req.params;
            const resolvedBy = req.user?.name || 'Admin';
            const alert = await ApiKeySecurityAlert_1.default.findOneAndUpdate({ $or: [{ _id: mongoose_1.default.Types.ObjectId.isValid(id) ? id : null }, { alertId: id }] }, {
                $set: {
                    isResolved: true,
                    resolvedAt: new Date(),
                    resolvedBy,
                },
            }, { new: true });
            if (!alert) {
                res.status(404).json({ message: 'Alert not found' });
                return;
            }
            res.json({ alert, message: 'Security alert marked as resolved.' });
        }
        catch (err) {
            console.error('[ApiKeyController] resolveAlert error:', err.message);
            res.status(500).json({ message: 'Failed to resolve alert', error: err.message });
        }
    }
}
exports.ApiKeyController = ApiKeyController;
exports.apiKeyController = ApiKeyController;
exports.default = ApiKeyController;
