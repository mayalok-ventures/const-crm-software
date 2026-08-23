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
const ApiKeySecurityAlertSchema = new mongoose_1.Schema({
    alertId: { type: String, required: true, unique: true, index: true },
    keyId: { type: String, required: true, index: true },
    keyName: { type: String, required: true },
    keyPrefix: { type: String, required: true },
    organizationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    organizationName: { type: String, default: 'Organization' },
    alertType: {
        type: String,
        enum: [
            'UNUSUAL_IP_OR_GEO',
            'EXCESSIVE_REQUESTS',
            'EXPIRED_KEY_ATTEMPT',
            'REVOKED_KEY_ATTEMPT',
            'SUSPENDED_KEY_ATTEMPT',
            'RATE_LIMIT_SPIKE',
        ],
        required: true,
        index: true,
    },
    severity: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        default: 'MEDIUM',
        index: true,
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    metadata: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    isResolved: { type: Boolean, default: false, index: true },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: String, default: '' },
}, { timestamps: true });
ApiKeySecurityAlertSchema.index({ organizationId: 1, isResolved: 1, createdAt: -1 });
const ApiKeySecurityAlert = mongoose_1.default.models.ApiKeySecurityAlert ||
    mongoose_1.default.model('ApiKeySecurityAlert', ApiKeySecurityAlertSchema);
exports.default = ApiKeySecurityAlert;
