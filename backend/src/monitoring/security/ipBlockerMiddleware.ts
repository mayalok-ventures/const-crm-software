import { Request, Response, NextFunction } from 'express';
import { BlockedIP } from '../models/BlockedIP';

class IpBlockerEngine {
  private blockedIpsSet: Set<string> = new Set();
  private isInitialized = false;
  private syncTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.initSync();
  }

  public async initSync(): Promise<void> {
    try {
      const activeBlocks = await BlockedIP.find({
        isActive: true,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
      })
        .select('ip')
        .lean();

      this.blockedIpsSet.clear();
      activeBlocks.forEach((b: any) => {
        if (b.ip) this.blockedIpsSet.add(b.ip);
      });

      this.isInitialized = true;

      // Periodic synchronization every 30 seconds
      if (!this.syncTimer) {
        this.syncTimer = setInterval(() => {
          this.refreshBlockedIps().catch(() => {});
        }, 30000);
      }
    } catch (err: any) {
      // If DB not ready yet, keep going
    }
  }

  public async refreshBlockedIps(): Promise<void> {
    try {
      const activeBlocks = await BlockedIP.find({
        isActive: true,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
      })
        .select('ip')
        .lean();

      const newSet = new Set<string>();
      activeBlocks.forEach((b: any) => {
        if (b.ip) newSet.add(b.ip);
      });

      this.blockedIpsSet = newSet;
    } catch (err) {
      // ignore refresh errors
    }
  }

  public isIpBlocked(ip: string): boolean {
    if (!ip) return false;
    return this.blockedIpsSet.has(ip);
  }

  public async blockIp(
    ip: string,
    reason: string,
    blockedBy: 'SYSTEM_AUTO' | 'ADMIN' = 'SYSTEM_AUTO',
    durationMinutes: number | null = 60,
    adminUser?: { id: string; email: string }
  ): Promise<void> {
    if (!ip) return;

    // Calculate expiry
    const expiresAt = durationMinutes ? new Date(Date.now() + durationMinutes * 60 * 1000) : null;

    // Add to in-memory cache immediately
    this.blockedIpsSet.add(ip);

    // Save/Update in MongoDB if connected
    if (BlockedIP.db?.readyState === 1) {
      await BlockedIP.findOneAndUpdate(
        { ip },
        {
          $set: {
            ip,
            reason,
            blockedBy,
            adminUserId: adminUser?.id || null,
            adminEmail: adminUser?.email || null,
            expiresAt,
            isActive: true,
            lastAttemptAt: new Date(),
          },
        },
        { upsert: true, new: true }
      );
    }
  }

  public async unblockIp(ip: string): Promise<boolean> {
    if (!ip) return false;

    // Remove from in-memory set immediately
    this.blockedIpsSet.delete(ip);

    // Update in MongoDB if connected
    if (BlockedIP.db?.readyState === 1) {
      await BlockedIP.findOneAndUpdate(
        { ip },
        { $set: { isActive: false, expiresAt: new Date() } }
      );
    }

    return true;
  }

  /**
   * Express middleware to intercept and reject traffic from blacklisted IPs
   */
  public middleware = (req: Request, res: Response, next: NextFunction): void => {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

    if (this.isIpBlocked(clientIp)) {
      // Async update hit count in background
      BlockedIP.updateOne(
        { ip: clientIp, isActive: true },
        { $inc: { hitCount: 1 }, $set: { lastAttemptAt: new Date() } }
      ).catch(() => {});

      res.status(403).json({
        success: false,
        error: 'ACCESS_DENIED_BLOCKED_IP',
        message: 'Your IP address has been temporarily restricted due to security policy violations.',
      });
      return;
    }

    next();
  };
}

export const ipBlocker = new IpBlockerEngine();
