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
exports.SecurityRule = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const SecurityRuleSchema = new mongoose_1.Schema({
    ruleId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    name: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    eventType: {
        type: String,
        required: true,
        enum: [
            'LOGIN_FAILED',
            'LOGIN_SUCCESS',
            'TOKEN_INVALID',
            'TOKEN_EXPIRED',
            'PERMISSION_DENIED',
            'RATE_LIMIT',
            'OTP_ABUSE',
            'PASSWORD_RESET',
            'ADMIN_ACTION',
            'SUSPICIOUS_ACTIVITY',
        ],
        index: true,
    },
    threshold: {
        type: Number,
        required: true,
        min: 1,
    },
    windowSeconds: {
        type: Number,
        required: true,
        min: 10,
    },
    action: {
        type: String,
        required: true,
        enum: ['FLAG_INCIDENT', 'AUTO_BLOCK_IP', 'ALERT_ADMIN'],
        default: 'FLAG_INCIDENT',
    },
    severity: {
        type: String,
        required: true,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        default: 'MEDIUM',
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true,
    },
    isConfigurable: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: true,
});
exports.SecurityRule = mongoose_1.default.models.SecurityRule ||
    mongoose_1.default.model('SecurityRule', SecurityRuleSchema);
