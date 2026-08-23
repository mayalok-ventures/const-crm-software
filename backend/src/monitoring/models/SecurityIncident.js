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
exports.SecurityIncident = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const SecurityIncidentSchema = new mongoose_1.Schema({
    incidentId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
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
        default: 'MEDIUM',
        index: true,
    },
    status: {
        type: String,
        required: true,
        enum: ['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'IGNORED'],
        default: 'OPEN',
        index: true,
    },
    targetIp: {
        type: String,
        default: null,
        index: true,
    },
    targetUserId: {
        type: mongoose_1.Schema.Types.Mixed,
        default: null,
        index: true,
    },
    targetUserEmail: {
        type: String,
        default: null,
        index: true,
    },
    targetTenantId: {
        type: mongoose_1.Schema.Types.Mixed,
        default: null,
        index: true,
    },
    eventCount: {
        type: Number,
        default: 1,
    },
    firstSeen: {
        type: Date,
        default: Date.now,
    },
    lastSeen: {
        type: Date,
        default: Date.now,
        index: true,
    },
    triggerRuleId: {
        type: String,
        default: null,
    },
    riskScore: {
        type: Number,
        default: 50,
        min: 0,
        max: 100,
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
    adminNotes: [
        {
            author: { type: String, required: true },
            note: { type: String, required: true },
            createdAt: { type: Date, default: Date.now },
        },
    ],
    resolvedBy: {
        type: String,
        default: null,
    },
    resolvedAt: {
        type: Date,
        default: null,
    },
}, {
    timestamps: true,
});
// Compound indexes
SecurityIncidentSchema.index({ status: 1, severity: 1, lastSeen: -1 });
SecurityIncidentSchema.index({ targetIp: 1, status: 1 });
exports.SecurityIncident = mongoose_1.default.models.SecurityIncident ||
    mongoose_1.default.model('SecurityIncident', SecurityIncidentSchema);
