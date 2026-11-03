/**
 * Sahyak CRM — Canonical Placeholder & Merge Tag Resolver
 * 
 * Single authoritative source of truth for resolving dynamic placeholders
 * across Emails (manual compose, scheduled, replies), Automations, WhatsApp,
 * SMS, and Broadcast Campaigns.
 */

const PLACEHOLDER_DEFINITIONS = [
  // ── 1. Candidate / Student Information ──
  {
    tag: '{{name}}',
    aliases: ['{name}', '{{leadName}}', '{{studentName}}', '{{fullName}}'],
    label: 'Candidate Full Name',
    category: 'Candidate',
    description: "The prospective student or lead's full display name.",
    sample: 'Aarav Patel',
    getter: (lead, custom) => lead?.name || custom?.name || '',
  },
  {
    tag: '{{firstName}}',
    aliases: ['{firstName}', '{{first_name}}'],
    label: 'Candidate First Name',
    category: 'Candidate',
    description: "The first name extracted from the candidate's full name.",
    sample: 'Aarav',
    getter: (lead, custom) => {
      const full = lead?.name || custom?.name || '';
      return full.trim().split(/\s+/)[0] || '';
    },
  },
  {
    tag: '{{lastName}}',
    aliases: ['{lastName}', '{{last_name}}'],
    label: 'Candidate Last Name',
    category: 'Candidate',
    description: "The last name extracted from the candidate's full name.",
    sample: 'Patel',
    getter: (lead, custom) => {
      const parts = (lead?.name || custom?.name || '').trim().split(/\s+/);
      return parts.length > 1 ? parts.slice(1).join(' ') : '';
    },
  },
  {
    tag: '{{email}}',
    aliases: ['{email}', '{{leadEmail}}', '{{studentEmail}}'],
    label: 'Candidate Email',
    category: 'Candidate',
    description: "The candidate's primary email address.",
    sample: 'aarav.patel@example.com',
    getter: (lead, custom) => lead?.email || custom?.email || '',
  },
  {
    tag: '{{phone}}',
    aliases: ['{phone}', '{{leadPhone}}', '{{mobile}}'],
    label: 'Candidate Phone',
    category: 'Candidate',
    description: "The candidate's primary mobile phone number.",
    sample: '+91 98765 43210',
    getter: (lead, custom) => lead?.phone || custom?.phone || '',
  },
  {
    tag: '{{course}}',
    aliases: ['{course}', '{{program}}', '{{targetCourse}}', '{{targetStream}}'],
    label: 'Target Program / Course',
    category: 'Candidate',
    description: 'Target academic course, degree, or stream of interest.',
    sample: 'B.Tech AI & Data Science',
    getter: (lead, custom) => (
      lead?.targetCourse ||
      lead?.course ||
      lead?.customData?.course ||
      lead?.customData?.programName ||
      lead?.customData?.targetExam ||
      lead?.targetStream ||
      custom?.course ||
      ''
    ),
  },
  {
    tag: '{{city}}',
    aliases: ['{city}', '{{location}}', '{{targetCity}}'],
    label: 'Candidate City / Location',
    category: 'Candidate',
    description: "The candidate's residence city or region.",
    sample: 'Pune',
    getter: (lead, custom) => (
      lead?.targetCity ||
      lead?.city ||
      lead?.customData?.city ||
      custom?.city ||
      ''
    ),
  },
  {
    tag: '{{stage}}',
    aliases: ['{stage}', '{{status}}', '{status}', '{{leadStage}}'],
    label: 'Pipeline Stage',
    category: 'Candidate',
    description: 'Current sales or admissions pipeline stage of the lead.',
    sample: 'Counseling Scheduled',
    getter: (lead, custom) => lead?.status || custom?.stage || custom?.status || '',
  },
  {
    tag: '{{source}}',
    aliases: ['{source}', '{{leadSource}}'],
    label: 'Acquisition Source',
    category: 'Candidate',
    description: 'Inbound channel through which the lead entered the CRM.',
    sample: 'Meta Ads',
    getter: (lead, custom) => lead?.primarySource || lead?.source || custom?.source || '',
  },
  {
    tag: '{{amount}}',
    aliases: ['{amount}', '{{fee}}', '{{payable_amount}}', '{{dealValue}}'],
    label: 'Fee / Deal Amount',
    category: 'Candidate',
    description: 'Final tuition fee, deal value, or payable token amount.',
    sample: '150000',
    getter: (lead, custom) => {
      const amt = (
        lead?.payable_amount !== undefined && lead?.payable_amount !== null && lead?.payable_amount !== '' ? lead.payable_amount :
        lead?.admissionFinalFee !== undefined && lead?.admissionFinalFee !== null && lead?.admissionFinalFee !== '' ? lead.admissionFinalFee :
        lead?.dealValue !== undefined && lead?.dealValue !== null && lead?.dealValue !== '' ? lead.dealValue :
        lead?.packageBudget !== undefined && lead?.packageBudget !== null && lead?.packageBudget !== '' ? lead.packageBudget :
        lead?.customData?.feeAmount !== undefined && lead?.customData?.feeAmount !== null && lead?.customData?.feeAmount !== '' ? lead.customData.feeAmount :
        custom?.amount ||
        ''
      );
      if (amt === undefined || amt === null) return '';
      return String(amt).trim();
    },
  },
  {
    tag: '{{company}}',
    aliases: ['{company}'],
    label: 'Candidate Organization / College',
    category: 'Candidate',
    description: 'Candidate current school, college, or employing organization.',
    sample: 'Apex Institute',
    getter: (lead, custom) => lead?.company || lead?.customData?.college || custom?.company || '',
  },

  // ── 2. Counselor / Sender Information ──
  {
    tag: '{{counselorName}}',
    aliases: [
      '{counselorName}',
      '{{counsellorName}}',
      '{{counselor}}',
      '{{counsellor}}',
      '{{agentName}}',
      '{{senderName}}',
    ],
    label: 'Assigned Counselor Name',
    category: 'Counselor',
    description: 'Name of the counselor assigned to the lead, or current sender.',
    sample: 'Dr. Ramesh Sharma',
    getter: (lead, custom, user, account) => (
      lead?.assignedToName ||
      user?.name ||
      account?.displayName ||
      custom?.counselorName ||
      'Admissions Counselor'
    ),
  },
  {
    tag: '{{counselorPhone}}',
    aliases: [
      '{counselorPhone}',
      '{{counsellorPhone}}',
      '{{counselorMobile}}',
      '{{senderPhone}}',
    ],
    label: 'Counselor Phone',
    category: 'Counselor',
    description: 'Direct contact phone number of the assigned counselor or sender.',
    sample: '+91 91234 56789',
    getter: (lead, custom, user) => (
      user?.phone ||
      lead?.assignedToPhone ||
      custom?.counselorPhone ||
      custom?.phone ||
      ''
    ),
  },
  {
    tag: '{{counselorEmail}}',
    aliases: [
      '{counselorEmail}',
      '{{counselloremail}}',
      '{{senderEmail}}',
    ],
    label: 'Counselor Official Email',
    category: 'Counselor',
    description: 'Official email address of the counselor or connected mailbox.',
    sample: 'ramesh@sahyak.com',
    getter: (lead, custom, user, account) => (
      user?.email ||
      account?.email ||
      lead?.assignedToEmail ||
      custom?.counselorEmail ||
      ''
    ),
  },

  // ── 3. Organization & Workspace ──
  {
    tag: '{{companyName}}',
    aliases: [
      '{companyName}',
      '{{organizationName}}',
      '{{workspaceName}}',
      '{{instituteName}}',
    ],
    label: 'Organization / Institution Name',
    category: 'Organization',
    description: 'The institution, university, or workspace organization name.',
    sample: 'Sahyak Education Group',
    getter: (lead, custom, user, account, workspace) => (
      workspace?.name ||
      user?.companyName ||
      user?.workspaceName ||
      user?.workspace?.name ||
      user?.organizationName ||
      custom?.companyName ||
      custom?.workspaceName ||
      'Admissions Desk'
    ),
  },

  // ── 4. System & Dynamic Dates ──
  {
    tag: '{{today}}',
    aliases: ['{today}', '{{date}}', '{date}'],
    label: "Today's Date",
    category: 'System',
    description: 'Current formatted date when the message is dispatched.',
    sample: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    getter: () => new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
  },
  {
    tag: '{{year}}',
    aliases: ['{year}', '{{currentYear}}'],
    label: 'Current Year',
    category: 'System',
    description: 'Current 4-digit calendar year.',
    sample: String(new Date().getFullYear()),
    getter: () => String(new Date().getFullYear()),
  },
];

