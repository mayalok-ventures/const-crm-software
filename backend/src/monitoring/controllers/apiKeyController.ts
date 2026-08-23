import { Request, Response } from 'express';
import mongoose from 'mongoose';
import ApiKey from '../models/ApiKey';
import ApiKeyAuditLog from '../models/ApiKeyAuditLog';
import ApiKeySecurityAlert from '../models/ApiKeySecurityAlert';
import ApiKeyUsageMetric from '../models/ApiKeyUsageMetric';
import { ApiKeyService } from '../apikeys/apiKeyService';

export class ApiKeyController {
  /**
   * GET /api/admin/apikeys/overview
   */
  public static async getOverview(req: Request, res: Response): Promise<void> {
    try {
      const orgFilter = req.query.organizationId as string | undefined;
      const overview = await ApiKeyService.getFleetOverview(orgFilter);
      res.json(overview);
    } catch (err: any) {
      console.error('[ApiKeyController] getOverview error:', err.message);
      res.status(500).json({ message: 'Failed to retrieve API key overview', error: err.message });
    }
  }

  /**
   * GET /api/admin/apikeys
   */
  public static async getKeys(req: Request, res: Response): Promise<void> {
    try {
      const {
        organizationId,
        status,
        search,
        sort = 'created_desc',
        page = '1',
        limit = '50',
      } = req.query;

      const filter: any = {};

      if (organizationId && mongoose.Types.ObjectId.isValid(organizationId as string)) {
        filter.organizationId = new mongoose.Types.ObjectId(organizationId as string);
      }

      if (status && status !== 'all') {
        filter.status = status;
      }

      if (search) {
        filter.$or = [
          { name: { $regex: search as string, $options: 'i' } },
          { keyPrefix: { $regex: search as string, $options: 'i' } },
          { organizationName: { $regex: search as string, $options: 'i' } },
        ];
      }

      let sortQuery: any = { createdAt: -1 };
      if (sort === 'totalRequests_desc') sortQuery = { totalRequests: -1 };
      else if (sort === 'lastUsed_desc') sortQuery = { lastUsedAt: -1 };
      else if (sort === 'name_asc') sortQuery = { name: 1 };

      const pageNum = parseInt(page as string, 10) || 1;
      const limitNum = parseInt(limit as string, 10) || 50;
      const skip = (pageNum - 1) * limitNum;

      const [keys, total] = await Promise.all([
        ApiKey.find(filter).sort(sortQuery).skip(skip).limit(limitNum).lean(),
        ApiKey.countDocuments(filter),
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
    } catch (err: any) {
      console.error('[ApiKeyController] getKeys error:', err.message);
      res.status(500).json({ message: 'Failed to retrieve API keys', error: err.message });
    }
  }

  /**
   * POST /api/admin/apikeys
   */
  public static async createKey(req: Request, res: Response): Promise<void> {
    try {
      const {
        name,
        organizationId,
        organizationName,
        permissions,
        rateLimitPerMinute,
        ipWhitelist,
        expiresAt,
      } = req.body;

      if (!name || typeof name !== 'string') {
        res.status(400).json({ message: 'API key name is required.' });
        return;
      }

      const orgId = organizationId || (req as any).user?._id || new mongoose.Types.ObjectId();
      const createdBy = (req as any).user?._id;
      const createdByName = (req as any).user?.name || 'Admin';
      const createdByEmail = (req as any).user?.email || '';

      const { apiKey, rawKey } = await ApiKeyService.generateApiKey({
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
    } catch (err: any) {
      console.error('[ApiKeyController] createKey error:', err.message);
      res.status(500).json({ message: 'Failed to create API key', error: err.message });
    }
  }

  /**
   * GET /api/admin/apikeys/:id
   */
  public static async getKeyById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { keyId: id };

      const apiKey = (await ApiKey.findOne(query).lean()) as any;
      if (!apiKey) {
        res.status(404).json({ message: 'API key not found' });
        return;
      }

      const [usageMetrics, auditLogs, securityAlerts] = await Promise.all([
        ApiKeyUsageMetric.find({ keyId: apiKey.keyId }).sort({ timestamp: 1 }).limit(30).lean(),
        ApiKeyAuditLog.find({ keyId: apiKey.keyId }).sort({ createdAt: -1 }).limit(20).lean(),
        ApiKeySecurityAlert.find({ keyId: apiKey.keyId }).sort({ createdAt: -1 }).limit(10).lean(),
      ]);

      res.json({
        apiKey,
        usageMetrics,
        auditLogs,
        securityAlerts,
      });
    } catch (err: any) {
      console.error('[ApiKeyController] getKeyById error:', err.message);
      res.status(500).json({ message: 'Failed to retrieve API key details', error: err.message });
    }
  }

  /**
   * PUT /api/admin/apikeys/:id
   */
  public static async updateKey(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name, permissions, rateLimitPerMinute, ipWhitelist, expiresAt } = req.body;

      const query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { keyId: id };
      const apiKey = await ApiKey.findOne(query);

      if (!apiKey) {
        res.status(404).json({ message: 'API key not found' });
        return;
      }

      if (name) apiKey.name = name;
      if (Array.isArray(permissions)) apiKey.permissions = permissions;
      if (rateLimitPerMinute !== undefined) apiKey.rateLimitPerMinute = Number(rateLimitPerMinute);
      if (Array.isArray(ipWhitelist)) apiKey.ipWhitelist = ipWhitelist;
      if (expiresAt !== undefined) apiKey.expiresAt = expiresAt ? new Date(expiresAt) : null;

      await apiKey.save();

      await ApiKeyService.logAudit({
        keyId: apiKey.keyId,
        keyPrefix: apiKey.keyPrefix,
        organizationId: apiKey.organizationId,
        action: 'PERMISSIONS_UPDATED',
        performedBy: (req as any).user?.name || 'Admin',
        metadata: { permissions, rateLimitPerMinute, ipWhitelist, expiresAt },
      });

      res.json({ apiKey, message: 'API key updated successfully.' });
    } catch (err: any) {
      console.error('[ApiKeyController] updateKey error:', err.message);
      res.status(500).json({ message: 'Failed to update API key', error: err.message });
    }
  }

