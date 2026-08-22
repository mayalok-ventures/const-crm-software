const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    default: '',
    trim: true,
  },
  roleType: {
    type: String,
    enum: ['OWNER', 'MANAGER', 'AGENT', 'CUSTOM'],
    default: 'CUSTOM',
    index: true,
  },
  permissions: [{
    type: String,
    trim: true,
  }],
  isSystemRole: {
    type: Boolean,
    default: false,
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, { timestamps: true });

// Production-grade compound indexes
roleSchema.index({ tenantId: 1, name: 1 }, { unique: true });
roleSchema.index({ tenantId: 1, isActive: 1 });

module.exports = mongoose.models.Role || mongoose.model('Role', roleSchema);
