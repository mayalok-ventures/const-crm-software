const Subscription = require('../models/Subscription');
const Entitlement = require('../models/Entitlement');
const Plan = require('../models/Plan');
const AuditLog = require('../models/AuditLog');
const WAFingerprint = require('../models/WAFingerprint');
const User = require('../models/User');

/**
 * Enterprise Subscription Lifecycle & End-of-Cycle Worker
 * Runs periodically to process scheduled downgrades, grace period expiries,
 * quota drips, and archival.
 */
const processSubscriptionLifecycle = async () => {
  const now = new Date();

  // ── 1. EXECUTE SCHEDULED DOWNGRADES AT END OF CYCLE ───────────────────────
  try {
    const pendingDowngrades = await Subscription.find({
      status: 'ACTIVE',
      'pendingChange.effectiveDate': { $lte: now },
      'pendingChange.targetPlanId': { $ne: null },
    }).populate('pendingChange.targetPlanId');

    for (const sub of pendingDowngrades) {
      const targetPlan = sub.pendingChange.targetPlanId;
      if (!targetPlan) continue;

      const previousPlanId = sub.planId;
      const targetQuantity = sub.pendingChange.targetQuantity || sub.quantity || 1;

      console.log(`[Billing Engine] Executing scheduled downgrade for user ${sub.userId} -> Plan ${targetPlan.code}`);

      sub.planId = targetPlan._id;
      sub.quantity = targetQuantity;
      sub.currentPeriodStart = now;
      sub.currentPeriodEnd = new Date(now.getTime() + (targetPlan.interval === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000);
      sub.pendingChange = { targetPlanId: null, targetQuantity: null, changeType: null, requestedAt: null, effectiveDate: null, prorationSummary: null };
      await sub.save();

      // Refresh Entitlements to match the new downgraded plan
      await Entitlement.findOneAndUpdate(
        { userId: sub.userId },
        {
          $set: {
            accountType: sub.accountType,
            status: 'ACTIVE',
            'seats.maxAllowed': targetQuantity,
            'leads.maxAllowed': targetPlan.defaultEntitlements?.maxLeads || 500,
            'whatsapp.monthlyLimit': targetPlan.defaultEntitlements?.monthlyWAQuota || 1000,
            'whatsapp.quotaResetDate': sub.currentPeriodEnd,
            'whatsapp.isDripEnabled': !!targetPlan.defaultEntitlements?.isDripEnabled,
            'whatsapp.totalAnnualQuota': targetPlan.defaultEntitlements?.totalAnnualQuota || 0,
            features: targetPlan.defaultEntitlements?.features || {},
          },
        }
      );

      // Sync User document
      const planSlug = targetPlan.tier === 3 ? 'enterprise' : (targetPlan.tier === 2 ? 'pro' : 'starter');
      await User.findByIdAndUpdate(sub.userId, {
        $set: {
          plan: planSlug,
          planStartDate: sub.currentPeriodStart,
          planEndDate: sub.currentPeriodEnd,
        },
      });

      await AuditLog.create({
        actorRole: 'system',
        targetUserId: sub.userId,
        targetCompanyId: sub.companyId,
        action: 'SUBSCRIPTION_DOWNGRADE_SCHEDULED',
        beforeState: { planId: previousPlanId },
        afterState: { planId: targetPlan._id, code: targetPlan.code },
        reason: 'Scheduled downgrade executed at end of billing cycle.',
      });
    }
  } catch (err) {
    console.error('[Billing Engine] Error processing scheduled downgrades:', err.message);
  }

  // ── 2. ENFORCE GRACE PERIOD EXPIRATION -> PLAN_LOCKED ──────────────────────
  try {
    const expiredGraceSubs = await Subscription.find({
      status: 'GRACE_PERIOD',
      gracePeriodEnd: { $lte: now },
    });

    for (const sub of expiredGraceSubs) {
      console.log(`[Billing Engine] Grace period expired for user ${sub.userId}. Transitioning to PLAN_LOCKED.`);

      sub.status = 'PLAN_LOCKED';
      await sub.save();

      // Lock Entitlements (Suspends WhatsApp messaging, data exports, lead creations)
      await Entitlement.findOneAndUpdate(
        { userId: sub.userId },
        { $set: { status: 'LOCKED' } }
      );

      // Fingerprint WhatsApp number with 90-day cooldown to prevent churn & clone fraud
      const user = await User.findById(sub.userId).select('phone').lean();
      if (user && user.phone) {
        const cleanPhone = String(user.phone).replace(/\D/g, '');
        if (cleanPhone.length >= 7) {
          await WAFingerprint.findOneAndUpdate(
            { phone: cleanPhone },
            {
              $set: {
                phone: cleanPhone,
                bannedFromUserId: sub.userId,
                bannedFromCompanyId: sub.companyId,
                reason: 'PAYMENT_DEFAULT',
                cooldownUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
                riskScore: 85,
                unbannedAt: null,
              },
            },
            { upsert: true }
          );
        }
      }

      await AuditLog.create({
        actorRole: 'system',
        targetUserId: sub.userId,
        targetCompanyId: sub.companyId,
        action: 'SUBSCRIPTION_LOCKED',
        reason: '3-day grace period elapsed without payment resolution. WhatsApp send, export & lead add locked.',
      });
    }
  } catch (err) {
    console.error('[Billing Engine] Error processing grace periods:', err.message);
  }

  // ── 3. EXECUTE PERIOD-END CANCELLATIONS ────────────────────────────────────
  try {
    const expiredCancellations = await Subscription.find({
      status: 'ACTIVE',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: { $lte: now },
    });

    for (const sub of expiredCancellations) {
      console.log(`[Billing Engine] Terminating period-end cancelled subscription for user ${sub.userId}`);

      sub.status = 'CANCELLED';
      await sub.save();

      await Entitlement.findOneAndUpdate(
        { userId: sub.userId },
        { $set: { status: 'RESTRICTED' } }
      );
    }
  } catch (err) {
    console.error('[Billing Engine] Error processing period-end cancellations:', err.message);
  }

  // ── 4. ANNUAL PLAN MONTHLY FEATURE DRIP ENGINE ─────────────────────────────
  try {
    const dueDrips = await Entitlement.find({
      status: 'ACTIVE',
      'whatsapp.isDripEnabled': true,
      'whatsapp.nextDripDate': { $lte: now },
    });

    for (const ent of dueDrips) {
      const monthly = ent.whatsapp?.monthlyLimit || 1000;
      const totalAnnual = ent.whatsapp?.totalAnnualQuota || (monthly * 12);
      const currentAccumulator = ent.whatsapp?.drippedQuotaAccumulator || 0;
      const remainingAnnual = Math.max(0, totalAnnual - currentAccumulator);
      const dripAmount = Math.min(monthly, remainingAnnual);

      ent.whatsapp.drippedQuotaAccumulator = currentAccumulator + dripAmount;
      ent.whatsapp.nextDripDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      await ent.save();
    }
  } catch (dripErr) {
    console.error('[Billing Engine] Error processing feature drips:', dripErr.message);
  }

  // ── 5. RUN PERIODIC RECONCILIATION BATCH ─────────────────────────────────
  try {
    const { runPeriodicReconciliation } = require('./reconciliationService');
    const recSummary = await runPeriodicReconciliation({ batchSize: 50 });
    if (recSummary.healedCount > 0 || recSummary.mismatchedCount > 0) {
      console.log(`[Billing Engine] Periodic Reconciliation: Reconciled ${recSummary.reconciledCount}, Healed ${recSummary.healedCount}, Flagged Mismatch ${recSummary.mismatchedCount}`);
    }
  } catch (recErr) {
    console.warn('[Billing Engine] Notice: Reconciliation batch note:', recErr.message);
  }
};

module.exports = { processSubscriptionLifecycle };
