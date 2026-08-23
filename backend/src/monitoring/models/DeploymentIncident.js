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
const DeploymentIncidentSchema = new mongoose_1.Schema({
    incidentId: { type: String, required: true, unique: true, index: true },
    deploymentId: { type: String, required: true, index: true },
    version: { type: String, required: true, index: true },
    environment: { type: String, default: 'production', index: true },
    severity: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        default: 'HIGH',
        index: true,
    },
    type: {
        type: String,
        enum: [
            'ERROR_RATE_SPIKE',
            'LATENCY_SPIKE',
            'HEALTH_CHECK_FAILURE',
            'SMOKE_TEST_FAILURE',
            'CRASH_LOOP',
        ],
        required: true,
        index: true,
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    metricsSnapshot: {
        baselineErrorRate: { type: Number, default: 0 },
        currentErrorRate: { type: Number, default: 0 },
        baselineLatencyMs: { type: Number, default: 0 },
        currentLatencyMs: { type: Number, default: 0 },
        failedChecksCount: { type: Number, default: 0 },
    },
    isResolved: { type: Boolean, default: false, index: true },
    resolvedAt: { type: Date },
    resolvedBy: { type: String },
    resolutionNotes: { type: String, default: '' },
    suggestedAction: {
        type: String,
        enum: ['ROLLBACK_RECOMMENDED', 'INVESTIGATE_ERROR_LOGS', 'RESTART_SERVICE'],
        default: 'INVESTIGATE_ERROR_LOGS',
    },
}, { timestamps: true });
DeploymentIncidentSchema.index({ environment: 1, isResolved: 1, createdAt: -1 });
exports.default = mongoose_1.default.models.DeploymentIncident ||
    mongoose_1.default.model('DeploymentIncident', DeploymentIncidentSchema);
