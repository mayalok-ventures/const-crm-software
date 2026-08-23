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
exports.Alert = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const AlertSchema = new mongoose_1.Schema({
    alertId: { type: String, required: true, unique: true, index: true },
    ruleId: { type: String, required: true, index: true },
    incidentId: { type: String, index: true },
    title: { type: String, required: true },
    metricName: { type: String, required: true, index: true },
    metricValue: { type: mongoose_1.Schema.Types.Mixed, required: true },
    threshold: { type: mongoose_1.Schema.Types.Mixed, required: true },
    operator: { type: String, required: true },
    severity: {
        type: String,
        required: true,
        enum: ['CRITICAL', 'WARNING', 'INFO'],
        index: true,
    },
    status: {
        type: String,
        required: true,
        enum: ['TRIGGERED', 'ACKNOWLEDGED', 'RESOLVED', 'SILENCED'],
        default: 'TRIGGERED',
        index: true,
    },
    fingerprint: { type: String, required: true, index: true },
    targetResource: {
        type: { type: String, default: 'SERVER' },
        identifier: { type: String, default: 'default' },
        name: { type: String, default: '' },
    },
    triggeredAt: { type: Date, required: true, default: Date.now, index: true },
    acknowledgedAt: { type: Date, default: null },
    acknowledgedBy: { type: String, default: '' },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: String, default: '' },
    silencedUntil: { type: Date, default: null },
    details: { type: mongoose_1.Schema.Types.Mixed, default: {} },
}, { timestamps: true });
exports.Alert = mongoose_1.default.models.Alert || mongoose_1.default.model('Alert', AlertSchema);
exports.default = exports.Alert;
