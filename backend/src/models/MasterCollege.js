const mongoose = require('mongoose');

const masterCollegeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, index: true },
  shortCode: { type: String, trim: true, default: '' },
  location: {
    city: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    country: { type: String, trim: true, default: 'India' },
  },
  logoUrl: { type: String, default: '' },
  type: {
    type: String,
    enum: [
      'Private University',
      'Deemed University',
      'Autonomous College',
      'State Govt University',
      'Central University',
      'Government Institute (IIT/IIM/NIT)',
      'Overseas University',
      'Other'
    ],
    default: 'Private University',
  },
  accreditation: [{ type: String, trim: true }], // e.g. ['NAAC A++', 'NBA', 'AICTE Approved', 'UGC Approved', 'NIRF Top 50']
  establishedYear: { type: Number, default: 2000 },
  website: { type: String, trim: true, default: '' },
  brochureUrl: { type: String, trim: true, default: '' },
  affiliatedUniversity: { type: String, trim: true, default: '' },
  isFeatured: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Compound indexes for scaling to 10,000+ universities
masterCollegeSchema.index({ name: 'text', shortCode: 'text', 'location.city': 'text', 'location.state': 'text', 'location.country': 'text', accreditation: 'text' });
masterCollegeSchema.index({ 'location.country': 1, 'location.state': 1, type: 1 });
masterCollegeSchema.index({ isFeatured: -1, createdAt: -1 });

module.exports = mongoose.model('MasterCollege', masterCollegeSchema);
