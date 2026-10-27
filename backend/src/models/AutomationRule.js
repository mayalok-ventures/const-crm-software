const mongoose = require('mongoose');

/**
 * AutomationRule Schema
 * Drives the CRM Event & Inbound Chatbot Automation Engine:
 * - Lead creation touchpoints (Instant WhatsApp / Welcome Email)
 * - Stage-based pipeline transition drips
 * - Interactive inbound WhatsApp chatbot workflows & keyword menus
 */
const automationRuleSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      index: true,
      default: null,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      default: null,
    },
    name: {
      type: String,
      required: [true, 'Automation rule name is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    category: {
      type: String,
      enum: ['lead_lifecycle', 'stage_pipeline', 'whatsapp_bot', 'email_drip', 'lead_capture', 'inbound_bot', 'pipeline_drip', 'lead_routing', 'nurture', 'custom'],
      default: 'lead_lifecycle',
      index: true,
    },

    // Trigger Definition
    triggerType: {
      type: String,
      enum: ['lead_created', 'stage_changed', 'stage_reached', 'tag_added', 'whatsapp_inbound', 'stage_duration', 'stale_lead'],
      required: [true, 'Trigger type is required'],
      index: true,
    },
    triggerConfig: {
      targetStage: { type: String, default: '', trim: true },
      fromStage: { type: String, default: '', trim: true },
      targetTag: { type: String, default: '', trim: true },
      daysInStage: { type: Number, default: 0, min: 0 },
      pipelineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pipeline', default: null },
      matchType: {
        type: String,
        enum: ['exact', 'contains', 'keyword_exact', 'keyword_contains', 'any', 'first_inbound', 'fallback'],
        default: 'contains',
      },
      keywords: [{ type: String, lowercase: true, trim: true }],
      caseSensitive: { type: Boolean, default: false },
      leadSources: [{ type: String, trim: true }],
      conditions: [{
        field: { type: String, trim: true },
        operator: { type: String, default: 'equals' },
        value: { type: mongoose.Schema.Types.Mixed },
      }],
      conditionsMatch: { type: String, enum: ['all', 'any'], default: 'all' },
    },

    // Primary Channel Target
    channel: {
      type: String,
      enum: ['whatsapp', 'email', 'multi', 'internal'],
      default: 'whatsapp',
      index: true,
    },

    // Single-action shorthand config (for intuitive UI modal binding)
    actionType: {
      type: String,
      enum: ['send_whatsapp', 'send_whatsapp_template', 'send_email', 'send_email_template', 'update_lead_stage', 'add_lead_tag', 'assign_counselor', 'transfer_lead', 'reassign_lead'],
      default: 'send_whatsapp',
    },
    delayMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    actionConfig: {
      templateText: { type: String, default: '' },
      emailSubject: { type: String, default: '' },
      interactiveType: { type: String, default: 'none' },
      interactiveTitle: { type: String, default: '' },
      interactiveOptions: [{
        id: String,
        title: String,
        description: String,
      }],
      assignedUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      targetCampaignId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Campaign',
        default: null,
      },
      newStage: { type: String, default: '' },
      transferNote: { type: String, default: '' },
      tagToAdd: { type: String, default: '' },
      targetTag: { type: String, default: '' },
    },

    // Sequenced Actions (for complex multi-step pipelines)
    actions: [
      {
        actionType: {
          type: String,
          enum: ['send_whatsapp', 'send_whatsapp_template', 'send_email', 'send_email_template', 'update_lead_stage', 'add_lead_tag', 'assign_counselor', 'transfer_lead', 'reassign_lead'],
          required: true,
        },
        delayMinutes: {
          type: Number,
          default: 0,
          min: 0,
        },
        config: {
          // WhatsApp Action details
          whatsappChannel: {
            type: String,
            enum: ['baileys', 'meta_cloud', 'auto'],
            default: 'auto',
          },
          whatsappMessage: {
            type: String,
            default: '',
          },
          templateId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Template',
            default: null,
          },
          metaTemplateName: {
            type: String,
            default: '',
          },

          // Email Action details
          emailSubject: {
            type: String,
            default: '',
          },
          emailBody: {
            type: String,
            default: '',
          },
          emailAccountId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'EmailAccount',
            default: null,
          },

          // Lead update actions
          newStage: {
            type: String,
            default: '',
          },
          tagToAdd: {
            type: String,
            default: '',
          },
          assignedUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
          },
          targetCampaignId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Campaign',
            default: null,
          },
          transferNote: {
            type: String,
            default: '',
          },
        },
      },
    ],

    // Rule State & Performance Metrics
    status: {
      type: String,
      enum: ['active', 'paused', 'draft', 'disabled'],
      default: 'active',
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    summary: {
      type: String,
      default: '',
      trim: true,
    },
    executionCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastExecutedAt: {
      type: Date,
      default: null,
    },
    lastExecutionStatus: {
      type: String,
      default: null,
    },
    lastError: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

automationRuleSchema.index({ workspaceId: 1, isActive: 1, triggerType: 1 });
automationRuleSchema.index({ userId: 1, isActive: 1 });
automationRuleSchema.index({ triggerType: 1, isActive: 1 });

module.exports = mongoose.model('AutomationRule', automationRuleSchema);
