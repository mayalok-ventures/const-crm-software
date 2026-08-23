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
const DatabaseHealthSchema = new mongoose_1.Schema({
    connectionState: {
        type: String,
        enum: ['connected', 'disconnected', 'connecting', 'disconnecting', 'uninitialized'],
        default: 'uninitialized',
    },
    readyState: { type: Number, default: 0 },
    healthScore: { type: Number, default: 100, min: 0, max: 100 },
    status: {
        type: String,
        enum: ['HEALTHY', 'DEGRADED', 'UNHEALTHY', 'DOWN'],
        default: 'HEALTHY',
    },
    pingLatencyMs: { type: Number, default: 0 },
    availabilityPercentage: { type: Number, default: 100 },
    slowQueryCount24h: { type: Number, default: 0 },
    failedOperations24h: { type: Number, default: 0 },
    databaseSize: {
        dataSizeBytes: { type: Number, default: 0 },
        storageSizeBytes: { type: Number, default: 0 },
        totalSizeBytes: { type: Number, default: 0 },
        formattedDataSize: { type: String, default: '0 MB' },
        formattedStorageSize: { type: String, default: '0 MB' },
    },
    totalDocuments: { type: Number, default: 0 },
    totalCollections: { type: Number, default: 0 },
    totalIndexes: { type: Number, default: 0 },
    totalIndexSizeBytes: { type: Number, default: 0 },
    connectionCount: {
        current: { type: Number, default: 0 },
        available: { type: Number, default: 0 },
        totalCreated: { type: Number, default: 0 },
        activePercent: { type: Number, default: 0 },
    },
    cluster: {
        isReplicaSet: { type: Boolean, default: false },
        setName: { type: String, default: '' },
        hosts: [{ type: String }],
        primary: { type: String, default: '' },
        secondaryCount: { type: Number, default: 0 },
        standalone: { type: Boolean, default: true },
        storageEngine: { type: String, default: 'WiredTiger' },
        version: { type: String, default: '' },
    },
    diagnostics: {
        mode: {
            type: String,
            enum: ['HEALTHY', 'APP_ISSUE', 'DB_DOWN', 'NETWORK_FAILURE'],
            default: 'HEALTHY',
        },
        message: { type: String, default: 'MongoDB operational and responsive' },
        lastTestedAt: { type: Date, default: Date.now },
    },
    scoreBreakdown: {
        availabilityScore: { type: Number, default: 100 },
        latencyScore: { type: Number, default: 100 },
        errorScore: { type: Number, default: 100 },
        resourceScore: { type: Number, default: 100 },
    },
    lastCheckedAt: { type: Date, default: Date.now },
    timestamp: { type: Date, default: Date.now },
}, { timestamps: true });
// Indexes
DatabaseHealthSchema.index({ timestamp: -1 });
exports.default = mongoose_1.default.models.DatabaseHealth ||
    mongoose_1.default.model('DatabaseHealth', DatabaseHealthSchema);
