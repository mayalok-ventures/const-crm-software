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
exports.ExternalIntegration = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const RecentFailureSchema = new mongoose_1.Schema({
    timestamp: { type: Date, default: Date.now },
    error: { type: String, required: true },
    statusCode: { type: Number },
    latencyMs: { type: Number, default: 0 },
}, { _id: false });
const HealthHistoryPointSchema = new mongoose_1.Schema({
    timestamp: { type: Date, default: Date.now },
    healthScore: { type: Number, required: true, min: 0, max: 100 },
    status: {
        type: String,
        enum: ['HEALTHY', 'DEGRADED', 'DOWN', 'UNKNOWN'],
        default: 'HEALTHY',
    },
    avgLatencyMs: { type: Number, default: 0 },
    errorRate: { type: Number, default: 0 },
    totalRequests: { type: Number, default: 0 },
}, { _id: false });
const AlertThresholdsSchema = new mongoose_1.Schema({
    errorRatePercent: { type: Number, default: 10 },
    maxLatencyMs: { type: Number, default: 3000 },
    consecutiveFailures: { type: Number, default: 3 },
}, { _id: false });
const ExternalIntegrationSchema = new mongoose_1.Schema({
    provider: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    service: {
        type: String,
        required: true,
        trim: true,
    },
    category: {
        type: String,
        enum: ['social', 'messaging', 'communication', 'payment', 'storage', 'cache', 'custom'],
        default: 'custom',
        index: true,
    },
    status: {
        type: String,
        enum: ['HEALTHY', 'DEGRADED', 'DOWN', 'UNKNOWN'],
        default: 'UNKNOWN',
        index: true,
    },
    healthScore: {
        type: Number,
        default: 100,
        min: 0,
        max: 100,
        index: true,
    },
    latency: {
        type: Number,
        default: 0,
    },
    p95Latency: {
        type: Number,
        default: 0,
    },
    successCount: {
        type: Number,
        default: 0,
    },
    failureCount: {
        type: Number,
        default: 0,
    },
    totalRequests: {
        type: Number,
        default: 0,
    },
    errorRate: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
    },
    consecutiveFailures: {
        type: Number,
        default: 0,
    },
    lastSuccessfulRequest: {
        type: Date,
        default: null,
    },
    lastFailedRequest: {
        type: Date,
        default: null,
    },
    lastChecked: {
        type: Date,
        default: Date.now,
        index: true,
    },
    lastError: {
        message: { type: String },
        statusCode: { type: Number },
        timestamp: { type: Date },
    },
    recentFailures: {
        type: [RecentFailureSchema],
        default: [],
    },
    healthHistory: {
        type: [HealthHistoryPointSchema],
        default: [],
    },
    isConfigured: {
        type: Boolean,
        default: true,
    },
    alertThresholds: {
        type: AlertThresholdsSchema,
        default: () => ({
            errorRatePercent: 10,
            maxLatencyMs: 3000,
            consecutiveFailures: 3,
        }),
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
}, {
    timestamps: true,
});
exports.ExternalIntegration = mongoose_1.default.models.ExternalIntegration ||
    mongoose_1.default.model('ExternalIntegration', ExternalIntegrationSchema);
exports.default = exports.ExternalIntegration;
