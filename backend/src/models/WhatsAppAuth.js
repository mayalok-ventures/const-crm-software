const mongoose = require('mongoose');

const whatsAppAuthSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    index: true,
  },
  key: {
    type: String,
    required: true,
  },
  data: {
    type: String,
    required: true,
  },
}, { timestamps: true });

whatsAppAuthSchema.index({ sessionId: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('WhatsAppAuth', whatsAppAuthSchema);
