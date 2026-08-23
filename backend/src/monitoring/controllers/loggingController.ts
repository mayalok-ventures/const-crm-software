import { Request, Response } from 'express';
import { SystemLog } from '../models/SystemLog';
import { logger } from '../logging/logger';

export class LoggingController {
  /**
   * GET /api/admin/logs
   * Query filterable structured system logs with pagination
   */
  public getLogs = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        level,
        service,
        module: logModule,
        server,
        dateFrom,
        dateTo,
        requestId,
        userId,
        search,
        page = '1',
        limit = '50',
      } = req.query;

      const query: Record<string, any> = {};

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
        if (dateFrom) query.timestamp.$gte = new Date(String(dateFrom));
        if (dateTo) query.timestamp.$lte = new Date(String(dateTo));
      }

      if (search) {
        query.message = { $regex: String(search), $options: 'i' };
      }

      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const limitNum = Math.min(200, Math.max(1, parseInt(String(limit), 10) || 50));
      const skip = (pageNum - 1) * limitNum;

      const [logs, total] = await Promise.all([
        SystemLog.find(query)
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        SystemLog.countDocuments(query),
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
    } catch (error: any) {
      console.error('[LoggingController] getLogs error:', error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  };

  /**
   * GET /api/admin/logs/stream
   * Fetch in-memory ring-buffer for live stream visualization
   */
  public getLiveStream = async (req: Request, res: Response): Promise<void> => {
    try {
      const limit = parseInt(String(req.query.limit || '100'), 10);
      const liveLogs = logger.getLiveStream(limit);
      res.status(200).json({ success: true, logs: liveLogs });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  /**
   * GET /api/admin/logs/:id
   * Get complete log item by ID
   */
  public getLogById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const log = await SystemLog.findById(id).lean();
      if (!log) {
        res.status(404).json({ success: false, message: 'Log not found' });
        return;
      }
      res.status(200).json({ success: true, log });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  };
}

export const loggingController = new LoggingController();
export default loggingController;
