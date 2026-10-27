/**
 * Frontend Industry Templates - Dedicated Exclusively to Admission Consultants
 */

export const ADMISSION_CONSULTANTS_TEMPLATE = {
  label: 'Admission Consultants & Counsellors',
  industryType: 'Education',
  educationSubProfile: 'admission_consultants',
  pipelineStages: [
    'Lead Received',
    'Tele-Counselling / Discovery',
    'Budget & Merit Evaluation',
    'College Options Shortlisted',
    'Direct Campus Visit Arranged',
    'Seat Block / Token Advance',
    'Management / Merit Quota Filing',
    'Offer Letter & Fee Submission',
    'Admission Finalized & Invoiced',
    'Lost to Direct College',
    'Back-up Option',
  ],
  leadFormSchema: [
    { fieldId: 'name', label: 'Candidate Full Name', fieldType: 'text', isRequired: true, isSystem: true, isHidden: false, order: 1 },
    { fieldId: 'phone', label: 'Candidate Phone Number', fieldType: 'phone', isRequired: true, isSystem: true, isHidden: false, order: 2 },
    { fieldId: 'email', label: 'Email Address', fieldType: 'email', isRequired: false, isSystem: true, isHidden: false, order: 3 },
    {
      fieldId: 'targetDomain',
      label: 'Target Stream / Domain',
      fieldType: 'dropdown',
      options: [
        'Engineering (B.Tech/BE)',
        'Management (MBA/PGDM/BBA)',
        'Medical (MBBS/BDS/BAMS)',
        'Pharmacy (B.Pharm)',
        'Law (BA LLB/BBA LLB)',
        'Architecture / Design',
        'Nursing & Allied Health',
        'Arts & Sciences (B.Sc/BCA)'
      ],
      isRequired: true,
      isSystem: false,
      isHidden: false,
      order: 4,
    },
    { fieldId: 'targetState', label: 'Target State / City Preference', fieldType: 'text', isRequired: false, isSystem: false, isHidden: false, order: 5 },
    {
      fieldId: 'packageBudget',
      label: 'Total Package Budget',
      fieldType: 'dropdown',
      options: ['Under ₹5 Lakhs', '₹5 - ₹10 Lakhs', '₹10 - ₹20 Lakhs', '₹20 - ₹35 Lakhs', '₹35 Lakhs+'],
      isRequired: false,
      isSystem: false,
      isHidden: false,
      order: 6,
    },
    { fieldId: 'academicScore', label: '10th / 12th / Grad %', fieldType: 'text', isRequired: false, isSystem: false, isHidden: false, order: 7 },
    { fieldId: 'entranceRank', label: 'Entrance Exam Score / Rank', fieldType: 'text', isRequired: false, isSystem: false, isHidden: false, order: 8 },
    {
      fieldId: 'quotaPreference',
      label: 'Admission Quota Preference',
      fieldType: 'dropdown',
      options: ['Merit Quota Only', 'Management / Institutional Quota', 'Open to Both based on Fee'],
      isRequired: false,
      isSystem: false,
      isHidden: false,
      order: 9,
    },
    { fieldId: 'followUpDate', label: 'Next Follow-up Date', fieldType: 'date', isRequired: true, isSystem: true, isHidden: false, order: 10 },
  ],
};

export const INDUSTRY_TEMPLATES = {
  EDUCATION: ADMISSION_CONSULTANTS_TEMPLATE,
  ADMISSION_CONSULTANTS: ADMISSION_CONSULTANTS_TEMPLATE,
};

export const getIndustryDefaults = () => ADMISSION_CONSULTANTS_TEMPLATE;
