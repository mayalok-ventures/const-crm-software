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
exports.SystemLog = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const SystemLogSchema = new mongoose_1.Schema({
    timestamp: {
        type: Date,
        default: Date.now,
        index: true,
        expires: '14d', // Auto-purge logs after 14 days (TTL index)
    },
    level: {
        type: String,
        enum: ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'],
        required: true,
        index: true,
    },
    service: {
        type: String,
        default: 'crm-backend',
        index: true,
    },
    module: {
        type: String,
        default: 'general',
        index: true,
    },
    serverId: {
        type: String,
        required: true,
        index: true,
    },
    requestId: {
        type: String,
        index: true,
        default: null,
    },
    userId: {
        type: mongoose_1.Schema.Types.Mixed,
        default: null,
    },
    organizationId: {
        type: mongoose_1.Schema.Types.Mixed,
        default: null,
    },
    message: {
        type: String,
        required: true,
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
}, {
    timestamps: true,
    strict: false,
});
// High-Performance Query Indexes
SystemLogSchema.index({ timestamp: -1, level: 1 });
SystemLogSchema.index({ serverId: 1, timestamp: -1 });
SystemLogSchema.index({ module: 1, timestamp: -1 });
SystemLogSchema.index({ requestId: 1, timestamp: -1 });
exports.SystemLog = mongoose_1.default.models.SystemLog || mongoose_1.default.model('SystemLog', SystemLogSchema);
exports.default = exports.SystemLog;
