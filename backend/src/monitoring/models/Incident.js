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
exports.Incident = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const IncidentSchema = new mongoose_1.Schema({
    incidentId: {
        type: String,
        required: true,
        unique: true,
        index: true,
        default: () => `inc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    },
    title: { type: String, required: true, default: 'System Incident' },
    summary: { type: String, default: '' },
    severity: {
        type: String,
        required: true,
        enum: ['CRITICAL', 'WARNING', 'INFO'],
        default: 'WARNING',
        index: true,
    },
    status: {
        type: String,
        required: true,
        enum: ['OPEN', 'INVESTIGATING', 'IDENTIFIED', 'MONITORING', 'RESOLVED'],
        default: 'OPEN',
        index: true,
    },
    startedAt: { type: Date, required: true, default: Date.now, index: true },
    triggeredAt: { type: Date, default: Date.now },
    acknowledgedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    durationMs: { type: Number, default: 0 },
    acknowledgedBy: { type: String, default: '' },
    resolvedBy: { type: String, default: '' },
    resolutionNotes: { type: String, default: '' },
    rootCause: { type: String, default: '' },
    trigger: {
        metric: { type: String, default: '' },
        operator: { type: String, default: '' },
        threshold: { type: mongoose_1.Schema.Types.Mixed, default: null },
        value: { type: mongoose_1.Schema.Types.Mixed, default: null },
        ruleId: { type: String, default: '' },
        alertId: { type: String, default: '' },
    },
    affectedResources: {
        serverId: { type: String, default: '' },
        endpoint: { type: String, default: '' },
        database: { type: String, default: '' },
        service: { type: String, default: 'crm-backend' },
        component: { type: String, default: '' },
    },
    // Backward compatibility
    serverId: { type: String, index: true },
    type: { type: String, default: 'SYSTEM_ANOMALY', index: true },
    events: [
        {
            status: { type: String, required: true },
            timestamp: { type: Date, required: true },
            reason: { type: String, required: true },
        },
    ],
    relatedAlerts: [
        {
            alertId: { type: String },
            title: { type: String },
            metricName: { type: String },
            metricValue: { type: mongoose_1.Schema.Types.Mixed },
            severity: { type: String },
            triggeredAt: { type: Date },
        },
    ],
    relatedErrors: [
        {
            errorGroupId: { type: String },
            name: { type: String },
            message: { type: String },
            count: { type: Number, default: 1 },
            lastSeen: { type: Date },
        },
    ],
    relatedLogs: [
        {
            logId: { type: String },
            level: { type: String },
            message: { type: String },
            timestamp: { type: Date },
            module: { type: String },
        },
    ],
    timeline: [
        {
            timestamp: { type: Date, required: true, default: Date.now },
            event: { type: String, required: true },
            description: { type: String, required: true },
            actor: { type: String, default: 'SYSTEM' },
            metadata: { type: mongoose_1.Schema.Types.Mixed, default: {} },
        },
    ],
    escalationLevel: { type: Number, default: 1 },
    lastNotifiedAt: { type: Date, default: null },
    fingerprint: { type: String, index: true },
}, { timestamps: true });
// Compound indexes
IncidentSchema.index({ status: 1, severity: 1, startedAt: -1 });
exports.Incident = mongoose_1.default.models.Incident || mongoose_1.default.model('Incident', IncidentSchema);
exports.default = exports.Incident;
