const mongoose = require('mongoose');
const { getIndustryDefaults, ADMISSION_CONSULTANTS_TEMPLATE } = require('../utils/industryTemplates');

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
    enum: ['Education'],
    default: 'Education',
    trim: true,
  },
  educationSubProfile: {
    type: String,
    enum: ['admission_consultants'],
    default: 'admission_consultants',
    trim: true,
  },
  pipelineStages: [{
    type: String,
    trim: true,
  }],
  customFields: [customFieldSchema],
  automationSettings: {
    roundRobinEnabled: { type: Boolean, default: true },
    lastAssignedAgentIndex: { type: Number, default: -1 },
    feeDueAlertsEnabled: { type: Boolean, default: true },
    feeDueDaysNotice: { type: Number, default: 5 },
    docVerificationTaskEnabled: { type: Boolean, default: true },
    quotaFilingAlertsEnabled: { type: Boolean, default: true },
  },
  version: { type: Number, default: 1 },
}, { timestamps: true });


/**
 * Seed or update tenant workspace configuration for Admission Consultants
 */
tenantConfigSchema.statics.seedWorkspace = async function(userId, industryType = 'Education', educationSubProfile = 'admission_consultants', companyId = null) {
  const User = mongoose.models.User || require('./User');
  
  const template = ADMISSION_CONSULTANTS_TEMPLATE;
  const stages = template.pipelineStages;
  const fields = template.leadFormSchema;

  const automationSettings = {
    roundRobinEnabled: true,
    lastAssignedAgentIndex: -1,
    feeDueAlertsEnabled: true,
    feeDueDaysNotice: 5,
    docVerificationTaskEnabled: true,
    quotaFilingAlertsEnabled: true,
  };

  const config = await this.findOneAndUpdate(
    { userId },
    {
      $set: {
        userId,
        companyId,
        industryType: 'Education',
        educationSubProfile: 'admission_consultants',
        pipelineStages: stages,
        customFields: fields,
        automationSettings,
      },
      $inc: { version: 1 }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Sync onto the User document so UI hooks and pipeline pickers stay 100% unified
  await User.findByIdAndUpdate(userId, {
    $set: {
      industryType: 'Education',
      educationSubProfile: 'admission_consultants',
      pipelineStages: stages,
      customPipelineStages: stages,
      leadFormSchema: fields,
    }
  });

  return config;
};

module.exports = mongoose.model('TenantConfig', tenantConfigSchema);
