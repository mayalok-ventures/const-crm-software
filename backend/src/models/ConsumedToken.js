const mongoose = require('mongoose');

const consumedTokenSchema = new mongoose.Schema(
  {
    nonce: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    tokenType: {
      type: String,
      default: 'quick_action',
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      expires: 0, // MongoDB TTL index automatically cleans up expired tokens
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.ConsumedToken ||
  mongoose.model('ConsumedToken', consumedTokenSchema);
