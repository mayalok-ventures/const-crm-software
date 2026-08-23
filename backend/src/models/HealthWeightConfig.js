const mongoose = require('mongoose');

const DEFAULT_COMPONENT_WEIGHTS = [
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

const DEFAULT_THRESHOLDS = {
  excellentMin: 95,
  healthyMin: 90,
  goodMin: 75,
  warningMin: 60,
  degradedMin: 40,
};

const DEFAULT_CIRCUIT_BREAKERS = {
  databaseDownForcesCritical: true,
  zeroServersOnlineForcesCritical: true,
  criticalSecurityIncidentCapsDegraded: true,
  unresolvedP1IncidentCapsDegraded: true,
};

const ComponentWeightSchema = new mongoose.Schema(
  {
    componentId: { type: String, required: true },
    name: { type: String, required: true },
    weight: { type: Number, required: true, min: 0, max: 1 },
    isEnabled: { type: Boolean, default: true },
  },
  { _id: false }
);

const HealthWeightConfigSchema = new mongoose.Schema(
  {
    configId: { type: String, required: true, unique: true, default: 'default_platform_config' },
    weights: { type: [ComponentWeightSchema], default: DEFAULT_COMPONENT_WEIGHTS },
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
  },
  { timestamps: true }
);

const HealthWeightConfig =
  mongoose.models.HealthWeightConfig ||
  mongoose.model('HealthWeightConfig', HealthWeightConfigSchema);

module.exports = {
  HealthWeightConfig,
  DEFAULT_COMPONENT_WEIGHTS,
  DEFAULT_THRESHOLDS,
  DEFAULT_CIRCUIT_BREAKERS,
  default: HealthWeightConfig,
};
