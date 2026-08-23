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
exports.PlatformHealthSnapshot = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ComponentScoreSchema = new mongoose_1.Schema({
    componentId: { type: String, required: true },
    name: { type: String, required: true },
    score: { type: Number, required: true, min: 0, max: 100 },
    status: {
        type: String,
        enum: ['EXCELLENT', 'HEALTHY', 'GOOD', 'WARNING', 'DEGRADED', 'CRITICAL'],
        required: true,
    },
    weight: { type: Number, required: true, min: 0, max: 1 },
    weightedScore: { type: Number, required: true },
    confidence: { type: Number, required: true, min: 0, max: 100 },
    metricsUsed: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    deductions: [
        {
            metric: { type: String, required: true },
            penalty: { type: Number, required: true },
            reason: { type: String, required: true },
        },
    ],
    isStale: { type: Boolean, default: false },
    staleReason: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
}, { _id: false });
const PlatformHealthSnapshotSchema = new mongoose_1.Schema({
    snapshotId: { type: String, required: true, unique: true, index: true },
    timestamp: { type: Date, default: Date.now },
    overallScore: { type: Number, required: true, min: 0, max: 100, index: true },
    overallStatus: {
        type: String,
        enum: ['EXCELLENT', 'HEALTHY', 'GOOD', 'WARNING', 'DEGRADED', 'CRITICAL'],
        required: true,
        index: true,
    },
    confidence: { type: Number, required: true, min: 0, max: 100 },
    confidenceWarning: { type: String, default: '' },
    isCircuitBreakerActive: { type: Boolean, default: false },
    circuitBreakerReason: { type: String, default: '' },
    components: [ComponentScoreSchema],
    topDeductions: [
        {
            component: { type: String, required: true },
            metric: { type: String, required: true },
            penalty: { type: Number, required: true },
            reason: { type: String, required: true },
        },
    ],
    systemContext: {
        activeIncidentsCount: { type: Number, default: 0 },
        activeAlertsCount: { type: Number, default: 0 },
        serversOnline: { type: Number, default: 1 },
        serversTotal: { type: Number, default: 1 },
        databaseStatus: { type: String, default: 'HEALTHY' },
        totalApiRequestsLastHour: { type: Number, default: 0 },
        errorRateLastHour: { type: Number, default: 0 },
    },
    calculatedInMs: { type: Number, default: 0 },
}, { timestamps: true });
// TTL index to automatically prune snapshots older than 90 days to maintain fast DB queries
PlatformHealthSnapshotSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });
PlatformHealthSnapshotSchema.index({ overallStatus: 1, timestamp: -1 });
exports.PlatformHealthSnapshot = mongoose_1.default.models.PlatformHealthSnapshot ||
    mongoose_1.default.model('PlatformHealthSnapshot', PlatformHealthSnapshotSchema);
exports.default = exports.PlatformHealthSnapshot;
