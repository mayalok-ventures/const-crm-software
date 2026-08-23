import { Request, Response } from 'express';
import { ErrorGroup } from '../models/ErrorGroup';
import { ErrorOccurrence } from '../models/ErrorOccurrence';

export class ErrorTrackingController {
  /**
   * GET /api/admin/errors/groups
   * List grouped errors with search, status filters, and pagination
   */
  public getErrorGroups = async (req: Request, res: Response): Promise<void> => {
    try {
      const { status, severity, search, page = '1', limit = '25' } = req.query;

      const query: Record<string, any> = {};

      if (status && status !== 'ALL') {
        query.status = String(status).toUpperCase();
      }

      if (severity && severity !== 'ALL') {
        query.severity = String(severity).toUpperCase();
      }

      if (search) {
        query.$or = [
          { message: { $regex: String(search), $options: 'i' } },
          { errorType: { $regex: String(search), $options: 'i' } },
          { primaryFrame: { $regex: String(search), $options: 'i' } },
          { affectedEndpoints: { $regex: String(search), $options: 'i' } },
        ];
      }

      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 25));
      const skip = (pageNum - 1) * limitNum;

      const [groups, total] = await Promise.all([
        ErrorGroup.find(query)
          .sort({ lastSeen: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        ErrorGroup.countDocuments(query),
      ]);

      res.status(200).json({
        success: true,
        groups,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum) || 1,
        },
      });
    } catch (error: any) {
      console.error('[ErrorTrackingController] getErrorGroups error:', error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  };

  /**
   * GET /api/admin/errors/groups/:fingerprint
   * Get detailed group overview and recent occurrences
   */
  public getErrorGroupDetails = async (req: Request, res: Response): Promise<void> => {
    try {
      const { fingerprint } = req.params;
      const group = await ErrorGroup.findOne({ fingerprint }).lean();

      if (!group) {
        res.status(404).json({ success: false, message: 'Error group not found' });
        return;
      }

      const recentOccurrences = await ErrorOccurrence.find({ fingerprint })
        .sort({ timestamp: -1 })
        .limit(50)
        .lean();

      res.status(200).json({
        success: true,
        group,
        recentOccurrences,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  /**
   * PATCH /api/admin/errors/groups/:fingerprint/status
   * Update resolution status: OPEN, ACKNOWLEDGED, RESOLVED, IGNORED
   */
  public updateErrorGroupStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { fingerprint } = req.params;
      const { status } = req.body;

      if (!['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'IGNORED'].includes(status)) {
        res.status(400).json({ success: false, message: 'Invalid status' });
        return;
      }

      const updateData: Record<string, any> = { status };
      if (status === 'RESOLVED') {
        updateData.lastResolvedAt = new Date();
        updateData.isRegression = false;
      }

      const group = await ErrorGroup.findOneAndUpdate(
        { fingerprint },
        { $set: updateData },
        { new: true }
      );

      if (!group) {
        res.status(404).json({ success: false, message: 'Error group not found' });
        return;
      }

      res.status(200).json({ success: true, group });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  /**
   * POST /api/admin/errors/groups/:fingerprint/notes
   * Add an admin comment or note to the error group
   */
  public addErrorGroupNote = async (req: Request, res: Response): Promise<void> => {
    try {
      const { fingerprint } = req.params;
      const { note } = req.body;

      if (!note || typeof note !== 'string' || !note.trim()) {
        res.status(400).json({ success: false, message: 'Note text is required' });
        return;
      }

      const author = (req as any).user?.name || (req as any).user?.email || 'Admin';
      const authorId = (req as any).user?._id;

      const group = await ErrorGroup.findOneAndUpdate(
        { fingerprint },
        {
          $push: {
            notes: {
              author,
              authorId,
              note: note.trim(),
              createdAt: new Date(),
            },
          },
        },
        { new: true }
      );

      if (!group) {
        res.status(404).json({ success: false, message: 'Error group not found' });
        return;
      }

      res.status(200).json({ success: true, notes: group.notes });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  /**
   * GET /api/admin/errors/stats
   * Summary metrics & Error Health Score (0-100)
   */
  public getErrorStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const [
        totalGroups,
        openGroups,
        criticalGroups,
        regressions,
        newIn24h,
        occurrences24h,
      ] = await Promise.all([
        ErrorGroup.countDocuments({}),
        ErrorGroup.countDocuments({ status: 'OPEN' }),
        ErrorGroup.countDocuments({ status: 'OPEN', severity: 'CRITICAL' }),
        ErrorGroup.countDocuments({ isRegression: true }),
        ErrorGroup.countDocuments({ firstSeen: { $gte: last24h } }),
        ErrorOccurrence.countDocuments({ timestamp: { $gte: last24h } }),
      ]);

      // Calculate Error Health Score (0-100)
      // 100 = flawless, drops with open critical groups, regressions, and high 24h volume
      let errorHealthScore = 100;
      errorHealthScore -= Math.min(30, criticalGroups * 10);
      errorHealthScore -= Math.min(20, openGroups * 2);
      errorHealthScore -= Math.min(20, regressions * 10);
      errorHealthScore -= Math.min(30, Math.floor(occurrences24h / 50) * 5);
      errorHealthScore = Math.max(0, Math.min(100, errorHealthScore));

      res.status(200).json({
        success: true,
        stats: {
          errorHealthScore,
          totalGroups,
          openGroups,
          criticalGroups,
          regressions,
          newIn24h,
          occurrences24h,
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  };
}

export const errorTrackingController = new ErrorTrackingController();
export default errorTrackingController;
