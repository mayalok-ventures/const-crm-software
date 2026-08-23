"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLog = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const AuditLogSchema = new mongoose_1.Schema({
    actorId: {
        type: mongoose_1.Schema.Types.Mixed,
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
        type: mongoose_1.Schema.Types.Mixed,
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
        type: mongoose_1.Schema.Types.Mixed,
        default: null,
    },
    after: {
        type: mongoose_1.Schema.Types.Mixed,
        default: null,
    },
    changes: {
        type: mongoose_1.Schema.Types.Mixed,
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
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
    retentionCategory: {
        type: String,
        enum: ['ACTIVE', 'ARCHIVED'],
        default: 'ACTIVE',
        index: true,
    },
}, {
    timestamps: { createdAt: true, updatedAt: false }, // Disallow automatic updatedAt modification
});
// ─────────────────────────────────────────────────────────────
// STRICT IMMUTABILITY ENFORCEMENT HOOKS
// ─────────────────────────────────────────────────────────────
const immutabilityError = () => new Error('IMMUTABILITY_VIOLATION: AuditLog records are strictly append-only and cannot be modified or deleted.');
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
exports.AuditLog = mongoose_1.default.models.AuditLog ||
    mongoose_1.default.model('AuditLog', AuditLogSchema);
