const mongoose = require('mongoose');

/**
 * WAFingerprint Schema (Anti-Fraud WhatsApp Cooldown & Fingerprinting Engine)
 * Prevents churn & clone fraud by tracking WhatsApp numbers associated with
 * defaulted, banned, or chargeback-risk accounts, enforcing a strict 90-day cooldown.
 */
const waFingerprintSchema = new mongoose.Schema(
  {
    // Clean normalized phone number in E.164 format (e.g. 919876543210)
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    bannedFromUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    bannedFromCompanyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reason: {
      type: String,
      required: true,
      enum: ['PAYMENT_DEFAULT', 'CHARGEBACK', 'SPAM_ABUSE', 'FRAUD_CLONE', 'EXPIRED_LOCK'],
      index: true,
    },
    // Enforced 90-day cooldown period
    cooldownUntil: {
      type: Date,
      required: true,
      index: true,
    },
    isPermabanned: {
      type: Boolean,
      default: false,
    },
    riskScore: {
      type: Number,
      default: 80,
      min: 0,
      max: 100,
    },
    unbannedAt: {
      type: Date,
      default: null,
    },
    unbannedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

waFingerprintSchema.index({ phone: 1, cooldownUntil: 1 });

module.exports = mongoose.models.WAFingerprint || mongoose.model('WAFingerprint', waFingerprintSchema);
