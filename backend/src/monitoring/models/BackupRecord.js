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
exports.BackupRecord = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const BackupRecordSchema = new mongoose_1.Schema({
    backupId: { type: String, required: true, unique: true, index: true },
    jobId: { type: String, required: true, index: true },
    policyId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'BackupPolicy' },
    status: {
        type: String,
        enum: ['RUNNING', 'SUCCESS', 'FAILED', 'VERIFICATION_FAILED', 'EXPIRED'],
        default: 'RUNNING',
        index: true,
    },
    startedAt: { type: Date, required: true, default: Date.now },
    completedAt: { type: Date },
    durationMs: { type: Number, default: 0 },
    sizeBytes: { type: Number, default: 0 },
    formattedSize: { type: String, default: '0 MB' },
    location: {
        target: { type: String, default: 'S3' },
        path: { type: String, required: true },
        bucket: { type: String, default: '' },
        region: { type: String, default: 'us-east-1' },
        isExternal: { type: Boolean, default: true },
    },
    checksum: {
        algorithm: { type: String, default: 'SHA256' },
        value: { type: String, default: '' },
        verified: { type: Boolean, default: false },
    },
    verification: {
        status: {
            type: String,
            enum: ['PENDING', 'PASSED', 'FAILED', 'SKIPPED'],
            default: 'PENDING',
            index: true,
        },
        fileHeaderValid: { type: Boolean, default: false },
        archiveIntegrityValid: { type: Boolean, default: false },
        decompressionTestValid: { type: Boolean, default: false },
        simulatedRestoreValid: { type: Boolean, default: false },
        verifiedAt: { type: Date },
        failureReason: { type: String, default: '' },
        verifiedBy: { type: String, default: 'SYSTEM_VERIFIER' },
    },
    retentionExpiresAt: { type: Date, required: true, index: true },
    isRetained: { type: Boolean, default: true },
    metadata: {
        databaseName: { type: String, default: 'mobile-crm' },
        collectionsCount: { type: Number, default: 0 },
        documentsCount: { type: Number, default: 0 },
        storageEngine: { type: String, default: 'WiredTiger' },
        backupEngineVersion: { type: String, default: '1.0.0' },
    },
    failureDetails: {
        code: { type: String },
        message: { type: String },
    },
}, { timestamps: true });
BackupRecordSchema.index({ completedAt: -1, status: 1 });
BackupRecordSchema.index({ createdAt: -1 });
exports.BackupRecord = mongoose_1.default.models.BackupRecord ||
    mongoose_1.default.model('BackupRecord', BackupRecordSchema);
exports.default = exports.BackupRecord;
