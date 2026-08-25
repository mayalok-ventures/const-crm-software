"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ipBlocker = void 0;
const BlockedIP_1 = require("../models/BlockedIP");
class IpBlockerEngine {
    blockedIpsSet = new Set();
    isInitialized = false;
    syncTimer = null;
    constructor() {
        this.initSync();
    }
    async initSync() {
        try {
            const activeBlocks = await BlockedIP_1.BlockedIP.find({
                isActive: true,
                $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
            })
                .select('ip')
                .lean();
            this.blockedIpsSet.clear();
            activeBlocks.forEach((b) => {
                if (b.ip)
                    this.blockedIpsSet.add(b.ip);
            });
            this.isInitialized = true;
            // Periodic synchronization every 30 seconds
            if (!this.syncTimer) {
                this.syncTimer = setInterval(() => {
                    this.refreshBlockedIps().catch(() => { });
                }, 30000);
            }
        }
        catch (err) {
            // If DB not ready yet, keep going
        }
    }
    async refreshBlockedIps() {
        try {
            const activeBlocks = await BlockedIP_1.BlockedIP.find({
                isActive: true,
                $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
            })
                .select('ip')
                .lean();
            const newSet = new Set();
            activeBlocks.forEach((b) => {
                if (b.ip)
                    newSet.add(b.ip);
            });
            this.blockedIpsSet = newSet;
        }
        catch (err) {
            // ignore refresh errors
        }
    }
    isIpBlocked(ip) {
        if (!ip)
            return false;
        if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost' || ip === '::ffff:127.0.0.1')
            return false;
        return this.blockedIpsSet.has(ip);
    }
    async blockIp(ip, reason, blockedBy = 'SYSTEM_AUTO', durationMinutes = 60, adminUser) {
        if (!ip || ip === '127.0.0.1' || ip === '::1' || ip === 'localhost' || ip === '::ffff:127.0.0.1')
            return;
        // Calculate expiry
        const expiresAt = durationMinutes ? new Date(Date.now() + durationMinutes * 60 * 1000) : null;
        // Add to in-memory cache immediately
        this.blockedIpsSet.add(ip);
        // Save/Update in MongoDB if connected
        if (BlockedIP_1.BlockedIP.db?.readyState === 1) {
            await BlockedIP_1.BlockedIP.findOneAndUpdate({ ip }, {
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
            }, { upsert: true, new: true });
        }
    }
    async unblockIp(ip) {
        if (!ip)
            return false;
        // Remove from in-memory set immediately
        this.blockedIpsSet.delete(ip);
        // Update in MongoDB if connected
        if (BlockedIP_1.BlockedIP.db?.readyState === 1) {
            await BlockedIP_1.BlockedIP.findOneAndUpdate({ ip }, { $set: { isActive: false, expiresAt: new Date() } });
        }
        return true;
    }
    /**
     * Express middleware to intercept and reject traffic from blacklisted IPs
     */
    middleware = (req, res, next) => {
        const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
        if (this.isIpBlocked(clientIp)) {
            // Async update hit count in background
            BlockedIP_1.BlockedIP.updateOne({ ip: clientIp, isActive: true }, { $inc: { hitCount: 1 }, $set: { lastAttemptAt: new Date() } }).catch(() => { });
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
exports.ipBlocker = new IpBlockerEngine();
