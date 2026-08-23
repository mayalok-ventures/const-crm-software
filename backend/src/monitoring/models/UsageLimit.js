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
const UsageLimitSchema = new mongoose_1.Schema({
    organizationId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true,
    },
    plan: { type: String, required: true, default: 'team_starter' },
    tierType: { type: String, default: 'organization' },
    storageLimitBytes: { type: Number, default: 10737418240 }, // 10GB default
    maxUsers: { type: Number, default: 3 },
    maxApiRequests: { type: Number, default: 100000 },
    maxLeads: { type: Number, default: 15000 },
    maxGroups: { type: Number, default: 25 },
    maxConcurrentCampaigns: { type: Number, default: 5 },
    maxMonthlyMessages: { type: Number, default: 50000 },
    maxRecipientsPerCampaign: { type: Number, default: 2500 },
    isCustomOverride: { type: Boolean, default: false },
    customOverrides: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    notes: { type: String, default: '' },
    updatedBy: { type: String, default: 'system' },
}, {
    timestamps: true,
});
exports.default = mongoose_1.default.models.UsageLimit ||
    mongoose_1.default.model('UsageLimit', UsageLimitSchema);
