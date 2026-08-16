const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  text: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  authorName: { type: String, default: 'Agent' },
  createdAt: { type: Date, default: Date.now },
});

const editHistorySchema = new mongoose.Schema({
  updatedAt: { type: Date, default: Date.now },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  changes: { type: mongoose.Schema.Types.Map, of: mongoose.Schema.Types.Mixed }
}, { _id: false });

const leadActivitySchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    enum: [
      'lead_created',
      'status_changed',
      'assigned_agent',
      'site_visit_scheduled',
      'site_visit_completed',
      'note_added',
      'message_sent',
      'message_received',
      'recording_added',
      'project_linked',
      'lead_updated',
    ],
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  performerName: {
    type: String,
    default: 'System',
  },
  details: {
    type: String,
    default: '',
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
}, { _id: true });

const leadSchema = new mongoose.Schema({
  // Creator / Lead Owner
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Organization / Company Association
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // Assigned Agent (Under assigned lead sharing mode)
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedToName: { type: String, default: '' },

  // Linked Project / Package Offering Pre-set
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
  project: { type: String, default: '' },

  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  email: { type: String, lowercase: true, trim: true },
  company: { type: String, trim: true },
  tags: [{ type: String, trim: true }],

  // Sales Pipeline Stage (Supports standard + dynamic custom stages)
  status: {
    type: String,
    default: 'new',
    trim: true,
  },

  // Deal Dimensions & Revenue Tracking
  propertyType: { type: String, default: '' },
  budget: { type: String, default: '' },
  closedDealAmount: { type: Number, default: null },
  location: { type: String, default: '' },
  profession: { type: String, default: '' },
  areasOfInterest: [{ type: String, trim: true }],
  siteVisitDate: { type: Date, default: null },

  // Dynamic Custom Form Fields (Key-Value Data from User's customLeadFields)
  customData: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },

  notes: [noteSchema],
  followUpDate: { type: Date, required: true },
  followUpNotified: { type: Boolean, default: false },
  lastContactedAt: { type: Date, default: null },
  
  // Activity Audit Trail
  leadActivities: [leadActivitySchema],

  // Change Log
  editHistory: [editHistorySchema],

  // Template usage tracking
  templateUsageCount: { type: Number, default: 0 },
  messageSentCount: { type: Number, default: 0 },

  source: {
    type: String,
    default: 'manual',
  },
  utmCampaign: {
    type: String,
    default: '',
    trim: true,
  },
  utmMedium: {
    type: String,
    default: '',
    trim: true,
  },
  utmSource: {
    type: String,
    default: '',
    trim: true,
  },

  // Lost Deal Categorization & Context
  lostReason: {
    type: String,
    default: '',
    trim: true,
  },
  lostReasonDetail: {
    type: String,
    default: '',
    trim: true,
  },
}, { timestamps: true });

// Indexes for fast queries
leadSchema.index({ userId: 1 });
leadSchema.index({ companyId: 1 });
leadSchema.index({ assignedTo: 1 });
leadSchema.index({ userId: 1, status: 1 });
leadSchema.index({ companyId: 1, status: 1 });
leadSchema.index({ userId: 1, followUpDate: 1 });
// Multi-tenant phone uniqueness: unique within the company when linked, or unique per solo user when unlinked
leadSchema.index(
  { companyId: 1, phone: 1 },
  { unique: true, partialFilterExpression: { companyId: { $exists: true, $type: 'objectId' } } }
);
leadSchema.index(
  { userId: 1, phone: 1 },
  { unique: true, partialFilterExpression: { companyId: { $eq: null } } }
);
leadSchema.index({ userId: 1, createdAt: -1 });
leadSchema.index({ name: 'text', phone: 'text', company: 'text', email: 'text', project: 'text' });

module.exports = mongoose.model('Lead', leadSchema);
