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
exports.ErrorGroup = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ErrorGroupSchema = new mongoose_1.Schema({
    fingerprint: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    errorType: {
        type: String,
        required: true,
        index: true,
    },
    message: {
        type: String,
        required: true,
    },
    stackTrace: {
        type: String,
        default: '',
    },
    primaryFrame: {
        type: String,
        default: '',
    },
    status: {
        type: String,
        enum: ['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'IGNORED'],
        default: 'OPEN',
        index: true,
    },
    severity: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        default: 'MEDIUM',
        index: true,
    },
    occurrences: {
        type: Number,
        default: 1,
        index: true,
    },
    firstSeen: {
        type: Date,
        default: Date.now,
        index: true,
    },
    lastSeen: {
        type: Date,
        default: Date.now,
        index: true,
    },
    affectedEndpoints: {
        type: [String],
        default: [],
    },
    affectedServers: {
        type: [String],
        default: [],
    },
    affectedUsersCount: {
        type: Number,
        default: 0,
    },
    affectedOrgsCount: {
        type: Number,
        default: 0,
    },
    notes: [
        {
            author: { type: String, required: true },
            authorId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
            note: { type: String, required: true },
            createdAt: { type: Date, default: Date.now },
        },
    ],
    isRegression: {
        type: Boolean,
        default: false,
    },
    lastResolvedAt: {
        type: Date,
        default: null,
    },
}, {
    timestamps: true,
});
// High-Performance Query Indexes
ErrorGroupSchema.index({ status: 1, lastSeen: -1 });
ErrorGroupSchema.index({ severity: 1, lastSeen: -1 });
ErrorGroupSchema.index({ occurrences: -1 });
exports.ErrorGroup = mongoose_1.default.models.ErrorGroup || mongoose_1.default.model('ErrorGroup', ErrorGroupSchema);
exports.default = exports.ErrorGroup;
