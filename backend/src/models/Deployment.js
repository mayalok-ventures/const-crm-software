const mongoose = require('mongoose');

const DeploymentSchema = new mongoose.Schema(
  {
    deploymentId: { type: String, required: true, unique: true, index: true },
    version: { type: String, required: true, index: true },
    previousVersion: { type: String, default: null },
    commitHash: { type: String, required: true, index: true },
    commitMessage: { type: String, default: '' },
    branch: { type: String, default: 'main', index: true },
    environment: {
      type: String,
      enum: ['production', 'staging', 'development'],
      default: 'production',
      index: true,
    },
    server: { type: String, required: true, index: true },
    deployedAt: { type: Date, default: Date.now, index: true },
    deployedBy: { type: String, default: 'DevOps Admin' },
    deploymentStatus: {
      type: String,
      enum: ['BUILDING', 'DEPLOYING', 'HEALTH_CHECK', 'SUCCESS', 'FAILED', 'ROLLED_BACK'],
      default: 'BUILDING',
      index: true,
    },
    isCurrent: { type: Boolean, default: false, index: true },
    buildDurationMs: { type: Number, default: 0 },
    deployDurationMs: { type: Number, default: 0 },
    totalDurationMs: { type: Number, default: 0 },
    healthCheckResult: {
      status: { type: String, enum: ['PASS', 'FAIL', 'DEGRADED'], default: 'PASS' },
      healthScore: { type: Number, default: 100 },
      checks: [
        {
          name: { type: String },
          status: { type: String, enum: ['PASS', 'FAIL', 'DEGRADED'] },
          latencyMs: { type: Number, default: 0 },
          details: { type: String, default: '' },
        },
      ],
      evaluatedAt: { type: Date, default: Date.now },
    },
    smokeTestResult: {
      status: { type: String, enum: ['PASS', 'FAIL'], default: 'PASS' },
      passedCount: { type: Number, default: 0 },
      totalCount: { type: Number, default: 0 },
      durationMs: { type: Number, default: 0 },
      testSuites: [
        {
          name: { type: String },
          category: { type: String },
          passed: { type: Boolean, default: true },
          latencyMs: { type: Number, default: 0 },
          assertion: { type: String, default: '' },
          error: { type: String, default: '' },
        },
      ],
      executedAt: { type: Date, default: Date.now },
    },
    changelog: [{ type: String }],
    postDeploymentMetrics: {
      evaluatedAt: { type: Date, default: Date.now },
      errorRateBefore: { type: Number, default: 0 },
      errorRateAfter: { type: Number, default: 0 },
      errorCount15m: { type: Number, default: 0 },
      errorCount1h: { type: Number, default: 0 },
      latencyP95BeforeMs: { type: Number, default: 0 },
      latencyP95AfterMs: { type: Number, default: 0 },
      topPostDeployErrors: [
        {
          message: { type: String },
          count: { type: Number, default: 1 },
          firstSeen: { type: Date, default: Date.now },
        },
      ],
    },
    isSuspicious: { type: Boolean, default: false, index: true },
    suspiciousReason: { type: String, default: '' },
    rollbackDetails: {
      rolledBackAt: { type: Date },
      rolledBackBy: { type: String },
      targetVersion: { type: String },
      targetDeploymentId: { type: String },
      reason: { type: String },
      isAutomated: { type: Boolean, default: false },
    },
    logs: [
      {
        timestamp: { type: Date, default: Date.now },
        stage: { type: String, default: 'INFO' },
        message: { type: String, required: true },
        level: { type: String, enum: ['INFO', 'WARN', 'ERROR', 'SUCCESS'], default: 'INFO' },
      },
    ],
    cicdMetadata: {
      ciProvider: { type: String, default: 'Manual' },
      pipelineId: { type: String },
      runNumber: { type: Number },
      prNumber: { type: Number },
      trigger: { type: String, default: 'Manual Admin' },
      repository: { type: String, default: 'mayalok-ventures/mobile-crm' },
    },
  },
  { timestamps: true }
);

DeploymentSchema.index({ environment: 1, isCurrent: 1 });
DeploymentSchema.index({ environment: 1, deployedAt: -1 });

module.exports = mongoose.models.Deployment || mongoose.model('Deployment', DeploymentSchema);
