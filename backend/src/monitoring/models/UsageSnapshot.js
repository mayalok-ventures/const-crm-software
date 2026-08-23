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
const UsageSnapshotSchema = new mongoose_1.Schema({
    organizationId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    timestamp: { type: Date, required: true, index: true },
    granularity: {
        type: String,
        enum: ['hourly', 'daily'],
        default: 'daily',
        index: true,
    },
    storageUsedBytes: { type: Number, default: 0 },
    storageLimitBytes: { type: Number, default: 10737418240 },
    storagePercent: { type: Number, default: 0 },
    fileCount: { type: Number, default: 0 },
    activeUsers: { type: Number, default: 1 },
    maxUsers: { type: Number, default: 3 },
    usersPercent: { type: Number, default: 33.3 },
    apiRequests: { type: Number, default: 0 },
    maxApiRequests: { type: Number, default: 100000 },
    apiPercent: { type: Number, default: 0 },
    leadsCount: { type: Number, default: 0 },
    maxLeads: { type: Number, default: 15000 },
    leadsPercent: { type: Number, default: 0 },
    totalRecords: { type: Number, default: 0 },
    campaignsActive: { type: Number, default: 0 },
    messagesSent: { type: Number, default: 0 },
}, {
    timestamps: true,
});
UsageSnapshotSchema.index({ organizationId: 1, timestamp: -1 });
exports.default = mongoose_1.default.models.UsageSnapshot ||
    mongoose_1.default.model('UsageSnapshot', UsageSnapshotSchema);
