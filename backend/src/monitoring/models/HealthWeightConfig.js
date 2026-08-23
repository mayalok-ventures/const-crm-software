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
exports.HealthWeightConfig = exports.DEFAULT_CIRCUIT_BREAKERS = exports.DEFAULT_THRESHOLDS = exports.DEFAULT_COMPONENT_WEIGHTS = void 0;
const mongoose_1 = __importStar(require("mongoose"));
exports.DEFAULT_COMPONENT_WEIGHTS = [
    { componentId: 'infrastructure', name: 'Infrastructure Health', weight: 0.15, isEnabled: true },
    { componentId: 'availability', name: 'Server Availability', weight: 0.15, isEnabled: true },
    { componentId: 'api_performance', name: 'API Performance', weight: 0.10, isEnabled: true },
    { componentId: 'api_reliability', name: 'API Reliability', weight: 0.10, isEnabled: true },
    { componentId: 'database', name: 'Database Health', weight: 0.10, isEnabled: true },
    { componentId: 'security', name: 'Security Health', weight: 0.10, isEnabled: true },
    { componentId: 'storage', name: 'Storage Health', weight: 0.05, isEnabled: true },
    { componentId: 'backup', name: 'Backup Health', weight: 0.05, isEnabled: true },
    { componentId: 'integrations', name: 'External Integrations', weight: 0.05, isEnabled: true },
    { componentId: 'errors', name: 'Application Error Health', weight: 0.05, isEnabled: true },
    { componentId: 'deployment', name: 'Deployment Health', weight: 0.05, isEnabled: true },
    { componentId: 'tenant_resources', name: 'Tenant Resource Health', weight: 0.05, isEnabled: true },
];
exports.DEFAULT_THRESHOLDS = {
    excellentMin: 95,
    healthyMin: 90,
    goodMin: 75,
    warningMin: 60,
    degradedMin: 40,
};
exports.DEFAULT_CIRCUIT_BREAKERS = {
    databaseDownForcesCritical: true,
    zeroServersOnlineForcesCritical: true,
    criticalSecurityIncidentCapsDegraded: true,
    unresolvedP1IncidentCapsDegraded: true,
};
const ComponentWeightSchema = new mongoose_1.Schema({
    componentId: { type: String, required: true },
    name: { type: String, required: true },
    weight: { type: Number, required: true, min: 0, max: 1 },
    isEnabled: { type: Boolean, default: true },
}, { _id: false });
const HealthWeightConfigSchema = new mongoose_1.Schema({
    configId: { type: String, required: true, unique: true, default: 'default_platform_config' },
    weights: { type: [ComponentWeightSchema], default: exports.DEFAULT_COMPONENT_WEIGHTS },
    thresholds: {
        excellentMin: { type: Number, default: 95 },
        healthyMin: { type: Number, default: 90 },
        goodMin: { type: Number, default: 75 },
        warningMin: { type: Number, default: 60 },
        degradedMin: { type: Number, default: 40 },
    },
    circuitBreakers: {
        databaseDownForcesCritical: { type: Boolean, default: true },
        zeroServersOnlineForcesCritical: { type: Boolean, default: true },
        criticalSecurityIncidentCapsDegraded: { type: Boolean, default: true },
        unresolvedP1IncidentCapsDegraded: { type: Boolean, default: true },
    },
    updatedBy: { type: String, default: 'system' },
}, { timestamps: true });
exports.HealthWeightConfig = mongoose_1.default.models.HealthWeightConfig ||
    mongoose_1.default.model('HealthWeightConfig', HealthWeightConfigSchema);
exports.default = exports.HealthWeightConfig;
