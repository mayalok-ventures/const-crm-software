const mongoose = require('mongoose');

const formFieldSchema = new mongoose.Schema({
  label: {
    type: String,
    required: [true, 'Field label is required'],
    trim: true,
  },
  name: {
    type: String,
    required: [true, 'Field key name is required'],
    trim: true,
  },
  type: {
    type: String,
    enum: ['text', 'email', 'phone', 'dropdown', 'number', 'textarea', 'hidden'],
    default: 'text',
    required: true,
  },
  isRequired: {
    type: Boolean,
    default: false,
  },
  options: {
    type: [String],
    default: [],
  },
  defaultValue: {
    type: String,
    default: '',
  },
  placeholder: {
    type: String,
    default: '',
  },
}, { _id: true });

const formSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Form title is required'],
    trim: true,
  },
  description: {
    type: String,
    default: '',
    trim: true,
  },
  slug: {
    type: String,
    trim: true,
    lowercase: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  fields: {
    type: [formFieldSchema],
    default: [
      { label: 'Full Name', name: 'name', type: 'text', isRequired: true, placeholder: 'Enter your full name' },
      { label: 'Phone Number', name: 'phone', type: 'phone', isRequired: true, placeholder: 'Enter 10-digit mobile number' },
      { label: 'Email Address', name: 'email', type: 'email', isRequired: false, placeholder: 'Enter email address' },
    ],
  },
  routing: {
    targetPipeline: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pipeline',
      default: null,
    },
    targetStage: {
      type: String,
      default: 'New Lead',
      trim: true,
    },
  },
  submissionsCount: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
  strict: true,
});

formSchema.index({ title: 1, isActive: 1 });
formSchema.index({ slug: 1 });
formSchema.index({ createdBy: 1 });

module.exports = mongoose.models.FormSchema || mongoose.model('FormSchema', formSchema);
