const mongoose = require('mongoose');

const invitationSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true,
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  phone: {
    type: String,
    trim: true,
    default: '',
  },
  role: {
    type: String,
    enum: ['owner', 'manager', 'counsellor', 'auditor', 'custom'],
    default: 'counsellor',
    set: (v) => {
      if (!v) return v;
      const lower = String(v).toLowerCase().trim();
      if (lower === 'counselor' || lower === 'agent' || lower === 'telecaller') return 'counsellor';
      return lower;
    },
  },
  customRoleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    default: null,
  },
  team: {
    type: String,
    trim: true,
    default: '',
  },
  tokenHash: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  token: {
    type: String,
    sparse: true,
    default: undefined,
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'expired', 'revoked'],
    default: 'pending',
    index: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true,
  },
  acceptedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

invitationSchema.index({ workspaceId: 1, email: 1, status: 1 });

module.exports = mongoose.models.Invitation || mongoose.model('Invitation', invitationSchema);
