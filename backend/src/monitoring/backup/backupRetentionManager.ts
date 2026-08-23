/**
 * BACKUP RETENTION POLICY MANAGER
 * Manages retention lifecycles:
 * - Scans records with expired retention windows (retentionExpiresAt <= now)
 * - Transitions status to 'EXPIRED' and updates isRetained = false
 * - Preserves compliance audit metadata while retiring stale backups
 */

import BackupRecord from '../models/BackupRecord';

export class BackupRetentionManager {
  private static instance: BackupRetentionManager;

  public static getInstance(): BackupRetentionManager {
    if (!BackupRetentionManager.instance) {
      BackupRetentionManager.instance = new BackupRetentionManager();
    }
    return BackupRetentionManager.instance;
  }

  /**
   * Evaluates and applies retention policies against stored backup records
   */
  public async pruneExpiredBackups(): Promise<{ expiredCount: number; errors: string[] }> {
    const errors: string[] = [];
    let expiredCount = 0;

    try {
      const now = new Date();
      const expiredRecords = await BackupRecord.find({
        retentionExpiresAt: { $lte: now },
        status: { $ne: 'EXPIRED' },
      }).limit(50);

      for (const record of expiredRecords) {
        try {
          record.status = 'EXPIRED';
          record.isRetained = false;
          await record.save();
          expiredCount++;
        } catch (saveErr: any) {
          errors.push(`Failed to expire backup ${record.backupId}: ${saveErr.message}`);
        }
      }
    } catch (err: any) {
      errors.push(`Retention prune error: ${err.message}`);
    }

    return { expiredCount, errors };
  }
}

export const backupRetentionManager = BackupRetentionManager.getInstance();
