/**
 * Safe Historical Orphaned Leads Dry-Run Audit Tool
 * 
 * PRINCIPLE: READ-ONLY AUDIT & DRY-RUN ANALYSIS.
 * DOES NOT MUTATE, REASSIGN, OR DELETE ANY CUSTOMER RECORDS.
 * 
 * Scans existing historical leads to identify:
 * 1. Leads created by counselors where companyId equals counselor's own userId instead of employer
 * 2. Leads missing workspaceId where verified WorkspaceMembership exists
 * 3. Ambiguous cases requiring manual administrator review
 */

const mongoose = require('mongoose');
const path = require('path');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mobile-crm';

async function runDryRunAudit() {
  console.log('============================================================');
  console.log('🔍 HISTORICAL ORPHANED LEADS DRY-RUN AUDIT (READ-ONLY)');
  console.log('============================================================\n');

  await mongoose.connect(MONGODB_URI);

  const User = require('../src/models/User');
  const Lead = require('../src/models/Lead');
  const Workspace = require('../src/models/Workspace');
  const WorkspaceMembership = require('../src/models/WorkspaceMembership');

  const totalLeads = await Lead.countDocuments({});
  console.log(`📊 Total Leads in Database: ${totalLeads}`);

  // Find leads created by users who have a parent company or are counselors
  const allLeads = await Lead.find({}).select('_id name phone userId companyId workspaceId createdAt').lean();

  let cleanCount = 0;
  let proposedRepairCount = 0;
  let ambiguousCount = 0;
  const proposedRepairs = [];
  const ambiguousRecords = [];

  for (const lead of allLeads) {
    if (!lead.userId) {
      ambiguousRecords.push({ leadId: lead._id, reason: 'Missing userId on lead' });
      ambiguousCount++;
      continue;
    }

    const creator = await User.findById(lead.userId).select('name companyId companyRole workStatus').lean();
    if (!creator) {
      ambiguousRecords.push({ leadId: lead._id, reason: 'Creator user record not found' });
      ambiguousCount++;
      continue;
    }

    const isCounselor = creator.companyRole === 'counsellor' || creator.companyRole === 'counselor' || creator.workStatus === 'counselor';
    const isOrphanedCompany = isCounselor && creator.companyId && (!lead.companyId || String(lead.companyId) === String(lead.userId));
    const isMissingWorkspace = !lead.workspaceId;

    if (!isOrphanedCompany && !isMissingWorkspace) {
      cleanCount++;
      continue;
    }

    // Determine proposed mapping via verified membership
    const memberships = await WorkspaceMembership.find({ userId: lead.userId, status: 'active' }).lean();

    if (memberships.length === 1) {
      const targetWorkspace = await Workspace.findById(memberships[0].workspaceId).lean();
      if (targetWorkspace) {
        proposedRepairs.push({
          leadId: lead._id,
          leadName: lead.name,
          creatorName: creator.name,
          currentCompanyId: lead.companyId,
          proposedCompanyId: creator.companyId || targetWorkspace.ownerId,
          currentWorkspaceId: lead.workspaceId,
          proposedWorkspaceId: targetWorkspace._id,
          workspaceName: targetWorkspace.name
        });
        proposedRepairCount++;
        continue;
      }
    }

    if (isCounselor && creator.companyId) {
      const employerWorkspace = await Workspace.findOne({ ownerId: creator.companyId }).lean();
      if (employerWorkspace) {
        proposedRepairs.push({
          leadId: lead._id,
          leadName: lead.name,
          creatorName: creator.name,
          currentCompanyId: lead.companyId,
          proposedCompanyId: creator.companyId,
          currentWorkspaceId: lead.workspaceId,
          proposedWorkspaceId: employerWorkspace._id,
          workspaceName: employerWorkspace.name
        });
        proposedRepairCount++;
        continue;
      }
    }

    ambiguousRecords.push({
      leadId: lead._id,
      leadName: lead.name,
      creatorName: creator.name,
      activeMemberships: memberships.length,
      reason: memberships.length > 1 ? 'Multiple active workspace memberships' : 'No verified workspace found'
    });
    ambiguousCount++;
  }

  console.log('\n--- AUDIT SUMMARY ---');
  console.log(`✅ Clean Properly-Scoped Leads:    ${cleanCount}`);
  console.log(`⚠️  Repairable Historical Leads:     ${proposedRepairCount}`);
  console.log(`❓ Ambiguous Cases for Manual Review: ${ambiguousCount}`);

  if (proposedRepairs.length > 0) {
    console.log('\n--- SAMPLE PROPOSED REPAIRS (First 5) ---');
    console.table(proposedRepairs.slice(0, 5));
  }

  if (ambiguousRecords.length > 0) {
    console.log('\n--- AMBIGUOUS RECORDS FOR MANUAL REVIEW (First 5) ---');
    console.table(ambiguousRecords.slice(0, 5));
  }

  console.log('\n🔒 DRY-RUN COMPLETE: ZERO RECORDS MUTATED.');
  await mongoose.disconnect();
}

runDryRunAudit().catch(err => {
  console.error('Dry run failed:', err);
  process.exit(1);
});
