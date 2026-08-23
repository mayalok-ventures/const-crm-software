"use strict";
/**
 * BACKUP RETENTION POLICY MANAGER
 * Manages retention lifecycles:
 * - Scans records with expired retention windows (retentionExpiresAt <= now)
 * - Transitions status to 'EXPIRED' and updates isRetained = false
 * - Preserves compliance audit metadata while retiring stale backups
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.backupRetentionManager = exports.BackupRetentionManager = void 0;
const BackupRecord_1 = __importDefault(require("../models/BackupRecord"));
class BackupRetentionManager {
    static instance;
    static getInstance() {
        if (!BackupRetentionManager.instance) {
            BackupRetentionManager.instance = new BackupRetentionManager();
        }
        return BackupRetentionManager.instance;
    }
    /**
     * Evaluates and applies retention policies against stored backup records
     */
    async pruneExpiredBackups() {
        const errors = [];
        let expiredCount = 0;
        try {
            const now = new Date();
            const expiredRecords = await BackupRecord_1.default.find({
                retentionExpiresAt: { $lte: now },
                status: { $ne: 'EXPIRED' },
            }).limit(50);
            for (const record of expiredRecords) {
                try {
                    record.status = 'EXPIRED';
                    record.isRetained = false;
                    await record.save();
                    expiredCount++;
                }
                catch (saveErr) {
                    errors.push(`Failed to expire backup ${record.backupId}: ${saveErr.message}`);
                }
            }
        }
        catch (err) {
            errors.push(`Retention prune error: ${err.message}`);
        }
        return { expiredCount, errors };
    }
}
exports.BackupRetentionManager = BackupRetentionManager;
exports.backupRetentionManager = BackupRetentionManager.getInstance();
