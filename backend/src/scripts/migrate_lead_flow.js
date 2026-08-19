const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../../.env') });

const connectDB = require('../config/db');
const Lead = require('../models/Lead');
const FollowUp = require('../models/FollowUp');
const Payment = require('../models/Payment');

const isDown = process.argv.includes('--down');

const runMigration = async () => {
  console.log(`Connecting to MongoDB for lead flow migration (${isDown ? 'DOWN' : 'FORWARD'})...`);

  try {
    await connectDB();
    console.log('Connected to MongoDB via connectDB.');

    if (isDown) {
      console.log('Rolling back lead flow migration...');
      await Lead.updateMany({}, {
        $unset: {
          service_required: '',
          monthly_spend: '',
          goal_timeline: '',
          selected_plan_id: '',
          selectedPlanId: '',
          payable_amount: '',
          payableAmount: '',
          paid_amount: '',
          paidAmount: '',
          version: '',
          deletedAt: '',
        }
      });
      await FollowUp.updateMany({}, {
        $unset: {
          completion_note: '',
          completionNote: '',
          completed_at: '',
          completedAt: '',
        }
      });
      await Payment.updateMany({}, {
        $unset: {
          status: '',
          refunded_at: '',
          refundedAt: '',
          refund_reason: '',
          refundReason: '',
        }
      });
      console.log('✅ Rollback (Down Migration) completed successfully.');
      return;
    }

    // 1. Create Pre-Migration Backup Snapshot
    const backupDir = path.join(__dirname, '../../../scratch');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, `lead_flow_backup_${Date.now()}.json`);
    
    const existingLeads = await Lead.find({}).lean();
    fs.writeFileSync(backupPath, JSON.stringify(existingLeads, null, 2));
    console.log(`✓ Backup saved to: ${backupPath} (${existingLeads.length} leads)`);

    // 2. Forward Migration - Normalize Leads
    const VALID_SERVICES = ['digital_marketing', 'web_development', 'seo_optimization', 'crm_automation', 'branding_design', 'cloud_infrastructure'];
    const VALID_TIMELINES = ['immediate', 'within_1_month', '1_to_3_months', '3_to_6_months', 'flexible'];

    let migratedLeads = 0;
    for (const lead of existingLeads) {
      const cleanPhone = String(lead.phone || '').replace(/\D/g, '');
      const service = VALID_SERVICES.includes(lead.service_required) ? lead.service_required : 'digital_marketing';
      const timeline = VALID_TIMELINES.includes(lead.goal_timeline) ? lead.goal_timeline : 'immediate';
      const monthlySpend = typeof lead.monthly_spend === 'number' ? lead.monthly_spend : 0;
      const payableAmount = typeof lead.payable_amount === 'number' ? lead.payable_amount : 0;
      const paidAmount = typeof lead.paid_amount === 'number' ? lead.paid_amount : 0;

      await Lead.updateOne(
        { _id: lead._id },
        {
          $set: {
            phone: cleanPhone || lead.phone,
            service_required: service,
            monthly_spend: monthlySpend,
            goal_timeline: timeline,
            payable_amount: payableAmount,
            payableAmount: payableAmount,
            paid_amount: paidAmount,
            paidAmount: paidAmount,
            version: lead.version || 1,
            deletedAt: lead.deletedAt || null,
          }
        }
      );
      migratedLeads++;
    }

    // 3. Ensure Index sync
    await Lead.syncIndexes();
    await FollowUp.syncIndexes();
    await Payment.syncIndexes();

    console.log(`✅ Forward Migration completed! Normalized ${migratedLeads} leads.`);
  } catch (err) {
    console.error('Migration error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

runMigration();
