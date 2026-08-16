const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  leadName: { type: String },
  title: { type: String, default: '' },
  message: { type: String, required: true },
  type: {
    type: String,
    enum: [
      'follow_up', 'reminder', 'system', 'admin_alert', 'system_alert',
      'wa_reply', 'platform_signup', 'leave_request', 'leave_approved',
      'leave_rejected', 'agent_left', 'agent_joined', 'agent_removed'
    ],
    default: 'follow_up',
  },
  isRead: { type: Boolean, default: false },
}, { timestamps: true });

notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
