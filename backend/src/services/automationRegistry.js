/**
 * Sahyak CRM — Canonical Automation Capability Registry
 * 
 * Authoritative single source of truth for:
 * 1. Supported Triggers, Categories, and Configuration Schemas
 * 2. Supported CRM Fields and Comparison Operators
 * 3. Supported Actions, Inputs, and Execution Handlers
 * 4. Context Variables and Missing-Value Fallbacks
 * 5. Rule Validation & Dynamic Human-Readable Summary Generation
 */

const CRM_FIELDS = [
  {
    id: 'source',
    label: 'Lead Source',
    type: 'select',
    options: [
      { id: 'meta_ads', label: 'Meta / Facebook Ads' },
      { id: 'google_ads', label: 'Google Search Ads' },
      { id: 'website_form', label: 'Website Form' },
      { id: 'landing_page', label: 'Landing Page' },
      { id: 'whatsapp_direct', label: 'Direct WhatsApp' },
      { id: 'walk_in', label: 'Walk-in / Campus Visit' },
      { id: 'referral', label: 'Student Referral' },
      { id: 'education_fair', label: 'Education Fair / Expo' },
      { id: 'portal', label: 'Admissions Portal' },
      { id: 'manual', label: 'Manually Added' },
    ],
    operators: ['equals', 'not_equals', 'in', 'not_in', 'is_empty', 'is_not_empty'],
  },
  {
    id: 'status',
    label: 'Lead Stage / Status',
    type: 'stage_select',
    operators: ['equals', 'not_equals', 'in', 'not_in'],
  },
  {
    id: 'city',
    label: 'City / Region',
    type: 'string',
    operators: ['equals', 'not_equals', 'contains', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty'],
  },
  {
    id: 'course',
    label: 'Target Program / Course',
    type: 'string',
    operators: ['equals', 'not_equals', 'contains', 'is_empty', 'is_not_empty'],
  },
  {
    id: 'payable_amount',
    label: 'Tuition Fee / Deal Value (₹)',
    type: 'number',
    operators: ['equals', 'not_equals', 'gt', 'gte', 'lt', 'lte', 'is_empty', 'is_not_empty'],
  },
  {
    id: 'tags',
    label: 'Lead Tags',
    type: 'string',
    operators: ['contains', 'not_contains', 'is_empty', 'is_not_empty'],
  },
];

const OPERATORS = [
  { id: 'equals', label: 'is equal to', symbol: '=' },
  { id: 'not_equals', label: 'is not equal to', symbol: '≠' },
  { id: 'contains', label: 'contains', symbol: '∋' },
  { id: 'not_contains', label: 'does not contain', symbol: '∌' },
  { id: 'starts_with', label: 'starts with', symbol: '^' },
  { id: 'ends_with', label: 'ends with', symbol: '$' },
  { id: 'gt', label: 'is greater than', symbol: '>' },
  { id: 'gte', label: 'is greater than or equal to', symbol: '≥' },
  { id: 'lt', label: 'is less than', symbol: '<' },
  { id: 'lte', label: 'is less than or equal to', symbol: '≤' },
  { id: 'is_empty', label: 'is empty / not set', symbol: '∅' },
  { id: 'is_not_empty', label: 'has any value', symbol: '✓' },
  { id: 'in', label: 'is one of', symbol: '∈' },
  { id: 'not_in', label: 'is not one of', symbol: '∉' },
];

const TRIGGERS = [
  {
    id: 'lead_created',
    name: 'New Lead Arrives',
    category: 'lead_lifecycle',
    description: 'Runs immediately when a new prospective student or lead enters the CRM (via API, Ads, Webhook, or Manual Entry).',
    badge: 'Real-Time',
    icon: 'UserPlus',
    configSchema: {
      leadSources: { type: 'array', required: false, label: 'Filter by Lead Sources (Optional)' },
    },
  },
  {
    id: 'stage_changed',
    name: 'Pipeline Stage Changes',
    category: 'pipeline',
    description: 'Runs when a lead is moved from one stage to another along the admissions or sales pipeline.',
    badge: 'Pipeline',
    icon: 'GitBranch',
    configSchema: {
      targetStage: { type: 'string', required: true, label: 'When Moved to Stage' },
      fromStage: { type: 'string', required: false, label: 'Only if Coming From Stage (Optional)' },
    },
  },
  {
    id: 'stage_reached',
    name: 'Milestone Stage Reached',
    category: 'pipeline',
    description: 'Runs whenever a candidate achieves an admissions milestone (e.g. Campus Visit Booked, Application Submitted, Offer Made).',
    badge: 'Milestone',
    icon: 'Target',
    configSchema: {
      targetStage: { type: 'string', required: true, label: 'Milestone Stage' },
    },
  },
  {
    id: 'stage_duration',
    name: 'Lead Inactive in Stage',
    category: 'inactivity',
    description: 'Runs automatically when a lead has remained stuck in a specific stage without any activity for a set number of days.',
    badge: 'Scheduled',
    icon: 'Clock',
    configSchema: {
      targetStage: { type: 'string', required: true, label: 'Inactive Stage' },
      daysInStage: { type: 'number', required: true, default: 3, min: 1, label: 'Days of Inactivity Threshold' },
    },
  },
  {
    id: 'whatsapp_inbound',
    name: 'Inbound WhatsApp Message',
    category: 'chatbots',
    description: 'Runs when a customer sends a WhatsApp message matching specific keywords or commands.',
    badge: 'Chatbot',
    icon: 'Bot',
    configSchema: {
      keywords: { type: 'array', required: true, label: 'Trigger Keywords (e.g. "hi", "fees", "courses")' },
      matchType: { type: 'string', required: true, default: 'contains', enum: ['contains', 'exact'] },
    },
  },
];

const ACTIONS = [
  {
    id: 'send_whatsapp',
    name: 'Send WhatsApp Message',
    category: 'communication',
    description: 'Dispatches an automated personalized WhatsApp message to the student or contact.',
    icon: 'MessageCircle',
    channel: 'whatsapp',
    configSchema: {
      templateText: { type: 'string', required: true, label: 'WhatsApp Message Content' },
    },
  },
  {
    id: 'send_email',
    name: 'Send Official Email',
    category: 'communication',
    description: 'Sends an admissions prospectus, formal acknowledgment, or notice via email.',
    icon: 'Mail',
    channel: 'email',
    configSchema: {
      emailSubject: { type: 'string', required: true, label: 'Email Subject' },
      templateText: { type: 'string', required: true, label: 'Email Body Content' },
    },
  },
  {
    id: 'assign_counselor',
    name: 'Assign Counselor',
    category: 'routing',
    description: 'Directly assigns or reassigns the lead to a dedicated admissions counselor or sales agent.',
    icon: 'UserCheck',
    channel: 'internal',
    configSchema: {
      assignedUserId: { type: 'string', required: true, label: 'Select Counselor' },
    },
  },
  {
    id: 'transfer_lead',
    name: 'Transfer Lead & Routing',
    category: 'routing',
    description: 'Transfers the lead to another counselor, inbound campaign pool, or escalation queue with notes.',
    icon: 'ArrowRightLeft',
    channel: 'internal',
    configSchema: {
      assignedUserId: { type: 'string', required: false, label: 'Reassign to Counselor (Optional)' },
      targetCampaignId: { type: 'string', required: false, label: 'Route to Campaign Pool (Optional)' },
      newStage: { type: 'string', required: false, label: 'Move to Stage (Optional)' },
      transferNote: { type: 'string', required: false, label: 'Reason / Transfer Note' },
    },
  },
  {
    id: 'update_lead_stage',
    name: 'Update Lead Stage',
    category: 'pipeline',
    description: 'Automatically transitions the lead into a new pipeline stage.',
    icon: 'GitCommit',
    channel: 'internal',
    configSchema: {
      newStage: { type: 'string', required: true, label: 'New Target Stage' },
    },
  },
  {
    id: 'add_lead_tag',
    name: 'Add Tag to Lead',
    category: 'lead_lifecycle',
    description: 'Applies a searchable categorization tag (e.g. "VIP", "Needs Document", "High Intent") to the lead.',
    icon: 'Tag',
    channel: 'internal',
    configSchema: {
      tagToAdd: { type: 'string', required: true, label: 'Tag Name' },
    },
  },
];

const CONTEXT_VARIABLES = [
  { tag: '{{name}}', label: 'Lead / Student Name', example: 'Aarav Patel', category: 'Student' },
  { tag: '{{course}}', label: 'Target Program / Course', example: 'B.Tech AI & Data Science', category: 'Academic' },
  { tag: '{{phone}}', label: 'Lead Phone Number', example: '+91 98765 43210', category: 'Contact' },
  { tag: '{{email}}', label: 'Lead Email Address', example: 'aarav.patel@example.com', category: 'Contact' },
  { tag: '{{city}}', label: 'City / Region', example: 'Pune', category: 'Student' },
  { tag: '{{stage}}', label: 'Current Pipeline Stage', example: 'Campus Visit Scheduled', category: 'CRM' },
  { tag: '{{counselorName}}', label: 'Assigned Counselor Name', example: 'Dr. Ramesh Sharma', category: 'Counselor' },
  { tag: '{{counselorPhone}}', label: 'Assigned Counselor Phone', example: '+91 91234 56789', category: 'Counselor' },
  { tag: '{{counselorEmail}}', label: 'Assigned Counselor Email', example: 'ramesh@apexedu.in', category: 'Counselor' },
  { tag: '{{companyName}}', label: 'Institution / Organization Name', example: 'Apex Education Group', category: 'Organization' },
  { tag: '{{source}}', label: 'Lead Acquisition Source', example: 'meta_ads', category: 'CRM' },
  { tag: '{{amount}}', label: 'Tuition Fee / Deal Amount (₹)', example: '1,50,000', category: 'Financial' },
];

const STARTER_RECIPES = [
  {
    id: 'instant_lead_wa',
    name: 'Speed-to-Lead Instant WhatsApp Welcome',
    category: 'lead_lifecycle',
    description: 'Instantly greet every new lead on WhatsApp within seconds of form submission.',
    triggerType: 'lead_created',
    triggerConfig: {},
    conditions: [],
    conditionsMatch: 'all',
    actions: [
      {
        actionType: 'send_whatsapp',
        delayMinutes: 0,
        config: {
          whatsappMessage: 'Hello {{name}}! 👋 Thank you for your interest in {{course}} at {{companyName}}. I am {{counselorName}}, your personal admissions counselor. Could you share your 12th/Graduation percentage so I can share the fee prospectus with you?',
        },
      },
    ],
  },
  {
    id: 'welcome_email_prospectus',
    name: 'Official Email Prospectus & Brochure Delivery',
    category: 'communication',
    description: 'Send a formal admissions welcome email with brochure guidance 2 minutes after inquiry.',
    triggerType: 'lead_created',
    triggerConfig: {},
    conditions: [],
    conditionsMatch: 'all',
    actions: [
      {
        actionType: 'send_email',
        delayMinutes: 2,
        config: {
          emailSubject: 'Welcome to {{companyName}} - Admissions Prospectus for {{course}}',
          emailBody: 'Dear {{name}},\n\nThank you for reaching out regarding admissions into {{course}} at {{companyName}}.\n\nYour application has been received and assigned to {{counselorName}}.\n\nIf you have any urgent questions, please feel free to reach out directly via WhatsApp or phone at {{counselorPhone}}.\n\nWarm regards,\nAdmissions Office',
        },
      },
    ],
  },
  {
    id: 'stale_lead_escalation',
    name: 'Auto-Escalate Leads Stuck for 3+ Days',
    category: 'inactivity',
    description: 'Reassign stagnant leads that have had no progress for 3 days to senior counseling.',
    triggerType: 'stage_duration',
    triggerConfig: {
      targetStage: 'New Lead',
      daysInStage: 3,
    },
    conditions: [],
    conditionsMatch: 'all',
    actions: [
      {
        actionType: 'add_lead_tag',
        delayMinutes: 0,
        config: {
          tagToAdd: 'Stagnant Lead',
        },
      },
      {
        actionType: 'transfer_lead',
        delayMinutes: 0,
        config: {
          transferNote: 'Automated transfer: Lead inactive in stage for 3+ days',
        },
      },
    ],
  },
  {
    id: 'campus_visit_milestone',
    name: 'Campus Visit Scheduled VIP Directions',
    category: 'pipeline',
    description: 'Send campus Google Maps location, office hours, and checklist when a visit is confirmed.',
    triggerType: 'stage_reached',
    triggerConfig: {
      targetStage: 'Campus Visit Scheduled',
    },
    conditions: [],
    conditionsMatch: 'all',
    actions: [
      {
        actionType: 'send_whatsapp',
        delayMinutes: 0,
        config: {
          whatsappMessage: 'Dear {{name}}, your campus visit to {{companyName}} is confirmed! 🏛️\n\n📍 Admissions Block, Main University Campus\n🕒 Visiting Hours: Monday to Saturday, 9:30 AM to 5:00 PM\n\nPlease carry:\n1. 10th & 12th Marksheets\n2. Valid Government ID\n\nNeed directions? Call your counselor {{counselorName}} directly at {{counselorPhone}}.',
        },
      },
    ],
  },
];

class AutomationRegistry {
  /**
   * Returns the complete capability schema for frontend dynamic builder consumption
   */
  static getCapabilities() {
    return {
      triggers: TRIGGERS,
      fields: CRM_FIELDS,
      operators: OPERATORS,
      actions: ACTIONS,
      variables: CONTEXT_VARIABLES,
      recipes: STARTER_RECIPES,
      categories: [
        { id: 'lead_lifecycle', label: 'Lead Management & Speed-to-Lead' },
        { id: 'communication', label: 'Omnichannel Messaging (WhatsApp & Email)' },
        { id: 'pipeline', label: 'Pipeline Stages & Milestones' },
        { id: 'routing', label: 'Counselor Assignment & Escalations' },
        { id: 'inactivity', label: 'Inactivity & Follow-Up Schedulers' },
        { id: 'chatbots', label: 'Inbound WhatsApp Chatbots' },
      ],
    };
  }

  /**
   * Validate a rule payload against the canonical registry
   */
  static validateRule(ruleData) {
    const errors = [];

    if (!ruleData.name || !String(ruleData.name).trim()) {
      errors.push('Automation name is required.');
    }

    const triggerDef = TRIGGERS.find((t) => t.id === ruleData.triggerType);
    if (!triggerDef) {
      errors.push(`Trigger type '${ruleData.triggerType}' is not supported.`);
    } else {
      // Validate trigger config requirements
      if (ruleData.triggerType === 'stage_changed' && !ruleData.triggerConfig?.targetStage) {
        errors.push('Target stage is required for stage changed triggers.');
      }
      if (ruleData.triggerType === 'stage_reached' && !ruleData.triggerConfig?.targetStage) {
        errors.push('Milestone target stage is required for stage reached triggers.');
      }
      if (ruleData.triggerType === 'stage_duration') {
        if (!ruleData.triggerConfig?.targetStage) {
          errors.push('Target stage is required for inactivity triggers.');
        }
        if (Number(ruleData.triggerConfig?.daysInStage || 0) < 1) {
          errors.push('Inactivity threshold must be at least 1 day.');
        }
      }
      if (ruleData.triggerType === 'whatsapp_inbound') {
        const keywords = ruleData.triggerConfig?.keywords;
        if (!keywords || (Array.isArray(keywords) && keywords.length === 0)) {
          errors.push('At least one trigger keyword is required for inbound WhatsApp automations.');
        }
      }
    }

    // Validate conditions
    const conditions = ruleData.triggerConfig?.conditions || ruleData.conditions || [];
    if (Array.isArray(conditions)) {
      for (let i = 0; i < conditions.length; i++) {
        const cond = conditions[i];
        if (!cond.field) {
          errors.push(`Condition #${i + 1} is missing a field.`);
        }
        const opDef = OPERATORS.find((o) => o.id === cond.operator);
        if (!opDef) {
          errors.push(`Condition #${i + 1} has unsupported operator '${cond.operator}'.`);
        }
      }
    }

    // Validate actions array
    const actions = ruleData.actions || [];
    if (!Array.isArray(actions) || actions.length === 0) {
      // If legacy single action config is provided, that's acceptable
      if (!ruleData.actionType) {
        errors.push('At least one action must be configured.');
      }
    } else {
      actions.forEach((act, idx) => {
        const actDef = ACTIONS.find((a) => a.id === act.actionType);
        if (!actDef) {
          errors.push(`Action #${idx + 1} has unsupported action type '${act.actionType}'.`);
        } else {
          const cfg = act.config || {};
          if (act.actionType === 'send_whatsapp' && !cfg.whatsappMessage && !cfg.templateText) {
            errors.push(`Action #${idx + 1} (WhatsApp) requires message content.`);
          }
          if (act.actionType === 'send_email') {
            if (!cfg.emailSubject) errors.push(`Action #${idx + 1} (Email) requires a subject line.`);
            if (!cfg.emailBody && !cfg.templateText) errors.push(`Action #${idx + 1} (Email) requires email body content.`);
          }
          if (act.actionType === 'update_lead_stage' && !cfg.newStage) {
            errors.push(`Action #${idx + 1} requires a target stage.`);
          }
          if (act.actionType === 'add_lead_tag' && !cfg.tagToAdd) {
            errors.push(`Action #${idx + 1} requires a tag name.`);
          }
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generates a dynamic, human-readable natural language summary of what the rule will execute.
   * Example: "When a new lead arrives from Meta Ads, assign to Priya Verma, wait 15 minutes, and send WhatsApp welcome."
   */
  static generateRuleSummary(rule) {
    if (!rule) return '';

    let triggerPart = '';
    const triggerType = rule.triggerType;
    const cfg = rule.triggerConfig || {};

    switch (triggerType) {
      case 'lead_created': {
        const sources = cfg.leadSources;
        if (Array.isArray(sources) && sources.length > 0) {
          triggerPart = `When a new lead arrives from ${sources.join(', ')}`;
        } else {
          triggerPart = 'When a new lead arrives from any source';
        }
        break;
      }
      case 'stage_changed': {
        if (cfg.fromStage) {
          triggerPart = `When lead moves from "${cfg.fromStage}" to "${cfg.targetStage}"`;
        } else {
          triggerPart = `When lead stage changes to "${cfg.targetStage}"`;
        }
        break;
      }
      case 'stage_reached': {
        triggerPart = `When lead reaches milestone stage "${cfg.targetStage}"`;
        break;
      }
      case 'stage_duration': {
        triggerPart = `When lead remains inactive in "${cfg.targetStage}" for ${cfg.daysInStage || 3} days`;
        break;
      }
      case 'whatsapp_inbound': {
        const kwList = Array.isArray(cfg.keywords) ? cfg.keywords.map((k) => `"${k}"`).join(', ') : 'keywords';
        triggerPart = `When inbound WhatsApp message matches ${kwList}`;
        break;
      }
      default:
        triggerPart = `When ${triggerType} occurs`;
    }

    // Conditions
    let conditionPart = '';
    const conditions = cfg.conditions || rule.conditions || [];
    if (Array.isArray(conditions) && conditions.length > 0) {
      const matchWord = cfg.conditionsMatch === 'any' ? 'any of:' : 'all of:';
      const condList = conditions
        .map((c) => {
          const fieldDef = CRM_FIELDS.find((f) => f.id === c.field);
          const fieldLabel = fieldDef?.label || c.field;
          const opDef = OPERATORS.find((o) => o.id === c.operator);
          const opLabel = opDef?.label || c.operator;
          return `${fieldLabel} ${opLabel} ${c.value !== undefined ? `"${c.value}"` : ''}`.trim();
        })
        .join(', ');
      conditionPart = ` (only if ${matchWord} ${condList})`;
    }

    // Actions
    const actions = Array.isArray(rule.actions) && rule.actions.length > 0
      ? rule.actions
      : [
          {
            actionType: rule.actionType,
            delayMinutes: rule.delayMinutes,
            config: rule.actionConfig,
          },
        ];

    const actionParts = actions.map((act) => {
      const delay = Number(act.delayMinutes || 0);
      const delayPrefix = delay > 0 ? `wait ${delay}m then ` : '';

      switch (act.actionType) {
        case 'send_whatsapp':
          return `${delayPrefix}send WhatsApp message`;
        case 'send_email':
          return `${delayPrefix}send official email`;
        case 'assign_counselor':
          return `${delayPrefix}assign to counselor`;
        case 'transfer_lead':
          return `${delayPrefix}transfer lead`;
        case 'update_lead_stage':
          return `${delayPrefix}move stage to "${act.config?.newStage || ''}"`;
        case 'add_lead_tag':
          return `${delayPrefix}add tag "${act.config?.tagToAdd || ''}"`;
        default:
          return `${delayPrefix}${act.actionType?.replace(/_/g, ' ') || 'execute action'}`;
      }
    });

    const actionText = actionParts.length > 0 ? actionParts.join(', then ') : 'execute configured actions';

    return `${triggerPart}${conditionPart} → ${actionText}.`;
  }
}

module.exports = AutomationRegistry;
