const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: [true, 'Role name is required'],
    trim: true,
  },
  description: {
    type: String,
    default: '',
    trim: true,
  },
  isSystem: {
    type: Boolean,
    default: false,
  },
  permissions: [{
    key: {
      type: String,
      required: true,
      trim: true,
    },
    scope: {
      type: String,
      enum: ['own', 'team', 'workspace', 'restricted'],
      default: 'own',
    },
  }],
}, {
  timestamps: true,
});

roleSchema.index({ workspaceId: 1, name: 1 }, { unique: true });

module.exports = mongoose.models.Role || mongoose.model('Role', roleSchema);
