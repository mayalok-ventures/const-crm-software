const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const AbuseLog = require('../models/AbuseLog');
const { securityTracker } = require('../monitoring/security/securityTracker');

// Only malicious violations (bulk spam, exploits) increment account abuse score
const MALICIOUS_ABUSE_TYPES = ['bulk_spam', 'exploit_attempt', 'injection_attempt', 'unauthorized_tampering'];

// Track and apply automatic suspensions based on genuine cumulative abuse
const handleAbuse = async (req, type, detail) => {
  try {
    const userId = req.user?._id || null;
    const ip = req.ip;

    // Log in Security Monitoring Engine
    securityTracker.recordEvent({
      type: 'RATE_LIMIT',
      req,
      userId,
      metadata: { abuseType: type, detail },
    });

    // Log abuse event in DB with 90-day TTL
    await AbuseLog.create({
      userId,
      ip,
      type,
      detail: `${detail} (IP: ${ip})`,
    });

    // Only genuine malicious abuse increments abuseScore towards suspension;
    // Failed passwords or standard rate limits NEVER suspend a user account.
    if (userId && MALICIOUS_ABUSE_TYPES.includes(type)) {
      // Check if user is admin to bypass
      const checkAdmin = await User.findById(userId).lean();
      if (checkAdmin && checkAdmin.isAdmin) {
        console.log(`Bypassing abuse score increment and suspension for Admin: ${userId}`);
        return;
      }

      // Increment user abuse score
      const user = await User.findByIdAndUpdate(
        userId,
        { $inc: { abuseScore: 1 } },
        { new: true }
      );

      if (user) {
        let suspendLevel = 0;
        let durationMs = 0;
        const reason = `Automated security block: ${detail}`;

        if (user.abuseScore >= 8) {
          suspendLevel = 4; // Permanent
        } else if (user.abuseScore >= 5) {
          suspendLevel = 2; // 7 days
          durationMs = 7 * 24 * 60 * 60 * 1000;
        } else if (user.abuseScore >= 3) {
          suspendLevel = 1; // 24 hours
          durationMs = 24 * 60 * 60 * 1000;
        }

        if (suspendLevel > 0) {
          const now = new Date();
          const suspendedUntil = suspendLevel === 4 ? null : new Date(now.getTime() + durationMs);

          await User.findByIdAndUpdate(userId, {
            $set: {
              'suspension.isSuspended': true,
              'suspension.level': suspendLevel,
              'suspension.reason': reason,
              'suspension.suspendedAt': now,
              'suspension.suspendedUntil': suspendedUntil,
            }
          });

          if (suspendLevel === 4) {
            const waSession = require('../services/waSession');
            await waSession.disconnect(userId).catch(() => {});
          }
        }
      }
    }
  } catch (err) {
    console.error('handleAbuse error:', err);
  }
};

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 400,
  skip: (req) => {
    if (process.env.NODE_ENV === 'test') return true;
    if (req.headers['x-test-bypass'] === 'crm-local-test') return true;
    if (process.env.NODE_ENV !== 'production' && (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1')) return true;
    return false;
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { message: 'Too many requests, please try again later.' },
  handler: (req, res) => {
    res.status(429).json({
      code: 'RATE_LIMITED',
      message: 'Too many requests from this connection. Please try again in a few moments.',
    });
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  skip: (req) => req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1',
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { message: 'Too many login attempts, please try again in 15 minutes.' },
  handler: (req, res) => {
    const resetTime = req.rateLimit?.resetTime ? new Date(req.rateLimit.resetTime) : new Date(Date.now() + 15 * 60 * 1000);
    const diffMs = resetTime.getTime() - Date.now();
    const remainingMinutes = Math.max(1, Math.ceil(diffMs / 60000));

    res.status(429).json({
      code: 'AUTH_RATE_LIMITED',
      message: `Too many login attempts. Please wait ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''} before trying again.`,
      retryAfterMinutes: remainingMinutes,
      resetTime: resetTime.toISOString(),
    });
  }
});

const bulkSendGuard = async (req, res, next) => {
  const userId = req.user?._id?.toString();
  if (!userId) return next();
  if (req.user?.isAdmin) return next();

  // MongoDB-backed bulk send protection to make it horizontally scalable
  const now = new Date();
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

  try {
    const CampaignLog = require('../models/CampaignLog');
    const recentSends = await CampaignLog.countDocuments({
      userId,
      timestamp: { $gte: tenMinutesAgo }
    });

    const maxSends = 100;
    if (recentSends >= maxSends) {
      await handleAbuse(req, 'bulk_spam', `Sent ${recentSends} messages in 10 minutes`);
      return res.status(429).json({
        message: `Anti-spam: You've sent ${recentSends} messages in the last 10 minutes. Limit is ${maxSends}. Please wait before sending more.`,
      });
    }
    next();
  } catch (error) {
    console.error('bulkSendGuard error:', error);
    next();
  }
};

const websiteFormLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 30, // 30 submissions per IP per 10 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many submissions from this IP address, please try again after 10 minutes.',
  },
});

module.exports = { apiLimiter, authLimiter, bulkSendGuard, websiteFormLimiter };
