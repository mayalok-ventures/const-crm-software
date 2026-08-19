const mongoose = require('mongoose');
const { getIndustryDefaults, getEducationSubProfileDefaults, EDUCATION_SUB_PROFILES, INDUSTRY_TEMPLATES } = require('../utils/industryTemplates');

const customFieldSchema = new mongoose.Schema({
  fieldId: { type: String, required: true, trim: true },
  label: { type: String, required: true, trim: true },
  fieldType: {
    type: String,
    enum: ['text', 'phone', 'email', 'dropdown', 'date', 'number', 'boolean', 'textarea', 'currency'],
    default: 'text'
  },
  isRequired: { type: Boolean, default: false },
  isSystem: { type: Boolean, default: false },
  isHidden: { type: Boolean, default: false },
  options: [{ type: String, trim: true }],
  defaultValue: { type: mongoose.Schema.Types.Mixed, default: null },
  order: { type: Number, default: 1 },
  dependsOn: {
    field: { type: String, default: null },
    value: { type: mongoose.Schema.Types.Mixed, default: null }
  }
}, { _id: false });

const tenantConfigSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },
  industryType: {
    type: String,
    enum: ['Education', 'Consulting', 'Agency', 'SaaS', 'Real Estate', 'E-Commerce', 'Healthcare', 'Event Management', 'Other'],
    default: 'Education',
    trim: true,
  },
  educationSubProfile: {
    type: String,
    enum: ['higher_education', 'edtech', 'study_abroad', 'test_prep', 'k12', 'admission_consultants', 'other', null],
    default: null,
    trim: true,
  },
  pipelineStages: [{
    type: String,
    trim: true,
  }],
  dualPipelines: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  customFields: [customFieldSchema],
  automationSettings: {
    roundRobinEnabled: { type: Boolean, default: false },
    lastAssignedAgentIndex: { type: Number, default: -1 },
    abandonedCartWhatsApp: { type: Boolean, default: true },
    abandonedCartDelayMinutes: { type: Number, default: 15 },
    countryChecklistAutoAttach: { type: Boolean, default: true },
    feeDueAlertsEnabled: { type: Boolean, default: true },
    feeDueDaysNotice: { type: Number, default: 5 },
    docVerificationTaskEnabled: { type: Boolean, default: true },
    stallInventoryLockEnabled: { type: Boolean, default: true },
    eventPassGenerationEnabled: { type: Boolean, default: true },
  },
  version: { type: Number, default: 1 },
}, { timestamps: true });

tenantConfigSchema.index({ userId: 1, industryType: 1 });
tenantConfigSchema.index({ companyId: 1, industryType: 1 });

/**
 * Seed or update tenant workspace configuration based on Industry & Education Sub-Profile
 */
tenantConfigSchema.statics.seedWorkspace = async function(userId, industryType = 'Education', educationSubProfile = null, companyId = null) {
  const User = mongoose.models.User || require('./User');
  const Project = mongoose.models.Project || require('./Project');
  
  // Resolve defaults from industry templates
  let template = null;
  if (educationSubProfile) {
    template = getEducationSubProfileDefaults(educationSubProfile);
  }
  if (!template) {
    template = getIndustryDefaults(industryType, educationSubProfile);
  }

  const stages = template?.pipelineStages || [
    'New Lead', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won', 'Lost'
  ];
  
  const fields = template?.leadFormSchema || [];
  const dualPipelines = template?.dualPipelines || {};

  // Default automation settings tailored to the sub-profile / vertical
  const isEdTech = educationSubProfile === 'edtech';
  const isStudyAbroad = educationSubProfile === 'study_abroad';
  const isTestPrep = educationSubProfile === 'test_prep';
  const isHigherEd = educationSubProfile === 'higher_education';
  const isK12 = educationSubProfile === 'k12';
  const isEventMgmt = String(industryType).toLowerCase().includes('event');

  const automationSettings = {
    roundRobinEnabled: isEdTech,
    lastAssignedAgentIndex: -1,
    abandonedCartWhatsApp: isEdTech,
    abandonedCartDelayMinutes: 15,
    countryChecklistAutoAttach: isStudyAbroad,
    feeDueAlertsEnabled: isTestPrep || isK12,
    feeDueDaysNotice: 5,
    docVerificationTaskEnabled: isHigherEd,
    stallInventoryLockEnabled: isEventMgmt,
    eventPassGenerationEnabled: isEventMgmt,
  };

  const config = await this.findOneAndUpdate(
    { userId },
    {
      $set: {
        userId,
        companyId,
        industryType,
        educationSubProfile: educationSubProfile || null,
        pipelineStages: stages,
        dualPipelines,
        customFields: fields,
        automationSettings,
      },
      $inc: { version: 1 }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Sync onto the User document so existing UI hooks, forms, and custom stage pickers stay 100% unified
  await User.findByIdAndUpdate(userId, {
    $set: {
      industryType,
      educationSubProfile: educationSubProfile || null,
      pipelineStages: stages,
      customPipelineStages: stages,
      leadFormSchema: fields,
    }
  });

  // Seed default product catalog for Event Management (Stalls, Sponsorships, Add-ons) if needed
  if (template?.defaultProducts && Array.isArray(template.defaultProducts)) {
    const existingProjectsCount = await Project.countDocuments({ userId });
    if (existingProjectsCount === 0) {
      const projectsToSeed = template.defaultProducts.map(p => ({
        ...p,
        userId,
        companyId: companyId || null,
      }));
      await Project.insertMany(projectsToSeed).catch((pErr) => {
        console.warn('[TenantConfig] Product seeding notice:', pErr.message);
      });
      console.log(`[TenantConfig] Seeded ${projectsToSeed.length} event products for user ${userId}`);
    }
  }

  return config;
};

module.exports = mongoose.model('TenantConfig', tenantConfigSchema);

