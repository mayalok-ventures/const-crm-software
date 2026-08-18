const mongoose = require('mongoose');

const incentiveSchema = new mongoose.Schema({
  agent_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  period_start: {
    type: Date,
    default: null,
  },
  periodStart: {
    type: Date,
    default: null,
  },
  period_end: {
    type: Date,
    default: null,
  },
  periodEnd: {
    type: Date,
    default: null,
  },
  total_sales: {
    type: Number,
    default: 0,
  },
  totalSales: {
    type: Number,
    default: 0,
  },
  incentive_pct: {
    type: Number,
    default: 0,
  },
  incentivePct: {
    type: Number,
    default: 0,
  },
  incentive_amount: {
    type: Number,
    default: 0,
  },
  incentiveAmount: {
    type: Number,
    default: 0,
  },
  deals_count: {
    type: Number,
    default: 0,
  },
  dealsCount: {
    type: Number,
    default: 0,
  },
  lead_ids: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
  }],
}, { timestamps: true });

incentiveSchema.pre('save', function (next) {
  if (this.agent_id && !this.agentId) this.agentId = this.agent_id;
  if (this.agentId && !this.agent_id) this.agent_id = this.agentId;
  if (this.total_sales !== undefined && this.totalSales === undefined) this.totalSales = this.total_sales;
  if (this.totalSales !== undefined && this.total_sales === undefined) this.total_sales = this.totalSales;
  if (this.incentive_pct !== undefined && this.incentivePct === undefined) this.incentivePct = this.incentive_pct;
  if (this.incentivePct !== undefined && this.incentive_pct === undefined) this.incentive_pct = this.incentivePct;
  if (this.incentive_amount !== undefined && this.incentiveAmount === undefined) this.incentiveAmount = this.incentive_amount;
  if (this.incentiveAmount !== undefined && this.incentive_amount === undefined) this.incentive_amount = this.incentiveAmount;
  if (this.deals_count !== undefined && this.dealsCount === undefined) this.dealsCount = this.deals_count;
  if (this.dealsCount !== undefined && this.deals_count === undefined) this.deals_count = this.dealsCount;
  next();
});

incentiveSchema.index({ agent_id: 1, createdAt: -1 });

module.exports = mongoose.models.Incentive || mongoose.model('Incentive', incentiveSchema);
