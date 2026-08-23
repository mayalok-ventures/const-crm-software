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
exports.Server = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ServerSchema = new mongoose_1.Schema({
    serverId: { type: String, required: true, unique: true, index: true },
    organizationId: { type: String, index: true },
    name: { type: String, required: true },
    hostname: { type: String, required: true },
    environment: { type: String, required: true, index: true },
    status: {
        type: String,
        required: true,
        enum: ['ONLINE', 'DEGRADED', 'OFFLINE', 'UNKNOWN', 'MAINTENANCE'],
        default: 'UNKNOWN',
        index: true,
    },
    lastHeartbeat: { type: Date },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    nodeVersion: { type: String, required: true },
    os: { type: String, required: true },
    metadata: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    healthScore: { type: Number, default: 100 },
    uptimePercentage: { type: Number, default: 100 },
    availabilityPercentage: { type: Number, default: 100 },
}, { timestamps: true });
exports.Server = mongoose_1.default.models.Server || mongoose_1.default.model('Server', ServerSchema);
