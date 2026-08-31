const mongoose = require('mongoose');

/**
 * Subscription Schema (Recurring Billing Relationship)
 * Manages the recurring billing lifecycle, Razorpay Subscriptions/e-Mandates,
 * proration state machines, concurrency locks, and grace periods.
 */
const subscriptionSchema = new mongoose.Schema(
  {
    // Tenant identity (either an Individual user or Company Owner)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Company / Agency ID for multi-tenant organizations
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    accountType: {
      type: String,
      required: true,
      enum: ['INDIVIDUAL', 'ORGANIZATION'],
      index: true,
    },
    // Reference to current active plan
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan',
      required: true,
      index: true,
    },
    // Quantity of seats (for Organization plans; 1 for Individual)
    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },
    provider: {
      type: String,
      enum: ['razorpay', 'manual', 'stripe', 'other'],
      default: 'razorpay',
      index: true,
    },
    providerPlanId: {
      type: String,
      trim: true,
      default: null,
    },
    // Razorpay Subscription ID (e.g. sub_00000000000001)
    razorpaySubscriptionId: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
      index: true,
    },
    // Razorpay Customer ID (e.g. cust_00000000000001)
    razorpayCustomerId: {
      type: String,
      trim: true,
      index: true,
    },
    amount: {
      type: Number,
      default: 0,
    },
    amountInPaise: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'yearly'],
      default: 'monthly',
    },
    // Lifecycle Status Machine
    status: {
      type: String,
      required: true,
      enum: [
        'CREATED',          // Mandate link created, awaiting customer bank authorization
        'AUTHENTICATED',    // Mandate approved by bank, initial charge pending
        'ACTIVE',           // In good standing, fully entitled
        'GRACE_PERIOD',     // Renewal failed; in 3-day recovery window with warning banners
        'PLAN_LOCKED',      // Grace window elapsed; WhatsApp send, export & lead add locked
        'PAST_DUE',         // Retries exhausted
        'PAUSED',           // Temporarily paused
        'CANCELLED',        // Explicitly cancelled by user or SuperAdmin
        'EXPIRED',          // Terminated after validity
        'COMPLETED',        // Fixed tenure completed
        'ARCHIVED',         // Purged/archived after 60+ days of inactive lock
      ],
      default: 'CREATED',
      index: true,
    },
    // Reconciliation telemetry
    reconciliationStatus: {
      type: String,
      enum: ['MATCHED', 'MISMATCHED', 'RECOVERABLE', 'MANUAL_REVIEW', 'LAST_RECONCILED', 'RECONCILIATION_REQUIRED', 'RECONCILIATION_FAILED'],
      default: 'MATCHED',
      index: true,
    },
    lastReconciledAt: {
      type: Date,
      default: null,
    },
    reconciliationNotes: {
      type: String,
      default: null,
    },
    trialStart: {
      type: Date,
      default: null,
    },
    trialEnd: {
      type: Date,
      default: null,
    },
    pausedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    nextBillingAt: {
      type: Date,
      default: null,
    },
    lastEventTimestamp: {
      type: Date,
      default: null,
    },
    eventVersion: {
      type: Number,
      default: 1,
    },
    lastWebhookEvent: {
      type: String,
      default: null,
    },
    // Dynamic Plan Versioning & Entitlement Snapshot
    planVersion: {
      type: Number,
      default: 1,
    },
    billingInterval: {
      type: String,
      enum: ['monthly', 'yearly'],
      default: function() { return this.billingCycle || 'monthly'; },
    },
    entitlementSnapshot: {
      limits: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
      features: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
      whatsIncluded: [
        {
          type: String,
        },
      ],
      snapshotCreatedAt: {
        type: Date,
        default: Date.now,
      },
    },
    // Period Timestamps
    currentPeriodStart: {
      type: Date,
      default: Date.now,
    },
    currentPeriodEnd: {
      type: Date,
      required: true,
      index: true,
    },
    // Grace period deadline (CurrentPeriodEnd + 3 days)
    gracePeriodEnd: {
      type: Date,
      default: null,
    },
    // Scheduled cancellation at period end
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancellationReason: {
      type: String,
      trim: true,
      default: null,
    },
    // Concurrency Lock: Prevents double-tab / concurrent billing mutations
    billingLock: {
      type: Boolean,
      default: false,
      index: true,
    },
    billingLockAcquiredAt: {
      type: Date,
      default: null,
    },
    // Pending Subscription Change (Scheduled Downgrade or Proration Queue)
    pendingChange: {
      targetPlanId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Plan',
        default: null,
      },
      targetQuantity: {
        type: Number,
        default: null,
      },
      changeType: {
        type: String,
        enum: ['UPGRADE', 'DOWNGRADE', 'SEAT_ADJUSTMENT', null],
        default: null,
      },
      requestedAt: {
        type: Date,
        default: null,
      },
      effectiveDate: {
        type: Date,
        default: null,
      },
      prorationSummary: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
      },
    },
    // Payment failure retry counters
    retryCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastPaymentStatus: {
      type: String,
      enum: ['captured', 'failed', 'pending', null],
      default: null,
    },
    lastPaymentDate: {
      type: Date,
      default: null,
    },
    lastPaymentError: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // SuperAdmin Administrative Overrides & Lifetime Grants
    superadminOverride: {
      isOverridden: {
        type: Boolean,
        default: false,
        index: true,
      },
      overriddenBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      overrideReason: {
        type: String,
        default: null,
      },
      overrideExpiresAt: {
        type: Date,
        default: null,
      },
      isLifetimeFree: {
        type: Boolean,
        default: false,
      },
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// High-performance compound indexes for multi-tenant authorization
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ companyId: 1, status: 1 });
subscriptionSchema.index({ currentPeriodEnd: 1, status: 1 });

module.exports = mongoose.models.Subscription || mongoose.model('Subscription', subscriptionSchema);
