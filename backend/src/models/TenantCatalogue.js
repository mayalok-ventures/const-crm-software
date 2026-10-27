const mongoose = require('mongoose');

const tenantCatalogueCourseSchema = new mongoose.Schema({
  degreeName: { type: String, required: true, trim: true },
  specialization: { type: String, trim: true, default: 'General' },
  level: {
    type: String,
    enum: ['Undergraduate', 'Postgraduate', 'Diploma / Certification', 'Doctorate / PhD'],
    default: 'Undergraduate',
  },
  durationYears: { type: Number, default: 4 },
  customFeeStructure: {
    annualTuitionFee: { type: Number, default: 0 },
    packageFee: { type: Number, default: 0 },
    hostelFeePerYear: { type: Number, default: 0 },
    oneTimeAdmissionFee: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
    feeNotes: { type: String, default: '' },
  },
  customTieUpDetails: {
    commissionType: { type: String, enum: ['percentage', 'flat_payout', 'tiered'], default: 'percentage' },
    commissionRate: { type: Number, default: 10 }, // e.g. 10% or flat payout in currency
    mouStatus: { type: String, enum: ['direct_tie_up', 'sub_agent_mou', 'informal_tie_up', 'none'], default: 'direct_tie_up' },
    contactPersonName: { type: String, default: '' },
    contactPersonPhone: { type: String, default: '' },
    contactPersonEmail: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  admissionStatus: {
    type: String,
    enum: ['admissions_open', 'seats_fast_filling', 'merit_closed_mgmt_open', 'admissions_closed'],
    default: 'admissions_open',
  },
  quotaType: {
    type: String,
    enum: ['merit_counselling', 'management_quota', 'nri_quota', 'institutional_direct', 'scholarship_seat'],
    default: 'management_quota',
  },
  isActive: { type: Boolean, default: true },
});

const tenantCatalogueSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', index: true },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  masterCollegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'MasterCollege', default: null, index: true },
  isCustomInstitution: { type: Boolean, default: false },
  customCollegeName: { type: String, required: true, trim: true },
  collegeType: { type: String, default: 'Private University' },
  location: {
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    country: { type: String, default: 'India' },
  },
  accreditation: [{ type: String, trim: true }],
  establishedYear: { type: Number, default: null },
  affiliatedUniversity: { type: String, trim: true, default: '' },
  logoUrl: { type: String, default: '' },
  website: { type: String, default: '' },
  brochureUrl: { type: String, default: '' },
  courses: [tenantCatalogueCourseSchema],
  tags: [{ type: String, trim: true }],
  priorityRank: { type: Number, default: 0 },
  notes: { type: String, default: '' },
}, { timestamps: true });

tenantCatalogueSchema.index({ workspaceId: 1, isCustomInstitution: 1 });
tenantCatalogueSchema.index({ tenantId: 1, masterCollegeId: 1 });
tenantCatalogueSchema.index({ tenantId: 1, customCollegeName: 1 });
tenantCatalogueSchema.index({ companyId: 1, updatedAt: -1 });

module.exports = mongoose.model('TenantCatalogue', tenantCatalogueSchema);