/**
 * Resolves all double curly {{tag}} and single {tag} placeholders in text or HTML.
 * 
 * @param {string} content - Raw template text or HTML string
 * @param {Object} context - Execution context { lead, user, account, workspace, custom, fallback }
 * @returns {string} Fully substituted string with zero raw placeholder tokens remaining
 */
function resolvePlaceholders(content, context = {}) {
  if (!content || typeof content !== 'string') return '';

  const {
    lead = {},
    user = {},
    account = {},
    workspace = {},
    custom = {},
    fallback = '', // Value to substitute if a recognized or unrecognized tag is missing
  } = context;

  // Build key-lookup map (case-insensitive)
  const map = new Map();

  for (const def of PLACEHOLDER_DEFINITIONS) {
    const val = def.getter(lead, custom, user, account, workspace);
    const resolvedVal = val !== undefined && val !== null ? String(val) : fallback;

    // Map primary tag without braces
    const cleanPrimary = def.tag.replace(/[{}]/g, '').toLowerCase();
    map.set(cleanPrimary, resolvedVal);

    // Map aliases
    if (def.aliases) {
      for (const alias of def.aliases) {
        const cleanAlias = alias.replace(/[{}]/g, '').toLowerCase();
        map.set(cleanAlias, resolvedVal);
      }
    }
  }

  // Also include custom lead data if available (e.g. {{application_no}}, {{scholarship_code}})
  if (lead?.customData && typeof lead.customData === 'object') {
    for (const [k, v] of Object.entries(lead.customData)) {
      if (v !== undefined && v !== null) {
        map.set(k.toLowerCase(), String(v));
      }
    }
  }

  if (lead && typeof lead === 'object') {
    for (const [k, v] of Object.entries(lead)) {
      if (typeof v === 'string' || typeof v === 'number') {
        const lowerKey = k.toLowerCase();
        if (!map.has(lowerKey)) {
          map.set(lowerKey, String(v));
        }
      }
    }
  }

  // Replace double curly brackets: {{ variable }}
  let result = content.replace(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g, (fullMatch, varName) => {
    const key = varName.trim().toLowerCase();
    if (map.has(key)) {
      return map.get(key);
    }
    // Check if custom field exists on lead or custom context
    if (custom && custom[varName] !== undefined) {
      return String(custom[varName]);
    }
    // Cleanly replace unmatched placeholder with fallback rather than leaking raw tag
    return fallback;
  });

  // Also replace legacy single-brace syntax: {name}, {phone}, etc. (excluding CSS style blocks if in HTML)
  result = result.replace(/\{([a-zA-Z0-9_]{2,30})\}/g, (fullMatch, varName) => {
    const key = varName.trim().toLowerCase();
    if (map.has(key)) {
      return map.get(key);
    }
    return fullMatch; // Keep intact if not a CRM placeholder (might be JSON or CSS)
  });

  return result;
}

