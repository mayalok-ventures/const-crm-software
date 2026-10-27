const Lead = require('../../models/Lead');

/**
 * Lead Fields Registry
 * Introspects the Mongoose Lead model and canonical CRM schema to extract real fields,
 * human-readable labels, data types, and dropdown validations.
 */

// Canonical definition of all supported CRM Lead fields
const CRM_LEAD_FIELDS = [
  {
    key: 'name',
    label: 'Full Name',
    type: 'string',
    required: false,
    synonyms: ['name', 'full name', 'student name', 'candidate name', 'applicant name', 'first name'],
    description: 'Student or candidate full legal name',
  },
  {
    key: 'phone',
    label: 'Phone Number',
    type: 'phone',
    required: false, // Phone OR Email required
    synonyms: ['phone', 'mobile', 'contact', 'whatsapp', 'phone number', 'mobile number', 'contact number', 'tel', 'whatsapp number'],
    description: 'Primary mobile or WhatsApp contact number',
  },
  {
    key: 'email',
    label: 'Email Address',
    type: 'email',
    required: false, // Phone OR Email required
    synonyms: ['email', 'e-mail', 'email address', 'mail', 'email id'],
    description: 'Candidate personal or guardian email',
  },
  {
    key: 'targetCity',
    label: 'City / Location',
    type: 'string',
    synonyms: ['city', 'location', 'town', 'address', 'target city', 'current city'],
    description: 'Candidate location or preferred city',
  },
  {
    key: 'targetCourse',
    label: 'Course / Interest',
    type: 'string',
    synonyms: ['course', 'program', 'interest', 'course / interest', 'target course', 'degree', 'stream applied'],
    description: 'Target academic course or program (e.g. B.Tech CS, MBBS, MBA)',
  },
  {
    key: 'targetStream',
    label: 'Academic Stream',
    type: 'string',
    synonyms: ['stream', 'academic stream', 'field of study', 'department'],
    description: 'Broad stream (e.g. Engineering, Medical, Management, Law)',
  },
  {
    key: 'budget',
    label: 'Budget Range',
    type: 'string',
    synonyms: ['budget', 'annual budget', 'budget range', 'fee budget', 'package'],
    description: 'Candidate financial budget range (e.g. 15-25 Lakhs)',
  },
  {
    key: 'temperature',
    label: 'Lead Quality / Temperature',
    type: 'dropdown',
    allowedValues: ['HOT', 'WARM', 'COLD'],
    default: 'WARM',
    synonyms: ['temperature', 'lead quality', 'lead temperature', 'lead score', 'priority'],
    description: 'Candidate readiness and intent level',
  },
  {
    key: 'quotaPreference',
    label: 'Quota Preference',
    type: 'dropdown',
    allowedValues: ['Merit Quota', 'Management Quota', 'NRI Quota', 'State Quota', 'Any'],
    default: 'Merit Quota',
    synonyms: ['quota', 'quota preference', 'category', 'admission quota'],
    description: 'Admission seat quota type',
  },
  {
    key: 'entranceExam',
    label: 'Entrance Exam',
    type: 'string',
    synonyms: ['entrance exam', 'exam', 'test taken', 'exam name', 'qualifying exam'],
    description: 'Exam appeared (e.g. NEET, JEE Main, CAT, CLAT)',
  },
  {
    key: 'entranceRank',
    label: 'Entrance Rank / Score',
    type: 'string',
    synonyms: ['entrance rank', 'rank', 'percentile', 'score', 'air rank'],
    description: 'All India Rank or percentile achieved',
  },
  {
    key: 'academicScore12th',
    label: '12th / PUC Score (%)',
    type: 'number',
    synonyms: ['12th score', '12th percentage', '12th', 'puc score', 'inter marks', 'academic score'],
    description: 'Senior secondary percentage or GPA',
  },
  {
    key: 'campaign',
    label: 'Campaign Name',
    type: 'string',
    synonyms: ['campaign', 'source', 'utm_campaign', 'ad campaign', 'marketing campaign'],
    description: 'Specific marketing campaign or cohort',
  },
  {
    key: 'notes',
    label: 'Notes / Remarks',
    type: 'string',
    synonyms: ['notes', 'remarks', 'comments', 'additional details', 'counselor notes'],
    description: 'Inquiry remarks or candidate queries',
  },
];

/**
 * Returns the list of standard CRM lead fields with metadata
 */
function getStandardLeadFields() {
  return CRM_LEAD_FIELDS;
}

/**
 * Returns header names for the auto-generated CRM spreadsheet template (Option 2)
 */
function getTemplateHeaderDefinitions() {
  return [
    { name: 'Full Name', field: 'name', width: 160 },
    { name: 'Phone', field: 'phone', width: 140 },
    { name: 'Email', field: 'email', width: 180 },
    { name: 'City', field: 'targetCity', width: 130 },
    { name: 'Course / Interest', field: 'targetCourse', width: 180 },
    { name: 'Stream', field: 'targetStream', width: 140 },
    { name: 'Budget', field: 'budget', width: 130 },
    {
      name: 'Lead Quality',
      field: 'temperature',
      width: 120,
      validation: { type: 'ONE_OF_LIST', values: ['HOT', 'WARM', 'COLD'] },
    },
    {
      name: 'Quota Preference',
      field: 'quotaPreference',
      width: 150,
      validation: { type: 'ONE_OF_LIST', values: ['Merit Quota', 'Management Quota', 'NRI Quota', 'State Quota', 'Any'] },
    },
    { name: 'Entrance Exam', field: 'entranceExam', width: 130 },
    { name: 'Entrance Rank', field: 'entranceRank', width: 130 },
    { name: 'Campaign', field: 'campaign', width: 140 },
    { name: 'Notes', field: 'notes', width: 220 },
    { name: 'CRM_LEAD_ID', field: 'crm_lead_id', width: 120, system: true },
    { name: 'CRM_STATUS', field: 'crm_status', width: 120, system: true },
  ];
}

/**
 * Matches a raw sheet header against known CRM fields using fuzzy synonym matching
 */
function matchHeaderToCrmField(rawHeader) {
  if (!rawHeader) return { crmField: 'custom', isCustom: true, displayLabel: '' };
  const clean = String(rawHeader).trim().toLowerCase();

  // Special system columns
  if (clean === 'crm_lead_id' || clean === 'crm lead id') {
    return { crmField: 'crm_lead_id', isSystem: true, isCustom: false, displayLabel: 'CRM Lead ID' };
  }
  if (clean === 'crm_status' || clean === 'crm status') {
    return { crmField: 'crm_status', isSystem: true, isCustom: false, displayLabel: 'CRM Status' };
  }

  for (const field of CRM_LEAD_FIELDS) {
    if (field.synonyms.some((syn) => clean === syn || clean.replace(/[_\s-]+/g, ' ') === syn)) {
      return {
        crmField: field.key,
        displayLabel: field.label,
        type: field.type,
        isCustom: false,
      };
    }
  }

  // Fallback: Custom Answer
  return {
    crmField: 'custom',
    displayLabel: String(rawHeader).trim(),
    type: 'string',
    isCustom: true,
  };
}

module.exports = {
  CRM_LEAD_FIELDS,
  getStandardLeadFields,
  getTemplateHeaderDefinitions,
  matchHeaderToCrmField,
};
