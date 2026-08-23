const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const Lead = require('../models/Lead');
const Plan = require('../models/Plan');
const Pipeline = require('../models/Pipeline');
const CommissionRule = require('../models/CommissionRule');
const User = require('../models/User');

async function standardizeDatabase() {
  console.log('🔄 Starting Database Standardization & Migration...\n');

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // 1. STANDARDIZE PIPELINE DOCUMENT
    console.log('\n--- 1. Standardizing Canonical 5-Stage Pipeline in DB ---');
    const canonicalStages = [
      { name: 'New Lead', order: 0, probability: 10, colorCode: '#64748b', slaHours: 24 },
      { name: 'Contacted', order: 1, probability: 30, colorCode: '#3b82f6', slaHours: 48 },
      { name: 'Not Interested', order: 2, probability: 0, colorCode: '#ef4444', slaHours: 24 },
      { name: 'Converted', order: 3, probability: 80, colorCode: '#10b981', slaHours: 72 },
      { name: 'Payment Done', order: 4, probability: 100, colorCode: '#8b5cf6', slaHours: 0 },
    ];

    let defaultPipeline = await Pipeline.findOne({ isDefault: true });
    if (defaultPipeline) {
      defaultPipeline.stages = canonicalStages;
      await defaultPipeline.save();
      console.log('✅ Updated existing default Pipeline with Canonical 5 Stages');
    } else {
      defaultPipeline = await Pipeline.create({
        name: 'Standard CRM Deal Pipeline',
        isDefault: true,
        stages: canonicalStages,
      });
      console.log('✅ Created default Pipeline with Canonical 5 Stages');
    }

    // 2. SEED DEFAULT COMMISSION RULES
    console.log('\n--- 2. Standardizing Database Commission Rules ---');
    const existingRules = await CommissionRule.find({});
    if (existingRules.length === 0) {
      const adminUser = await User.findOne({ role: 'superadmin' }) || await User.findOne({});
      const agentRule = await CommissionRule.create({
        ruleName: 'Standard Sales Rep Commission',
        targetRole: 'AGENT',
        commissionType: 'PERCENTAGE',
        value: 10,
        stageThreshold: 'payment_done',
        isActive: true,
        createdBy: adminUser?._id,
      });
      const mgrRule = await CommissionRule.create({
        ruleName: 'Standard Manager Override',
        targetRole: 'MANAGER',
        commissionType: 'PERCENTAGE',
        value: 5,
        stageThreshold: 'payment_done',
        isActive: true,
        createdBy: adminUser?._id,
      });
      console.log('✅ Seeded Agent (10%) and Manager (5%) Commission Rules in DB');
    } else {
      console.log(`ℹ️ Commission Rules already present (${existingRules.length} rules)`);
    }

    // 3. BACKFILL PLANS INDUSTRY & SUB-INDUSTRY
    console.log('\n--- 3. Backfilling Plans Industry Hierarchy ---');
    const planUpdateResult = await Plan.updateMany(
      { $or: [{ industry: null }, { industry: { $exists: false } }, { industry: '' }] },
      { $set: { industry: 'General', subIndustry: 'General' } }
    );
    console.log(`✅ Updated ${planUpdateResult.modifiedCount} plans with default Industry: 'General'`);

    // 4. VERIFY FINAL COUNTS
    const [finalPipelines, finalRules, finalPlans] = await Promise.all([
      Pipeline.find({}).lean(),
      CommissionRule.find({}).lean(),
      Plan.find({}).lean(),
    ]);

    console.log('\n✨ STANDARDIZATION COMPLETE:');
    console.log('Pipelines:', finalPipelines.map(p => ({ name: p.name, stages: p.stages.map(s => s.name) })));
    console.log('Commission Rules:', finalRules.map(r => ({ name: r.ruleName, role: r.targetRole, value: `${r.value}%` })));
    console.log('Total Active Plans:', finalPlans.length);

  } catch (err) {
    console.error('❌ Standardization Error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

standardizeDatabase();
