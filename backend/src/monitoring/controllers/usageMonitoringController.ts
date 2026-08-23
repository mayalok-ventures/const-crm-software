import { Request, Response } from 'express';
import OrganizationUsage from '../models/OrganizationUsage';
import UsageSnapshot from '../models/UsageSnapshot';
import UsageLimit from '../models/UsageLimit';
import UsageAlert from '../models/UsageAlert';
import { usageMonitorWorker } from '../usage/UsageMonitorWorker';
import { usageAggregatorService } from '../usage/usageAggregatorService';
import User from '../../models/User';

export class UsageMonitoringController {
  /**
   * GET /api/admin/usage/overview
   * Returns high-level capacity fleet metrics, top consumers, fastest growing, and near limits
   */
  public async getOverview(req: Request, res: Response): Promise<void> {
    try {
      const summary = await usageMonitorWorker.getSummary();
      const openAlertsCount = await UsageAlert.countDocuments({ resolvedAt: null, isAcknowledged: false });

      res.status(200).json({
        success: true,
        summary: {
          ...summary,
          openAlertsCount,
        },
      });
    } catch (err: any) {
      console.error('[UsageMonitoringController] Error fetching overview:', err.message);
      res.status(500).json({ success: false, message: 'Failed to fetch usage overview', error: err.message });
    }
  }

