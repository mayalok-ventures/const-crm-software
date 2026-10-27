const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    default: null,
    index: true,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  senderName: {
    type: String,
    default: '',
  },
  direction: {
    type: String,
    enum: ['inbound', 'outbound'],
    required: true,
  },
  text: {
    type: String,
    default: '',
  },
  mediaUrl: {
    type: String,
    default: null,
  },
  mediaType: {
    type: String,
    enum: ['image', 'video', 'document', 'audio', null],
    default: null,
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read', 'received', 'failed'],
    default: 'sent',
  },
  waMessageId: {
    type: String,
    default: null,
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    default: null,
    index: true,
  },
  channel: {
    type: String,
    enum: ['baileys', 'meta_cloud'],
    default: 'baileys',
    index: true,
  },
  wabaId: {
    type: String,
    default: null,
  },
  metaPhoneNumberId: {
    type: String,
    default: null,
  },
  templateName: {
    type: String,
    default: null,
  },
  errorDetails: {
    type: String,
    default: null,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, { timestamps: true });

chatMessageSchema.index({ userId: 1, phone: 1, timestamp: -1 });
chatMessageSchema.index({ userId: 1, leadId: 1, timestamp: -1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
