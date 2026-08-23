const mongoose = require('mongoose');

const ApiKeyAuditLogSchema = new mongoose.Schema(
  {
    auditId: { type: String, required: true, unique: true, index: true },
    keyId: { type: String, required: true, index: true },
    keyPrefix: { type: String, required: true },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: {
      type: String,
      required: true,
      index: true,
    },
    performedBy: { type: String, default: 'System' },
    ipAddress: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ApiKeyAuditLogSchema.index({ keyId: 1, createdAt: -1 });
ApiKeyAuditLogSchema.index({ organizationId: 1, createdAt: -1 });

const ApiKeyAuditLogModel = mongoose.models.ApiKeyAuditLog || mongoose.model('ApiKeyAuditLog', ApiKeyAuditLogSchema);
ApiKeyAuditLogModel.ApiKeyAuditLog = ApiKeyAuditLogModel;
ApiKeyAuditLogModel.default = ApiKeyAuditLogModel;
module.exports = ApiKeyAuditLogModel;
module.exports.ApiKeyAuditLog = ApiKeyAuditLogModel;
module.exports.default = ApiKeyAuditLogModel;
