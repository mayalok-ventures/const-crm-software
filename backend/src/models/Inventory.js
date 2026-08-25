const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Tenant companyId is required'],
    index: true,
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'Project reference is required'],
    index: true,
  },
  tower: {
    type: String,
    default: 'Tower A',
    trim: true,
  },
  floor: {
    type: Number,
    default: 1,
  },
  unitNumber: {
    type: String,
    required: [true, 'Unit number is mandatory'],
    trim: true,
  },
  configuration: {
    type: String,
    default: '3BHK',
    trim: true, // e.g. '2BHK', '3BHK', '3BHK + Servant', 'Villa', 'Penthouse'
  },
  facing: {
    type: String,
    enum: ['East', 'West', 'North', 'South', 'North-East', 'South-East', 'Park Facing', 'Road Facing', 'Corner', 'Other', null],
    default: 'East',
  },
  carpetArea: {
    type: Number,
    default: 0,
    min: 0, // sq. ft.
  },
  builtUpArea: {
    type: Number,
    default: 0,
    min: 0,
  },
  superArea: {
    type: Number,
    default: 0,
    min: 0,
  },
  basePrice: {
    type: Number,
    default: 0,
    min: 0,
  },
  additionalCharges: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalPrice: {
    type: Number,
    default: 0,
    min: 0,
  },
  status: {
    type: String,
    enum: ['AVAILABLE', 'HOLD', 'BLOCKED', 'BOOKED', 'SOLD'],
    default: 'AVAILABLE',
    index: true,
  },
  holdExpiresAt: {
    type: Date,
    default: null,
  },
  holdByLeadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    default: null,
  },
  bookedByLeadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    default: null,
  },
  notes: {
    type: String,
    default: '',
    trim: true,
  },
}, { timestamps: true });

// Ensure unique unit per project and tower within the same tenant
inventorySchema.index({ companyId: 1, projectId: 1, tower: 1, unitNumber: 1 }, { unique: true });
inventorySchema.index({ companyId: 1, projectId: 1, status: 1 });
inventorySchema.index({ companyId: 1, status: 1, holdExpiresAt: 1 });

module.exports = mongoose.models.Inventory || mongoose.model('Inventory', inventorySchema);
