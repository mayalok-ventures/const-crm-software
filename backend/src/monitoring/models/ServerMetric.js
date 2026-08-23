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
exports.ServerMetric = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ServerMetricSchema = new mongoose_1.Schema({
    serverId: { type: String, required: true, index: true },
    timestamp: { type: Date, required: true, index: true },
    cpu: {
        usagePercent: { type: Number, required: true },
        cores: { type: Number, required: true },
        loadAvg: { type: [Number], required: true },
    },
    ram: {
        totalBytes: { type: Number, required: true },
        usedBytes: { type: Number, required: true },
        freeBytes: { type: Number, required: true },
        usagePercent: { type: Number, required: true },
    },
    disk: {
        totalBytes: { type: Number, required: true },
        usedBytes: { type: Number, required: true },
        freeBytes: { type: Number, required: true },
        usagePercent: { type: Number, required: true },
    },
    network: {
        uploadBytesSec: { type: Number, required: true },
        downloadBytesSec: { type: Number, required: true },
    },
    process: {
        cpuPercent: { type: Number, required: true },
        memoryBytes: { type: Number, required: true },
        pm2Status: { type: String, required: true },
        pm2Restarts: { type: Number, required: true },
    },
    uptime: { type: Number, required: true },
    healthScore: { type: Number, required: true },
    isAggregated: { type: Boolean, default: false, index: true },
    aggregationType: {
        type: String,
        enum: ['raw', 'hourly', 'daily'],
        default: 'raw',
        index: true,
    },
});
// Compound index for fast time-series queries
ServerMetricSchema.index({ serverId: 1, timestamp: -1 });
exports.ServerMetric = mongoose_1.default.models.ServerMetric || mongoose_1.default.model('ServerMetric', ServerMetricSchema);
