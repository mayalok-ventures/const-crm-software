const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  size: { type: Number, required: true },
  mimetype: { type: String, required: true },
  url: { type: String, required: true }
}, { _id: false });

const templateSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  agent_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  admin_owned: { type: Boolean, default: true },
  adminOwned: { type: Boolean, default: true },
  
  title: { type: String, required: true, trim: true },
  name: { type: String, trim: true },
  text: { type: String, default: '' },
  
  type: {
    type: String,
    enum: ['welcome', 'initial', 'followup', 'brochure', 'offer', 'follow_up', 'site_visit', 'promotional', 'greeting'],
    default: 'followup',
  },
  
  content: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  
  imageFile: { type: fileSchema, default: null },
  videoFile: { type: fileSchema, default: null },
  docFile: { type: fileSchema, default: null },
  tags: [{ type: String }],
  usageCount: { type: Number, default: 0 },
}, { timestamps: true });

templateSchema.pre('save', function (next) {
  if (this.title && !this.name) this.name = this.title;
  if (this.name && !this.title) this.title = this.name;
  if (this.admin_owned !== undefined && this.adminOwned === undefined) this.adminOwned = this.admin_owned;
  if (this.adminOwned !== undefined && this.admin_owned === undefined) this.admin_owned = this.adminOwned;
  if (this.agent_id && !this.agentId) this.agentId = this.agent_id;
  if (this.agentId && !this.agent_id) this.agent_id = this.agentId;
  next();
});

templateSchema.index({ userId: 1 });
templateSchema.index({ agentId: 1 });
templateSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.models.Template || mongoose.model('Template', templateSchema);
