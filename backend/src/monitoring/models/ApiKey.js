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
const mongoose_1 = __importStar(require("mongoose"));
const ApiKeySchema = new mongoose_1.Schema({
    keyId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    organizationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    organizationName: { type: String, default: 'Organization' },
    createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    createdByName: { type: String, default: 'Admin' },
    createdByEmail: { type: String, default: '' },
    keyPrefix: { type: String, required: true, index: true },
    keyHash: { type: String, required: true, unique: true, index: true },
    status: {
        type: String,
        enum: ['ACTIVE', 'EXPIRED', 'REVOKED', 'SUSPENDED'],
        default: 'ACTIVE',
        index: true,
    },
    permissions: [{ type: String, trim: true }],
    rateLimitPerMinute: { type: Number, default: 120 },
    ipWhitelist: [{ type: String, trim: true }],
    expiresAt: { type: Date, default: null, index: true },
    lastUsedAt: { type: Date, default: null, index: true },
    lastUsedIp: { type: String, default: '' },
    lastUsedUserAgent: { type: String, default: '' },
    lastUsedGeo: {
        country: { type: String, default: '' },
        city: { type: String, default: '' },
    },
    totalRequests: { type: Number, default: 0 },
    monthlyRequests: { type: Number, default: 0 },
    dailyRequests: { type: Number, default: 0 },
    failedAuthCount: { type: Number, default: 0 },
    rateLimitViolationsCount: { type: Number, default: 0 },
    unusualUsageScore: { type: Number, default: 0 },
    revokedAt: { type: Date, default: null },
    revokedBy: { type: String, default: '' },
    revocationReason: { type: String, default: '' },
    suspendedAt: { type: Date, default: null },
    suspensionReason: { type: String, default: '' },
    rotationHistory: [
        {
            rotatedAt: { type: Date, default: Date.now },
            previousPrefix: { type: String },
            gracePeriodEndsAt: { type: Date },
        },
    ],
}, { timestamps: true });
ApiKeySchema.index({ organizationId: 1, status: 1 });
ApiKeySchema.index({ expiresAt: 1, status: 1 });
const ApiKey = mongoose_1.default.models.ApiKey || mongoose_1.default.model('ApiKey', ApiKeySchema);
exports.default = ApiKey;
