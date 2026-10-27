const mongoose = require('mongoose');

const workspaceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Workspace name is required'],
    trim: true,
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  industryType: {
    type: String,
    default: 'Education',
    trim: true,
  },
  subProfile: {
    type: String,
    default: 'admission_consultants',
    trim: true,
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'archived', 'suspended'],
    default: 'active',
    index: true,
  },
  plan: {
    type: String,
    default: 'free',
  },
  planEndDate: {
    type: Date,
    default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14-day default trial
  },
  settings: {
    allowCounsellorExports: { type: Boolean, default: false },
    defaultPipelineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pipeline', default: null },
    timezone: { type: String, default: 'Asia/Kolkata' },
    currency: { type: String, default: 'INR' },
    showFollowUpOnCreate: { type: Boolean, default: true },
    autoAdvanceStageOnNote: { type: Boolean, default: false }, // Explicit automation per spec
    maxSnoozeCount: { type: Number, default: 2 },
  },
  rolePermissions: {
    type: Map,
    of: [{
      key: { type: String, required: true },
      scope: { type: String, enum: ['own', 'team', 'workspace', 'restricted'], default: 'workspace' },
    }],
    default: {},
  },
  deletedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

workspaceSchema.index({ ownerId: 1, status: 1 });
workspaceSchema.index({ createdAt: -1 });

/**
 * Ensures any user has a primary workspace without blocking them with wizards.
 * Frictionless solo-user default.
 */
workspaceSchema.statics.findOrCreateSoloWorkspace = async function(user) {
  if (!user || !user._id) return null;

  const WorkspaceMembership = mongoose.models.WorkspaceMembership || require('./WorkspaceMembership');

  // Check if user already has an active membership in any workspace
  const existingMembership = await WorkspaceMembership.findOne({
    userId: user._id,
    status: 'active',
  }).populate('workspaceId').lean();

  if (existingMembership && existingMembership.workspaceId && !existingMembership.workspaceId.deletedAt) {
    return existingMembership.workspaceId;
  }

  // Check if workspace already exists where user is owner
  let workspace = await this.findOne({ ownerId: user._id, deletedAt: null });

  if (!workspace) {
    const wsName = user.companyInfo?.companyName || `${user.name || 'Counselor'}'s Workspace`;
    workspace = await this.create({
      name: wsName,
      ownerId: user._id,
      industryType: user.industryType || 'Education',
      subProfile: user.educationSubProfile || 'admission_consultants',
      plan: user.plan || 'free',
      planEndDate: user.planEndDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      settings: {
        showFollowUpOnCreate: user.showFollowUpOnCreate !== false,
      },
    });
  }

  // Ensure owner membership exists
  await WorkspaceMembership.findOneAndUpdate(
    { workspaceId: workspace._id, userId: user._id },
    {
      $set: {
        workspaceId: workspace._id,
        userId: user._id,
        role: 'owner',
        status: 'active',
      },
      $setOnInsert: { joinedAt: new Date() }
    },
    { upsert: true, new: true }
  );

  return workspace;
};

workspaceSchema.post(['save', 'findOneAndUpdate', 'findByIdAndUpdate', 'updateOne'], function (doc) {
  try {
    const { invalidateWorkspaceCache } = require('../utils/authCache');
    const id = doc?._id || (this.getQuery ? this.getQuery()?._id : null);
    if (id) invalidateWorkspaceCache(id);
  } catch (_) {}
});

module.exports = mongoose.models.Workspace || mongoose.model('Workspace', workspaceSchema);

