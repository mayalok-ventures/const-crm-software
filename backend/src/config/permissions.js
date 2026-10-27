/**
 * System Permissions Catalogue & Default Role Definitions
 * Aligned with ADMISSION_CRM_REDESIGNED_SPEC.md
 */

const PERMISSIONS = {
  // Leads Management
  'leads.view': { key: 'leads.view', category: 'Leads', label: 'View Leads', description: 'View student candidate records within allowed scope' },
  'leads.create': { key: 'leads.create', category: 'Leads', label: 'Create Leads', description: 'Add new student enquiries' },
  'leads.edit': { key: 'leads.edit', category: 'Leads', label: 'Edit Leads', description: 'Modify candidate contact and academic details' },
  'leads.delete': { key: 'leads.delete', category: 'Leads', label: 'Delete Leads', description: 'Soft delete student leads' },
  'leads.assign': { key: 'leads.assign', category: 'Leads', label: 'Assign Leads', description: 'Assign or reassign leads to team members' },
  'leads.transfer': { key: 'leads.transfer', category: 'Leads', label: 'Transfer / Reassign Leads', description: 'Bulk transfer or reassign student leads to campaigns, counsellors, or managers' },
  'leads.export': { key: 'leads.export', category: 'Leads', label: 'Export Leads', description: 'Download CSV / Excel datasets of student contacts' },
  'leads.view_sensitive': { key: 'leads.view_sensitive', category: 'Leads', label: 'View Sensitive Fields', description: 'Access financial notes and confidential marks' },
  'leads.view_documents': { key: 'leads.view_documents', category: 'Leads', label: 'View Student Documents', description: 'Access student marksheets and identity proofs' },

  // Follow-ups & Activities
  'activities.view': { key: 'activities.view', category: 'Follow-ups', label: 'View Activities', description: 'Read interaction history and call logs' },
  'activities.create': { key: 'activities.create', category: 'Follow-ups', label: 'Log Call / Note', description: 'Add notes and record tele-counselling outcomes' },
  'followups.create': { key: 'followups.create', category: 'Follow-ups', label: 'Schedule Follow-Ups', description: 'Create reminder appointments' },
  'followups.reschedule': { key: 'followups.reschedule', category: 'Follow-ups', label: 'Reschedule / Snooze Follow-Ups', description: 'Modify follow-up date and time' },
  'followups.complete': { key: 'followups.complete', category: 'Follow-ups', label: 'Complete Follow-Ups', description: 'Resolve follow-ups with mandatory outcome note' },
  'followups.delete': { key: 'followups.delete', category: 'Follow-ups', label: 'Delete Follow-Ups', description: 'Cancel scheduled reminders' },

  // Pipelines
  'pipelines.view': { key: 'pipelines.view', category: 'Pipelines', label: 'View Pipelines', description: 'Access Kanban boards and stage views' },
  'pipelines.manage': { key: 'pipelines.manage', category: 'Pipelines', label: 'Manage Pipelines & Stages', description: 'Create, reorder, and configure stages' },

  // Catalogue
  'catalogue.view_master': { key: 'catalogue.view_master', category: 'Catalogue', label: 'Explore Master Colleges', description: 'Search national 10,000+ institution repository' },
  'catalogue.manage_workspace': { key: 'catalogue.manage_workspace', category: 'Catalogue', label: 'Manage Active Catalogue', description: 'Import or add custom institutions' },
  'catalogue.edit_fees': { key: 'catalogue.edit_fees', category: 'Catalogue', label: 'Edit Course Fees & Quotas', description: 'Configure tuition fees and management seat donations' },
  'catalogue.view_commission': { key: 'catalogue.view_commission', category: 'Catalogue', label: 'View Commission Rates', description: 'View internal university tie-up commission margins' },

  // Communication & WhatsApp
  'whatsapp.view': { key: 'whatsapp.view', category: 'Communication', label: 'View WhatsApp Chats', description: 'Read incoming and outgoing student messages' },
  'whatsapp.send_one_to_one': { key: 'whatsapp.send_one_to_one', category: 'Communication', label: 'Send Direct Messages', description: 'Chat with students via WhatsApp' },
  'whatsapp.manage_templates': { key: 'whatsapp.manage_templates', category: 'Communication', label: 'Manage Canned Templates', description: 'Create and edit quick response templates' },
  'whatsapp.manage_account': { key: 'whatsapp.manage_account', category: 'Communication', label: 'Manage WhatsApp Accounts', description: 'Connect, disconnect, and assign WhatsApp numbers' },
  'whatsapp.manage_integrations': { key: 'whatsapp.manage_integrations', category: 'Communication', label: 'Manage WhatsApp Integrations', description: 'Connect, authorize and manage official WhatsApp Business Platform (Meta WABA)' },
  'campaigns.view': { key: 'campaigns.view', category: 'Communication', label: 'View Broadcast Campaigns', description: 'View outbound and inbound campaigns' },
  'campaigns.launch': { key: 'campaigns.launch', category: 'Communication', label: 'Launch Broadcast Campaigns', description: 'Broadcast messages to student groups' },
  'campaigns.manage': { key: 'campaigns.manage', category: 'Communication', label: 'Manage Campaigns & Routing', description: 'Create, edit, and configure inbound advertising campaigns and lead assignment rules' },
  'campaigns.cancel': { key: 'campaigns.cancel', category: 'Communication', label: 'Cancel / Pause Campaigns', description: 'Halt ongoing broadcasts or pause campaigns' },

  // Integrations & Pipelines
  'integrations.view': { key: 'integrations.view', category: 'Integrations', label: 'View Integrations', description: 'Inspect connected webhooks, Google Sheets and forms' },
  'integrations.manage': { key: 'integrations.manage', category: 'Integrations', label: 'Manage Integrations', description: 'Connect, re-drive, and manage third-party integration pipelines' },

  // Email Communication
  'email.view': { key: 'email.view', category: 'Email', label: 'View Email Inbox', description: 'Read student candidate email communications' },
  'email.send': { key: 'email.send', category: 'Email', label: 'Send Emails', description: 'Compose, reply, and send candidate emails' },
  'email.manage_accounts': { key: 'email.manage_accounts', category: 'Email', label: 'Manage Email Accounts', description: 'Connect, authorize, and configure mailboxes' },
  'email.manage_templates': { key: 'email.manage_templates', category: 'Email', label: 'Manage Email Templates', description: 'Create and edit rich email templates' },
  'email.campaigns': { key: 'email.campaigns', category: 'Email', label: 'Email Campaigns', description: 'Execute scheduled or broadcast email campaigns' },

  // Deals & Finance
  'deals.view': { key: 'deals.view', category: 'Finance', label: 'View Admission Deals', description: 'Track confirmed admissions and student fees' },
  'deals.create': { key: 'deals.create', category: 'Finance', label: 'Record Admissions', description: 'Mark student admissions as confirmed' },
  'deals.edit': { key: 'deals.edit', category: 'Finance', label: 'Edit Admission Deals', description: 'Update admission fee and seat quota' },
  'deals.delete': { key: 'deals.delete', category: 'Finance', label: 'Delete Admission Deals', description: 'Delete or cancel unbilled admission deals' },
  'commission.view': { key: 'commission.view', category: 'Finance', label: 'View University Commission', description: 'Inspect university commission ledger and payouts' },
  'commission.edit': { key: 'commission.edit', category: 'Finance', label: 'Manage Commission Invoices', description: 'Submit and settle university commission claims' },
  'finance.export': { key: 'finance.export', category: 'Finance', label: 'Export Financial Reports', description: 'Download commission and revenue spreadsheets' },

  // Forms
  'forms.view': { key: 'forms.view', category: 'Forms', label: 'View Intake Forms', description: 'Inspect intake forms and submissions' },
  'forms.manage': { key: 'forms.manage', category: 'Forms', label: 'Build & Publish Forms', description: 'Customize dynamic student registration forms' },

  // Reports
  'reports.view': { key: 'reports.view', category: 'Reports', label: 'View Analytics', description: 'Access conversion funnels and performance charts' },
  'reports.export': { key: 'reports.export', category: 'Reports', label: 'Export Reports', description: 'Download analytics datasets' },

  // Workspace & Team Management
  'members.view': { key: 'members.view', category: 'Team', label: 'View Team Members', description: 'See list of workspace users and statuses' },
  'members.invite': { key: 'members.invite', category: 'Team', label: 'Invite Team Members', description: 'Send invitation links to counsellors and managers' },
  'members.edit_role': { key: 'members.edit_role', category: 'Team', label: 'Change Member Roles', description: 'Assign roles and permissions to team members' },
  'members.deactivate': { key: 'members.deactivate', category: 'Team', label: 'Deactivate Members', description: 'Disable member workspace access' },
  'roles.manage': { key: 'roles.manage', category: 'Team', label: 'Manage Custom Roles', description: 'Create and edit custom role permissions' },
  'workspace.settings.edit': { key: 'workspace.settings.edit', category: 'Settings', label: 'Edit Workspace Settings', description: 'Update agency name, preferences, and logo' },
  'billing.manage': { key: 'billing.manage', category: 'Settings', label: 'Manage Billing & Plans', description: 'Upgrade subscription, view invoices, apply coupons' },
  // Automations & Workflows
  'automations.view': { key: 'automations.view', category: 'Automations', label: 'View Automations', description: 'View automated workflows, triggers, and execution audit logs' },
  'automations.manage': { key: 'automations.manage', category: 'Automations', label: 'Manage Automations', description: 'Create, update, toggle, test and delete automation rules' },
};

