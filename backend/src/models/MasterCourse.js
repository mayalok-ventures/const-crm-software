const mongoose = require('mongoose');

const masterCourseSchema = new mongoose.Schema({
  collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'MasterCollege', required: true, index: true },
  degreeName: { type: String, required: true, trim: true }, // e.g., 'B.Tech', 'MBA', 'MS', 'MBBS', 'BBA', 'B.Sc'
  level: {
    type: String,
    enum: ['Undergraduate', 'Postgraduate', 'Diploma / Certification', 'Doctorate / PhD'],
    default: 'Undergraduate',
  },
  durationYears: { type: Number, default: 4 },
  eligibilityCriteria: { type: String, default: '' },
  specializations: [{ type: String, trim: true }], // e.g. ['Computer Science & AI', 'Data Analytics', 'Robotics', 'Finance', 'Marketing']
  standardAnnualFee: { type: Number, default: 0 },
  intakeCapacity: { type: Number, default: 60 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

masterCourseSchema.index({ collegeId: 1, degreeName: 1 });

module.exports = mongoose.model('MasterCourse', masterCourseSchema);
