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
    enum: ['Private University', 'Deemed University', 'Autonomous College', 'Government Institute', 'Overseas University', 'Other'],
    default: 'Private University',
  },
  accreditation: [{ type: String, trim: true }], // e.g. ['NAAC A++', 'NBA', 'AICTE', 'UGC', 'QS Top 500']
  establishedYear: { type: Number, default: 2000 },
  website: { type: String, trim: true, default: '' },
  isFeatured: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

masterCollegeSchema.index({ name: 'text', 'location.city': 'text', 'location.state': 'text', 'location.country': 'text' });

module.exports = mongoose.model('MasterCollege', masterCollegeSchema);
