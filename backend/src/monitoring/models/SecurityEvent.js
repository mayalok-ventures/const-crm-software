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
exports.SecurityEvent = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const SecurityEventSchema = new mongoose_1.Schema({
    type: {
        type: String,
        required: true,
        enum: [
            'LOGIN_FAILED',
            'LOGIN_SUCCESS',
            'TOKEN_INVALID',
            'TOKEN_EXPIRED',
            'PERMISSION_DENIED',
            'RATE_LIMIT',
            'OTP_ABUSE',
            'PASSWORD_RESET',
            'ADMIN_ACTION',
            'SUSPICIOUS_ACTIVITY',
        ],
        index: true,
    },
    severity: {
        type: String,
        required: true,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        default: 'LOW',
        index: true,
    },
    userId: {
        type: mongoose_1.Schema.Types.Mixed,
        default: null,
        index: true,
    },
    userEmail: {
        type: String,
        default: null,
        index: true,
    },
    tenantId: {
        type: mongoose_1.Schema.Types.Mixed,
        default: null,
        index: true,
    },
    ip: {
        type: String,
        required: true,
        index: true,
    },
    userAgent: {
        type: String,
        default: null,
    },
    endpoint: {
        type: String,
        default: null,
        index: true,
    },
    method: {
        type: String,
        default: null,
    },
    riskScore: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
        index: true,
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true,
        // 90-day auto-purge TTL
        expires: 90 * 24 * 60 * 60,
    },
}, {
    timestamps: true,
});
// Compound indexes for rapid admin telemetry queries
SecurityEventSchema.index({ type: 1, timestamp: -1 });
SecurityEventSchema.index({ severity: 1, timestamp: -1 });
SecurityEventSchema.index({ ip: 1, timestamp: -1 });
SecurityEventSchema.index({ userId: 1, timestamp: -1 });
exports.SecurityEvent = mongoose_1.default.models.SecurityEvent ||
    mongoose_1.default.model('SecurityEvent', SecurityEventSchema);
