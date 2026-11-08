/**
 * Idempotent Backfill Script: Legacy Lead workspaceId Backfill
 *
 * Scans all Lead documents where workspaceId is null, undefined, or missing,
 * safely resolves their workspaceId via owner company or creator membership,
 * and updates them.
 *
 * Default mode: DRY RUN (no modifications)
 * To apply updates: node src/scripts/backfillLegacyLeadWorkspaceId.js --apply
 */

const mongoose = require('mongoose');

async function runBackfill(options = {}) {
  const isApply = options.apply || process.argv.includes('--apply');
  console.log(`\n============================================================`);
  console.log(`🛠️  BACKFILL: Legacy Lead workspaceId Resolution`);
  console.log(`🔒 Mode: ${isApply ? 'APPLY (Active Database Writes)' : 'DRY RUN (Read Only Preview)'}`);
  console.log(`============================================================\n`);

  const Lead = require('../models/Lead');
  const Workspace = require('../models/Workspace');
  const WorkspaceMembership = require('../models/WorkspaceMembership');
  const User = require('../models/User');

  const query = {
    $or: [
      { workspaceId: null },
      { workspaceId: { $exists: false } },
    ],
  };

  const totalUnscoped = await Lead.countDocuments(query);
  console.log(`📊 Found ${totalUnscoped} leads with missing workspaceId.`);

  if (totalUnscoped === 0) {
    console.log('✅ All leads already have workspaceId assigned. Zero actions needed.\n');
    return { total: 0, resolved: 0, unresolved: 0 };
  }

  let resolvedCount = 0;
  let unresolvedCount = 0;
  const unresolvedLeadIds = [];
  const workspaceMemo = new Map(); // ownerId/userId -> workspaceId

  const cursor = Lead.find(query).cursor();

  for await (const lead of cursor) {
    let targetWsId = null;

    // 1. Try resolving via lead.companyId (Company Owner's primary workspace)
    if (lead.companyId) {
      const compKey = String(lead.companyId);
      if (workspaceMemo.has(compKey)) {
        targetWsId = workspaceMemo.get(compKey);
      } else {
        const ws = await Workspace.findOne({ ownerId: lead.companyId, deletedAt: null }).select('_id').lean();
        if (ws) {
          targetWsId = ws._id;
          workspaceMemo.set(compKey, targetWsId);
        }
      }
    }

    // 2. Try resolving via lead.userId (Lead creator's primary owned workspace)
    if (!targetWsId && lead.userId) {
      const userKey = String(lead.userId);
      if (workspaceMemo.has(userKey)) {
        targetWsId = workspaceMemo.get(userKey);
      } else {
        const ws = await Workspace.findOne({ ownerId: lead.userId, deletedAt: null }).select('_id').lean();
        if (ws) {
          targetWsId = ws._id;
          workspaceMemo.set(userKey, targetWsId);
        }
      }
    }

    // 3. Try resolving via lead creator's active membership
    if (!targetWsId && lead.userId) {
      const memKey = `mem_${lead.userId}`;
      if (workspaceMemo.has(memKey)) {
        targetWsId = workspaceMemo.get(memKey);
      } else {
        const mem = await WorkspaceMembership.findOne({ userId: lead.userId, status: 'active' }).select('workspaceId').lean();
        if (mem) {
          targetWsId = mem.workspaceId;
          workspaceMemo.set(memKey, targetWsId);
        }
      }
    }

    if (targetWsId) {
      resolvedCount++;
      if (isApply) {
        await Lead.updateOne({ _id: lead._id }, { $set: { workspaceId: targetWsId } });
      }
    } else {
      unresolvedCount++;
      unresolvedLeadIds.push(lead._id);
    }
  }

  console.log(`\n============================================================`);
  console.log(`📋 BACKFILL SUMMARY:`);
  console.log(`  - Total Unscoped Leads Found:   ${totalUnscoped}`);
  console.log(`  - Successfully Resolvable:      ${resolvedCount}`);
  console.log(`  - Unresolvable Orphans:         ${unresolvedCount}`);
  if (unresolvedLeadIds.length > 0) {
    console.log(`  - Unresolved IDs (Sample max 5): ${unresolvedLeadIds.slice(0, 5).join(', ')}`);
  }
  console.log(`============================================================\n`);

  if (!isApply && resolvedCount > 0) {
    console.log(`ℹ️  To commit these ${resolvedCount} updates, run:`);
    console.log(`   node src/scripts/backfillLegacyLeadWorkspaceId.js --apply\n`);
  }

  return { total: totalUnscoped, resolved: resolvedCount, unresolved: unresolvedCount };
}

if (require.main === module) {
  const connectDB = require('../config/db');
  connectDB().then(async () => {
    try {
      await runBackfill();
      process.exit(0);
    } catch (err) {
      console.error('Backfill error:', err);
      process.exit(1);
    }
  });
}

module.exports = { runBackfill };
