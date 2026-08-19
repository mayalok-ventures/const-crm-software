const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Calculates the multi-tenant subscription lifecycle:
 * - If sub-agent: derived from Company Owner's planEndDate
 * - >7 days left: ACTIVE
 * - 0 to 7 days left: EXPIRING_SOON (amber warning banner)
 * - 0 to -3 days overdue: GRACE_PERIOD (red pulsating warning banner, read/write enabled)
 * - <-3 days overdue: LOCKED (strict 403 on all mutating requests except payments)
 */
const calculateSubscriptionLifecycle = async (user) => {
  if (!user || user.isAdmin || user.role === 'superadmin') {
    return {
      state: 'ACTIVE',
      daysLeft: 999,
      graceDaysLeft: null,
      isExpiringSoon: false,
      isGracePeriod: false,
      isLocked: false,
      effectivePlan: user?.plan || 'pro',
      isSubAgent: false,
      companyName: null,
    };
  }

  const isSubAgent = user.companyRole === 'agent' && Boolean(user.companyId);
  let companyOwner = null;

  if (isSubAgent) {
    companyOwner = await User.findById(user.companyId).select('name companyInfo plan planEndDate billingCycle').lean();
  }

  const effectivePlan = isSubAgent ? (companyOwner?.plan || 'free') : (user.plan || 'free');
  const effectiveEndDate = isSubAgent ? companyOwner?.planEndDate : user.planEndDate;
  const companyName = companyOwner?.companyInfo?.companyName || companyOwner?.name || null;

  let state = 'ACTIVE';
  let daysLeft = null;
  let graceDaysLeft = null;

  if (effectiveEndDate) {
    const diffMs = new Date(effectiveEndDate).getTime() - Date.now();
    daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (daysLeft > 7) {
      state = 'ACTIVE';
    } else if (daysLeft > 0 && daysLeft <= 7) {
      state = 'EXPIRING_SOON';
    } else if (daysLeft <= 0 && daysLeft >= -3) {
      state = 'GRACE_PERIOD';
      graceDaysLeft = Math.max(0, 3 + daysLeft); // 0 to 3 days remaining before hard lockout
    } else {
      state = 'LOCKED';
      graceDaysLeft = 0;
    }
  } else if (effectivePlan === 'free') {
    state = 'ACTIVE';
  }

  return {
    state,
    daysLeft,
    graceDaysLeft,
    isExpiringSoon: state === 'EXPIRING_SOON',
    isGracePeriod: state === 'GRACE_PERIOD',
    isLocked: state === 'LOCKED',
    effectivePlan,
    effectiveEndDate,
    isSubAgent,
    companyName,
    companyOwnerId: isSubAgent ? user.companyId : null,
  };
};

const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.query.token) {
      token = req.query.token;
    }
    if (!token) return res.status(401).json({ message: 'Not authorized, no token' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.pending2FA) {
      return res.status(401).json({ message: 'Two-Factor Authentication required to access this endpoint.' });
    }

    const user = await User.findById(decoded.id).select('-password').lean();

    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Not authorized, account inactive' });
    }

    // Suspension check
    if (user.suspension?.isSuspended && !user.isAdmin) {
      const until = user.suspension.suspendedUntil;
      if (until && new Date() > new Date(until)) {
        await User.findByIdAndUpdate(user._id, {
          $set: {
            'suspension.isSuspended': false,
            'suspension.level': 0,
            'suspension.reason': null,
            'suspension.suspendedUntil': null,
          }
        });
      } else {
        const msg = until
          ? `Account suspended until ${new Date(until).toLocaleDateString()}. Reason: ${user.suspension.reason || 'Violation'}.`
          : `Account permanently banned. Reason: ${user.suspension.reason || 'Violation'}. Contact admin.`;
        return res.status(403).json({ code: 'SUSPENDED', message: msg, suspendedUntil: until });
      }
    }

    // Calculate Multi-Tenant Subscription Lifecycle
    const lifecycle = await calculateSubscriptionLifecycle(user);
    user.subscriptionLifecycle = lifecycle;
    req.user = user;

    // ─────────────────────────────────────────────────────────────
    // MULTI-TENANT 3-DAY GRACE PERIOD & HARD LOCKOUT ENFORCEMENT
    // ─────────────────────────────────────────────────────────────
    if (!user.isAdmin && lifecycle.isLocked) {
      const isPaymentOrAuthRoute =
        req.baseUrl.includes('/payments') ||
        req.baseUrl.includes('/auth') ||
        req.path.includes('/payments') ||
        req.path.includes('/apply-coupon') ||
        req.path.includes('/validate-coupon');

      // GET requests and payment/auth routes are permitted during lockout
      if (req.method !== 'GET' && !isPaymentOrAuthRoute) {
        const lockMessage = lifecycle.isSubAgent
          ? `Your organization's subscription has expired and the grace period has ended. Please ask your Organization Owner (${lifecycle.companyName || 'Owner'}) to renew the plan.`
          : 'Your subscription grace period has ended and your account is locked. Please renew your plan to restore full access.';

        return res.status(403).json({
          code: 'PLAN_LOCKED',
          message: lockMessage,
          daysOverdue: Math.abs(lifecycle.daysLeft || 0),
          isSubAgent: lifecycle.isSubAgent,
          companyName: lifecycle.companyName,
          expiryDate: lifecycle.effectiveEndDate,
        });
      }
    }

    next();
  } catch (error) {
    res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

const adminOnly = (req, res, next) => {
  if (!req.user || (!req.user.isAdmin && req.user.role !== 'superadmin')) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

const checkPlanExpiry = async (req, res, next) => {
  const user = req.user;
  if (!user) return res.status(401).json({ message: 'Not authorized' });
  if (user.isAdmin || user.role === 'superadmin') return next();

  const lifecycle = user.subscriptionLifecycle || await calculateSubscriptionLifecycle(user);

  if (lifecycle.isLocked) {
    const isPaymentOrAuthRoute =
      req.baseUrl?.includes('/payments') ||
      req.baseUrl?.includes('/auth') ||
      req.path?.includes('/payments') ||
      req.path?.includes('/apply-coupon') ||
      req.path?.includes('/validate-coupon');

    if (req.method !== 'GET' && !isPaymentOrAuthRoute) {
      return res.status(403).json({
        code: 'PLAN_LOCKED',
        message: lifecycle.isSubAgent
          ? "Your organization's plan has expired. Please contact your organization owner to renew."
          : "Your plan grace period has ended. Please renew to continue.",
        daysOverdue: Math.abs(lifecycle.daysLeft || 0),
        expiryDate: lifecycle.effectiveEndDate,
      });
    }
  }

  next();
};

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

const generateTemp2FAToken = (userId) => {
  return jwt.sign({ id: userId, pending2FA: true }, process.env.JWT_SECRET, { expiresIn: '10m' });
};

const optionalAuth = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded && decoded.id) {
      const user = await User.findById(decoded.id).select('-password').lean();
      if (user && user.isActive) {
        req.user = user;
      }
    }
  } catch (e) {
    // Ignore invalid token and continue as guest
  }
  next();
};

module.exports = {
  protect,
  optionalAuth,
  adminOnly,
  checkPlanExpiry,
  calculateSubscriptionLifecycle,
  generateToken,
  generateTemp2FAToken,
};