// Default Role Permission Sets
const DEFAULT_ROLE_PERMISSIONS = {
  owner: Object.keys(PERMISSIONS).map(key => ({ key, scope: 'workspace' })),

  manager: [
    { key: 'leads.view', scope: 'workspace' },
    { key: 'leads.create', scope: 'workspace' },
    { key: 'leads.edit', scope: 'workspace' },
    { key: 'leads.assign', scope: 'workspace' },
    { key: 'leads.transfer', scope: 'workspace' },
    { key: 'leads.export', scope: 'workspace' },
    { key: 'leads.view_sensitive', scope: 'workspace' },
    { key: 'leads.view_documents', scope: 'workspace' },
    { key: 'activities.view', scope: 'workspace' },
    { key: 'activities.create', scope: 'workspace' },
    { key: 'followups.create', scope: 'workspace' },
    { key: 'followups.reschedule', scope: 'workspace' },
    { key: 'followups.complete', scope: 'workspace' },
    { key: 'pipelines.view', scope: 'workspace' },
    { key: 'pipelines.manage', scope: 'workspace' },
    { key: 'catalogue.view_master', scope: 'workspace' },
    { key: 'catalogue.manage_workspace', scope: 'workspace' },
    { key: 'catalogue.edit_fees', scope: 'workspace' },
    { key: 'catalogue.view_commission', scope: 'workspace' },
    { key: 'whatsapp.view', scope: 'workspace' },
    { key: 'whatsapp.send_one_to_one', scope: 'workspace' },
    { key: 'whatsapp.manage_templates', scope: 'workspace' },
    { key: 'campaigns.view', scope: 'workspace' },
    { key: 'campaigns.launch', scope: 'workspace' },
    { key: 'campaigns.manage', scope: 'workspace' },
    { key: 'email.view', scope: 'workspace' },
    { key: 'email.send', scope: 'workspace' },
    { key: 'email.manage_accounts', scope: 'workspace' },
    { key: 'email.manage_templates', scope: 'workspace' },
    { key: 'email.campaigns', scope: 'workspace' },
    { key: 'deals.view', scope: 'workspace' },
    { key: 'deals.create', scope: 'workspace' },
    { key: 'deals.edit', scope: 'workspace' },
    { key: 'deals.delete', scope: 'workspace' },
    { key: 'commission.view', scope: 'workspace' },
    { key: 'forms.view', scope: 'workspace' },
    { key: 'forms.manage', scope: 'workspace' },
    { key: 'reports.view', scope: 'workspace' },
    { key: 'reports.export', scope: 'workspace' },
    { key: 'members.view', scope: 'workspace' },
    { key: 'members.invite', scope: 'workspace' },
    { key: 'audit.view', scope: 'workspace' },
    { key: 'automations.view', scope: 'workspace' },
    { key: 'automations.manage', scope: 'workspace' },
  ],

  counsellor: [
    { key: 'leads.view', scope: 'own' },
    { key: 'leads.create', scope: 'workspace' },
    { key: 'leads.edit', scope: 'own' },
    { key: 'leads.view_documents', scope: 'own' },
    { key: 'activities.view', scope: 'own' },
    { key: 'activities.create', scope: 'workspace' },
    { key: 'followups.create', scope: 'own' },
    { key: 'followups.reschedule', scope: 'own' },
    { key: 'followups.complete', scope: 'own' },
    { key: 'pipelines.view', scope: 'workspace' },
    { key: 'catalogue.view_master', scope: 'workspace' },
    { key: 'catalogue.manage_workspace', scope: 'workspace' },
    { key: 'whatsapp.view', scope: 'own' },
    { key: 'whatsapp.send_one_to_one', scope: 'own' },
    { key: 'email.view', scope: 'own' },
    { key: 'email.send', scope: 'own' },
    { key: 'deals.view', scope: 'own' },
    { key: 'deals.create', scope: 'own' },
    { key: 'forms.view', scope: 'workspace' },
    { key: 'automations.view', scope: 'workspace' },
    { key: 'campaigns.view', scope: 'workspace' },
  ],

  auditor: [
    { key: 'leads.view', scope: 'workspace' },
    { key: 'activities.view', scope: 'workspace' },
    { key: 'pipelines.view', scope: 'workspace' },
    { key: 'deals.view', scope: 'workspace' },
    { key: 'commission.view', scope: 'workspace' },
    { key: 'campaigns.view', scope: 'workspace' },
    { key: 'reports.view', scope: 'workspace' },
    { key: 'members.view', scope: 'workspace' },
    { key: 'audit.view', scope: 'workspace' },
    { key: 'automations.view', scope: 'workspace' },
  ],
};

DEFAULT_ROLE_PERMISSIONS.counselor = DEFAULT_ROLE_PERMISSIONS.counsellor;

module.exports = {
  PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
};