  /**
   * GET /api/admin/usage/organizations
   * Returns filterable/searchable organizations with resource usage bars
   */
  public async getOrganizations(req: Request, res: Response): Promise<void> {
    try {
      const { search, plan, status, sort = 'capacity_desc', page = '1', limit = '20' } = req.query;

      const filter: Record<string, any> = {};

      if (search) {
        filter.$or = [
          { organizationName: { $regex: String(search), $options: 'i' } },
          { ownerEmail: { $regex: String(search), $options: 'i' } },
          { ownerName: { $regex: String(search), $options: 'i' } },
        ];
      }

      if (plan && plan !== 'all') {
        filter.plan = String(plan);
      }

      if (status && status !== 'all') {
        filter.overallStatus = String(status);
      }

      const sortOptions: Record<string, any> = {};
      if (sort === 'capacity_desc') sortOptions.overallCapacityPercent = -1;
      else if (sort === 'storage_desc') sortOptions['storage.percent'] = -1;
      else if (sort === 'users_desc') sortOptions['users.percent'] = -1;
      else if (sort === 'api_desc') sortOptions['apiRequests.percent'] = -1;
      else if (sort === 'growth_desc') sortOptions['growthMetrics.velocityScore'] = -1;
      else if (sort === 'name_asc') sortOptions.organizationName = 1;
      else sortOptions.overallCapacityPercent = -1;

      const pageNum = Math.max(1, parseInt(String(page), 10));
      const pageSize = Math.max(1, Math.min(100, parseInt(String(limit), 10)));
      const skip = (pageNum - 1) * pageSize;

      const [organizations, total] = await Promise.all([
        OrganizationUsage.find(filter).sort(sortOptions).skip(skip).limit(pageSize).lean(),
        OrganizationUsage.countDocuments(filter),
      ]);

      res.status(200).json({
        success: true,
        organizations,
        pagination: {
          total,
          page: pageNum,
          limit: pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
      });
    } catch (err: any) {
      console.error('[UsageMonitoringController] Error fetching organizations:', err.message);
      res.status(500).json({ success: false, message: 'Failed to fetch organizations', error: err.message });
    }
  }

  /**
   * GET /api/admin/usage/organizations/:id
   * Deep drill-down for single organization including 30-day historical time-series
   */
  public async getOrganizationById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const usage: any = await OrganizationUsage.findOne({
        $or: [{ _id: id }, { organizationId: id }],
      }).lean();

      if (!usage) {
        res.status(404).json({ success: false, message: 'Organization usage record not found' });
        return;
      }

      // Fetch 30-day historical snapshots for multi-resource chart
      const snapshots = await UsageSnapshot.find({
        organizationId: usage.organizationId,
      })
        .sort({ timestamp: 1 })
        .limit(30)
        .lean();

      // Fetch custom limits
      const limits = await UsageLimit.findOne({ organizationId: usage.organizationId }).lean();

      // Fetch recent alerts for this org
      const alerts = await UsageAlert.find({ organizationId: usage.organizationId })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      res.status(200).json({
        success: true,
        usage,
        snapshots,
        limits,
        alerts,
      });
    } catch (err: any) {
      console.error('[UsageMonitoringController] Error fetching organization detail:', err.message);
      res.status(500).json({ success: false, message: 'Failed to fetch organization details', error: err.message });
    }
  }

  /**
   * PUT /api/admin/usage/organizations/:id/limits
   * Updates plan limits or custom overrides for an organization
   */
  public async updateOrganizationLimits(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const {
        storageLimitBytes,
        maxUsers,
        maxApiRequests,
        maxLeads,
        maxGroups,
        maxConcurrentCampaigns,
        maxMonthlyMessages,
        notes,
      } = req.body;

      const usage = await OrganizationUsage.findOne({
        $or: [{ _id: id }, { organizationId: id }],
      });

      if (!usage) {
        res.status(404).json({ success: false, message: 'Organization not found' });
        return;
      }

      const updatedLimit = await UsageLimit.findOneAndUpdate(
        { organizationId: usage.organizationId },
        {
          organizationId: usage.organizationId,
          plan: usage.plan || 'custom_enterprise',
          tierType: usage.tierType || 'enterprise',
          storageLimitBytes: Number(storageLimitBytes) || usage.storage.limitBytes,
          maxUsers: Number(maxUsers) || usage.users.maxUsers,
          maxApiRequests: Number(maxApiRequests) || usage.apiRequests.maxRequests,
          maxLeads: Number(maxLeads) || usage.databaseRecords.maxLeads,
          maxGroups: Number(maxGroups) || usage.databaseRecords.maxGroups,
          maxConcurrentCampaigns: Number(maxConcurrentCampaigns) || usage.campaigns.maxConcurrent,
          maxMonthlyMessages: Number(maxMonthlyMessages) || usage.messages.monthlyLimit,
          isCustomOverride: true,
          notes: notes || 'Custom administrator override',
          updatedBy: (req as any).user?.email || 'admin',
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // Re-aggregate usage immediately for this organization
      const orgUser = await User.findById(usage.organizationId).lean();
      if (orgUser) {
        await usageAggregatorService.aggregateSingleOrganization(orgUser);
      }

      const refreshed = await OrganizationUsage.findOne({ organizationId: usage.organizationId }).lean();

      res.status(200).json({
        success: true,
        message: 'Organization limits updated successfully',
        limits: updatedLimit,
        usage: refreshed,
      });
    } catch (err: any) {
      console.error('[UsageMonitoringController] Error updating limits:', err.message);
      res.status(500).json({ success: false, message: 'Failed to update organization limits', error: err.message });
    }
  }

  /**
   * GET /api/admin/usage/alerts
   * Returns active or all usage threshold alerts
   */
  public async getAlerts(req: Request, res: Response): Promise<void> {
    try {
      const { severity, resourceType, isAcknowledged } = req.query;

      const filter: Record<string, any> = { resolvedAt: null };

      if (severity && severity !== 'all') {
        filter.severity = String(severity);
      }
      if (resourceType && resourceType !== 'all') {
        filter.resourceType = String(resourceType);
      }
      if (isAcknowledged !== undefined && isAcknowledged !== 'all') {
        filter.isAcknowledged = isAcknowledged === 'true';
      }

      const alerts = await UsageAlert.find(filter).sort({ createdAt: -1 }).limit(50).lean();

      res.status(200).json({
        success: true,
        alerts,
        count: alerts.length,
      });
    } catch (err: any) {
      console.error('[UsageMonitoringController] Error fetching alerts:', err.message);
      res.status(500).json({ success: false, message: 'Failed to fetch usage alerts', error: err.message });
    }
  }

  /**
   * POST /api/admin/usage/alerts/:id/acknowledge
   * Marks a usage alert as acknowledged
   */
  public async acknowledgeAlert(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const alert = await UsageAlert.findOneAndUpdate(
        { $or: [{ _id: id }, { alertId: id }] },
        {
          isAcknowledged: true,
          acknowledgedBy: (req as any).user?.email || 'admin',
          acknowledgedAt: new Date(),
        },
        { new: true }
      );

      if (!alert) {
        res.status(404).json({ success: false, message: 'Alert not found' });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Alert acknowledged successfully',
        alert,
      });
    } catch (err: any) {
      console.error('[UsageMonitoringController] Error acknowledging alert:', err.message);
      res.status(500).json({ success: false, message: 'Failed to acknowledge alert', error: err.message });
    }
  }

  /**
   * POST /api/admin/usage/recalculate
   * Manually triggers full fleet usage aggregation
   */
  public async triggerRecalculate(req: Request, res: Response): Promise<void> {
    try {
      const summary = await usageMonitorWorker.collect();

      res.status(200).json({
        success: true,
        message: 'Fleet usage aggregation completed successfully',
        summary,
      });
    } catch (err: any) {
      console.error('[UsageMonitoringController] Error triggering recalculate:', err.message);
      res.status(500).json({ success: false, message: 'Failed to recalculate fleet usage', error: err.message });
    }
  }
}

export const usageMonitoringController = new UsageMonitoringController();
export default usageMonitoringController;
