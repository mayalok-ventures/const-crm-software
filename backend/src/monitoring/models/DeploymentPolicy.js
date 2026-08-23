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
const DeploymentPolicySchema = new mongoose_1.Schema({
    environment: {
        type: String,
        enum: ['production', 'staging', 'development'],
        default: 'production',
        unique: true,
        index: true,
    },
    autoRollbackEnabled: { type: Boolean, default: false }, // Explicit default false per user safety requirement
    requireHealthCheckPass: { type: Boolean, default: true },
    requireSmokeTestsPass: { type: Boolean, default: true },
    minHealthScore: { type: Number, default: 90 },
    maxErrorRateThreshold: { type: Number, default: 5.0 },
    maxLatencyP95Ms: { type: Number, default: 500 },
    evaluationWindowMinutes: { type: Number, default: 15 },
    allowAutoRollbackOnlyIfHealthBelow: { type: Number, default: 50 },
    requireAdminApproval: { type: Boolean, default: true },
    notificationChannels: [{ type: String }],
    updatedBy: { type: String, default: 'DevOps Admin' },
}, { timestamps: true });
exports.default = mongoose_1.default.models.DeploymentPolicy ||
    mongoose_1.default.model('DeploymentPolicy', DeploymentPolicySchema);
