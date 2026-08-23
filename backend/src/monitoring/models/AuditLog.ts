import mongoose, { Schema, Document } from 'mongoose';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'EXPORT'
  | 'IMPORT'
  | 'ROLE_CHANGE'
  | 'PERMISSION_CHANGE'
  | 'PASSWORD_CHANGE'
  | 'SETTINGS_CHANGE'
  | 'API_KEY_CREATE'
  | 'API_KEY_REVOKE';

export interface IFieldChange {
  from: any;
  to: any;
}

export interface IAuditLog extends Document {
  actorId?: mongoose.Types.ObjectId | string;
  actorName?: string;
  actorEmail?: string;
  actorRole?: string;
  organizationId?: mongoose.Types.ObjectId | string;
  action: AuditAction;
  resourceType: string;
  resourceId?: string;
  resourceName?: string;
  before?: Record<string, any>;
  after?: Record<string, any>;
  changes?: Record<string, IFieldChange>;
  requestId?: string;
  timestamp: Date;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  retentionCategory: 'ACTIVE' | 'ARCHIVED';
  createdAt: Date;
}

const AuditLogSchema: Schema = new Schema(
  {
    actorId: {
      type: Schema.Types.Mixed,
      default: null,
      index: true,
    },
    actorName: {
      type: String,
      default: null,
      trim: true,
    },
    actorEmail: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    actorRole: {
      type: String,
      default: 'user',
      index: true,
    },
    organizationId: {
      type: Schema.Types.Mixed,
      default: null,
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        'CREATE',
        'UPDATE',
        'DELETE',
        'LOGIN',
        'LOGOUT',
        'EXPORT',
        'IMPORT',
        'ROLE_CHANGE',
        'PERMISSION_CHANGE',
        'PASSWORD_CHANGE',
        'SETTINGS_CHANGE',
        'API_KEY_CREATE',
        'API_KEY_REVOKE',
      ],
      index: true,
    },
    resourceType: {
      type: String,
      required: true,
      index: true,
    },
    resourceId: {
      type: String,
      default: null,
      index: true,
    },
    resourceName: {
      type: String,
      default: null,
      trim: true,
    },
    before: {
      type: Schema.Types.Mixed,
      default: null,
    },
    after: {
      type: Schema.Types.Mixed,
      default: null,
    },
    changes: {
      type: Schema.Types.Mixed,
      default: {},
    },
    requestId: {
      type: String,
      default: null,
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    ip: {
      type: String,
      default: null,
      trim: true,
    },
    userAgent: {
      type: String,
      default: null,
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    retentionCategory: {
      type: String,
      enum: ['ACTIVE', 'ARCHIVED'],
      default: 'ACTIVE',
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Disallow automatic updatedAt modification
  }
);

// ─────────────────────────────────────────────────────────────
// STRICT IMMUTABILITY ENFORCEMENT HOOKS
// ─────────────────────────────────────────────────────────────

const immutabilityError = () =>
  new Error('IMMUTABILITY_VIOLATION: AuditLog records are strictly append-only and cannot be modified or deleted.');

// Block query-level mutations
AuditLogSchema.pre('updateOne', function () {
  throw immutabilityError();
});
AuditLogSchema.pre('updateMany', function () {
  throw immutabilityError();
});
AuditLogSchema.pre('findOneAndUpdate', function () {
  throw immutabilityError();
});
AuditLogSchema.pre('replaceOne', function () {
  throw immutabilityError();
});
AuditLogSchema.pre('deleteOne', function () {
  throw immutabilityError();
});
AuditLogSchema.pre('deleteMany', function () {
  throw immutabilityError();
});
AuditLogSchema.pre('findOneAndDelete', function () {
  throw immutabilityError();
});

// Block document-level post-creation updates
AuditLogSchema.pre('save', function (next) {
  if (!this.isNew) {
    return next(immutabilityError());
  }
  next();
});

// Compound Indexes for fast compliance audits & tenant queries
AuditLogSchema.index({ organizationId: 1, timestamp: -1 });
AuditLogSchema.index({ resourceType: 1, resourceId: 1, timestamp: -1 });
AuditLogSchema.index({ actorId: 1, timestamp: -1 });
AuditLogSchema.index({ action: 1, timestamp: -1 });
AuditLogSchema.index({ timestamp: -1 });

export const AuditLog =
  mongoose.models.AuditLog ||
  mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
