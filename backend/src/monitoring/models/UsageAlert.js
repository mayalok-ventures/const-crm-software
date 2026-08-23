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
const UsageAlertSchema = new mongoose_1.Schema({
    alertId: { type: String, required: true, unique: true, index: true },
    organizationId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    organizationName: { type: String, required: true },
    ownerEmail: { type: String, default: '' },
    resourceType: {
        type: String,
        enum: ['storage', 'users', 'api', 'leads', 'groups', 'campaigns', 'messages'],
        required: true,
        index: true,
    },
    thresholdPercent: { type: Number, required: true }, // 80, 90, 100
    severity: {
        type: String,
        enum: ['WARNING', 'CRITICAL', 'LIMIT_REACHED'],
        required: true,
        index: true,
    },
    currentValue: { type: Number, required: true },
    currentFormatted: { type: String, default: '' },
    limitValue: { type: Number, required: true },
    limitFormatted: { type: String, default: '' },
    currentPercent: { type: Number, required: true },
    message: { type: String, required: true },
    isAcknowledged: { type: Boolean, default: false, index: true },
    acknowledgedBy: { type: String, default: null },
    acknowledgedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
}, {
    timestamps: true,
});
UsageAlertSchema.index({ organizationId: 1, resourceType: 1, resolvedAt: 1 });
UsageAlertSchema.index({ severity: 1, isAcknowledged: 1, createdAt: -1 });
exports.default = mongoose_1.default.models.UsageAlert ||
    mongoose_1.default.model('UsageAlert', UsageAlertSchema);