/**
 * Returns complete registry of supported placeholders with live values if context is provided
 * 
 * @param {Object} context - Optional context to evaluate live dynamic values
 * @returns {Array} List of placeholder definitions with sample and live values
 */
function getPlaceholderRegistry(context = {}) {
  const { lead = {}, user = {}, account = {}, workspace = {}, custom = {} } = context;
  const hasLiveLead = Boolean(lead && (lead._id || lead.name || lead.email || lead.phone));

  return PLACEHOLDER_DEFINITIONS.map(def => {
    const liveVal = def.getter(lead, custom, user, account, workspace);
    return {
      tag: def.tag,
      label: def.label,
      category: def.category,
      description: def.description,
      sampleValue: def.sample,
      liveValue: liveVal || '',
      hasLiveData: hasLiveLead && Boolean(liveVal),
    };
  });
}

/**
 * Extracts all unique placeholder tags found in the given content
 */
function extractPlaceholders(content) {
  if (!content || typeof content !== 'string') return [];
  const matches = content.match(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g) || [];
  return Array.from(new Set(matches.map(m => m.replace(/[{}]/g, '').trim())));
}

module.exports = {
  PLACEHOLDER_DEFINITIONS,
  resolvePlaceholders,
  getPlaceholderRegistry,
  extractPlaceholders,
};
