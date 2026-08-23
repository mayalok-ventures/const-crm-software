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
exports.ApiEndpointSummary = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ApiEndpointSummarySchema = new mongoose_1.Schema({
    route: { type: String, required: true, index: true },
    method: { type: String, required: true },
    timeBucket: { type: Date, required: true, index: true },
    requests: { type: Number, required: true, default: 0 },
    avgResponseTime: { type: Number, required: true, default: 0 },
    p50: { type: Number, required: true, default: 0 },
    p75: { type: Number, required: true, default: 0 },
    p90: { type: Number, required: true, default: 0 },
    p95: { type: Number, required: true, default: 0 },
    p99: { type: Number, required: true, default: 0 },
    errorRate: { type: Number, required: true, default: 0 },
    errorsCount: { type: Number, required: true, default: 0 },
    statusCodes: { type: mongoose_1.Schema.Types.Mixed, default: {} },
});
// Compound index for retrieval
ApiEndpointSummarySchema.index({ route: 1, method: 1, timeBucket: -1 });
exports.ApiEndpointSummary = mongoose_1.default.models.ApiEndpointSummary || mongoose_1.default.model('ApiEndpointSummary', ApiEndpointSummarySchema);