  /**
   * POST /api/admin/apikeys/:id/rotate
   */
  public static async rotateKey(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { gracePeriodHours = 0 } = req.body;
      const performedBy = (req as any).user?.name || 'Admin';

      const keyRecord = mongoose.Types.ObjectId.isValid(id) ? await ApiKey.findById(id) : await ApiKey.findOne({ keyId: id });
      if (!keyRecord) {
        res.status(404).json({ message: 'API key not found' });
        return;
      }

      const { apiKey, newRawKey } = await ApiKeyService.rotateApiKey(keyRecord.keyId, performedBy, Number(gracePeriodHours));

      res.json({
        apiKey,
        newRawKey, // RETURNED ONLY ONCE TO CLIENT
        message: 'API Key rotated successfully. Store this new secret key now; it cannot be shown again.',
      });
    } catch (err: any) {
      console.error('[ApiKeyController] rotateKey error:', err.message);
      res.status(500).json({ message: 'Failed to rotate API key', error: err.message });
    }
  }

  /**
   * POST /api/admin/apikeys/:id/revoke
   */
  public static async revokeKey(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const performedBy = (req as any).user?.name || 'Admin';

      const keyRecord = mongoose.Types.ObjectId.isValid(id) ? await ApiKey.findById(id) : await ApiKey.findOne({ keyId: id });
      if (!keyRecord) {
        res.status(404).json({ message: 'API key not found' });
        return;
      }

      const apiKey = await ApiKeyService.revokeApiKey(keyRecord.keyId, performedBy, reason);
      res.json({ apiKey, message: 'API key has been revoked permanently.' });
    } catch (err: any) {
      console.error('[ApiKeyController] revokeKey error:', err.message);
      res.status(500).json({ message: 'Failed to revoke API key', error: err.message });
    }
  }

  /**
   * POST /api/admin/apikeys/:id/suspend
   */
  public static async suspendKey(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const performedBy = (req as any).user?.name || 'Admin';

      const keyRecord = mongoose.Types.ObjectId.isValid(id) ? await ApiKey.findById(id) : await ApiKey.findOne({ keyId: id });
      if (!keyRecord) {
        res.status(404).json({ message: 'API key not found' });
        return;
      }

      const apiKey = await ApiKeyService.suspendApiKey(keyRecord.keyId, performedBy, reason);
      res.json({ apiKey, message: 'API key has been suspended.' });
    } catch (err: any) {
      console.error('[ApiKeyController] suspendKey error:', err.message);
      res.status(500).json({ message: 'Failed to suspend API key', error: err.message });
    }
  }

  /**
   * POST /api/admin/apikeys/:id/reactivate
   */
  public static async reactivateKey(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const performedBy = (req as any).user?.name || 'Admin';

      const keyRecord = mongoose.Types.ObjectId.isValid(id) ? await ApiKey.findById(id) : await ApiKey.findOne({ keyId: id });
      if (!keyRecord) {
        res.status(404).json({ message: 'API key not found' });
        return;
      }

      const apiKey = await ApiKeyService.reactivateApiKey(keyRecord.keyId, performedBy);
      res.json({ apiKey, message: 'API key has been reactivated successfully.' });
    } catch (err: any) {
      console.error('[ApiKeyController] reactivateKey error:', err.message);
      res.status(500).json({ message: 'Failed to reactivate API key', error: err.message });
    }
  }

  /**
   * DELETE /api/admin/apikeys/:id
   */
  public static async deleteKey(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { keyId: id };

      const deleted = await ApiKey.findOneAndDelete(query);
      if (!deleted) {
        res.status(404).json({ message: 'API key not found' });
        return;
      }

      await Promise.all([
        ApiKeyAuditLog.deleteMany({ keyId: deleted.keyId }),
        ApiKeySecurityAlert.deleteMany({ keyId: deleted.keyId }),
        ApiKeyUsageMetric.deleteMany({ keyId: deleted.keyId }),
      ]);

      res.json({ message: 'API key and associated logs deleted permanently.' });
    } catch (err: any) {
      console.error('[ApiKeyController] deleteKey error:', err.message);
      res.status(500).json({ message: 'Failed to delete API key', error: err.message });
    }
  }

  /**
   * GET /api/admin/apikeys/alerts
   */
  public static async getAlerts(req: Request, res: Response): Promise<void> {
    try {
      const { isResolved, limit = '50' } = req.query;
      const filter: any = {};
      if (isResolved !== undefined) {
        filter.isResolved = isResolved === 'true';
      }

      const alerts = await ApiKeySecurityAlert.find(filter)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit as string, 10))
        .lean();

      res.json({ alerts });
    } catch (err: any) {
      console.error('[ApiKeyController] getAlerts error:', err.message);
      res.status(500).json({ message: 'Failed to retrieve API key alerts', error: err.message });
    }
  }

  /**
   * POST /api/admin/apikeys/alerts/:id/resolve
   */
  public static async resolveAlert(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const resolvedBy = (req as any).user?.name || 'Admin';

      const alert = await ApiKeySecurityAlert.findOneAndUpdate(
        { $or: [{ _id: mongoose.Types.ObjectId.isValid(id) ? id : null }, { alertId: id }] },
        {
          $set: {
            isResolved: true,
            resolvedAt: new Date(),
            resolvedBy,
          },
        },
        { new: true }
      );

      if (!alert) {
        res.status(404).json({ message: 'Alert not found' });
        return;
      }

      res.json({ alert, message: 'Security alert marked as resolved.' });
    } catch (err: any) {
      console.error('[ApiKeyController] resolveAlert error:', err.message);
      res.status(500).json({ message: 'Failed to resolve alert', error: err.message });
    }
  }
}

export const apiKeyController = ApiKeyController;
export default ApiKeyController;
