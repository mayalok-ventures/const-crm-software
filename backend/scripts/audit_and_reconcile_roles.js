/**
 * Sahyak CRM - Role Audit and Idempotent Reconciliation Script
 *
 * Scans User and WorkspaceMembership records to detect and safely reconcile legacy
 * role inconsistencies (e.g. users who defaulted to `companyRole: 'owner'` despite
 * being invited or assigned as counsellors, managers, or auditors).
 *
 * SAFETY INVARIANTS:
 * - Defaults to DRY-RUN mode. Will NOT modify any data unless `--apply` is passed.
 * - Detects ambiguous records and leaves them untouched for manual review.
 * - Never downgrades verified workspace owners (`Workspace.ownerId`).
 * - Completely idempotent: executing multiple times produces identical results.
 *
 * Usage:
 *   node backend/scripts/audit_and_reconcile_roles.js             # Dry-run audit report
 *   node backend/scripts/audit_and_reconcile_roles.js --dry-run   # Explicit dry-run
 *   node backend/scripts/audit_and_reconcile_roles.js --apply     # Execute reconciliation
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const Workspace = require('../src/models/Workspace');
const WorkspaceMembership = require('../src/models/WorkspaceMembership');

async function runAuditAndReconcile() {
  const isApply = process.argv.includes('--apply');
  const mode = isApply ? 'APPLY (Live Migration)' : 'DRY RUN (Audit Only)';

  console.log('='.repeat(70));
  console.log(`[Role Audit & Reconciliation] Starting in mode: ${mode}`);
  console.log('='.repeat(70));

  await connectDB();

  try {
    const allUsers = await User.find({}).lean();
    console.log(`Total users in database: ${allUsers.length}`);

    // Preload all workspaces and memberships
    const allWorkspaces = await Workspace.find({}).lean();
    const ownerIdSet = new Set(allWorkspaces.map(w => w.ownerId?.toString()).filter(Boolean));

    const allMemberships = await WorkspaceMembership.find({}).lean();
    const userMembershipMap = new Map();
    allMemberships.forEach(m => {
      const uId = m.userId?.toString();
      if (!userMembershipMap.has(uId)) {
        userMembershipMap.set(uId, []);
      }
      userMembershipMap.get(uId).push(m);
    });

    const report = {
      totalUsers: allUsers.length,
      legitimateOwners: 0,
      consistentMembers: 0,
      inconsistentRecords: [],
      ambiguousRecords: [],
      reconciledCount: 0,
    };

    for (const user of allUsers) {
      const uid = user._id.toString();
      const isTrueWsOwner = ownerIdSet.has(uid);
      const memberships = userMembershipMap.get(uid) || [];
      const hasParentCompany = Boolean(user.companyId && user.companyId.toString() !== uid);

      // SuperAdmins are platform-level, untouched
      if (user.role === 'superadmin') {
        continue;
      }

      // Check if user has legacy companyRole === 'owner'
      const hasOwnerCompanyRole = user.companyRole === 'owner';

      if (hasOwnerCompanyRole) {
        if (isTrueWsOwner && !hasParentCompany) {
          // Legitimate workspace owner
          report.legitimateOwners++;
          continue;
        }

        // Case 1: User has parent company and companyRole: 'owner'
        // Case 2: User is not owner of any workspace, but has a non-owner membership (counsellor/manager/auditor)
        const nonOwnerMemberships = memberships.filter(m => m.role !== 'owner');
        const ownerMemberships = memberships.filter(m => m.role === 'owner');

        if (isTrueWsOwner && nonOwnerMemberships.length > 0) {
          // Ambiguous: User owns one workspace but is a non-owner member of another
          report.ambiguousRecords.push({
            userId: uid,
            email: user.email,
            name: user.name,
            reason: 'User is ownerId of a workspace but also has non-owner memberships',
            memberships: memberships.map(m => ({ workspaceId: m.workspaceId, role: m.role })),
          });
          continue;
        }

        if (!isTrueWsOwner && nonOwnerMemberships.length > 0) {
          // Clear case: User is a non-owner member in their workspace(s), but has companyRole: 'owner'
          const primaryRole = nonOwnerMemberships[0].role || 'counsellor';
          report.inconsistentRecords.push({
            userId: uid,
            email: user.email,
            name: user.name,
            currentCompanyRole: user.companyRole,
            targetRole: primaryRole,
            reason: `Has ${nonOwnerMemberships.length} non-owner membership(s) with role '${primaryRole}' but companyRole='owner'`,
          });
          continue;
        }

        if (hasParentCompany && !isTrueWsOwner) {
          // User is attached to a company with companyId, but no memberships or no owner membership
          const targetRole = user.role === 'manager' ? 'manager' : 'counsellor';
          report.inconsistentRecords.push({
            userId: uid,
            email: user.email,
            name: user.name,
            currentCompanyRole: user.companyRole,
            targetRole,
            reason: `Attached to companyId=${user.companyId} as employee but companyRole='owner'`,
          });
          continue;
        }

        // Solo user with no workspace yet
        if (!hasParentCompany && memberships.length === 0) {
          // Legitimate solo professional waiting for workspace creation
          report.legitimateOwners++;
          continue;
        }
      } else {
        report.consistentMembers++;
      }
    }

    console.log('\n' + '-'.repeat(70));
    console.log('AUDIT SUMMARY:');
    console.log(`- Total Users Inspected:    ${report.totalUsers}`);
    console.log(`- Verified Tenant Owners:   ${report.legitimateOwners}`);
    console.log(`- Consistent Members:       ${report.consistentMembers}`);
    console.log(`- Inconsistent Records:     ${report.inconsistentRecords.length}`);
    console.log(`- Ambiguous / Flagged:      ${report.ambiguousRecords.length}`);
    console.log('-'.repeat(70));

    if (report.ambiguousRecords.length > 0) {
      console.log('\n[AMBIGUOUS RECORDS - LEFT UNTOUCHED FOR MANUAL REVIEW]');
      report.ambiguousRecords.forEach((item, idx) => {
        console.log(`  ${idx + 1}. User ${item.name} (${item.email}, ID: ${item.userId})`);
        console.log(`     Reason: ${item.reason}`);
      });
    }

    if (report.inconsistentRecords.length > 0) {
      console.log('\n[INCONSISTENT RECORDS DETECTED]');
      report.inconsistentRecords.forEach((item, idx) => {
        console.log(`  ${idx + 1}. User ${item.name} (${item.email}, ID: ${item.userId})`);
        console.log(`     Current companyRole: '${item.currentCompanyRole}' -> Target: '${item.targetRole}'`);
        console.log(`     Detail: ${item.reason}`);
      });

      if (isApply) {
        console.log('\nExecuting reconciliation updates...');
        for (const item of report.inconsistentRecords) {
          const updateFields = { companyRole: item.targetRole };
          if (item.targetRole === 'counsellor') {
            updateFields.role = 'counsellor';
            updateFields.workStatus = 'employee';
          } else if (item.targetRole === 'manager') {
            updateFields.role = 'manager';
            updateFields.workStatus = 'employee';
          }
          await User.updateOne({ _id: item.userId }, { $set: updateFields });
          report.reconciledCount++;
        }
        console.log(`[SUCCESS] Reconciled ${report.reconciledCount} records successfully.`);
      } else {
        console.log('\n[NOTICE] Dry-run complete. No changes were made to the database.');
        console.log('To apply these reconciliation fixes, run:');
        console.log('  node backend/scripts/audit_and_reconcile_roles.js --apply');
      }
    } else {
      console.log('\nNo inconsistent records found. All user roles are consistent with workspace memberships.');
    }

    return report;
  } finally {
    try {
      await mongoose.disconnect();
    } catch (_) {}
    console.log('\nDisconnected from database.');
    if (require.main === module) {
      process.exit(0);
    }
  }
}

if (require.main === module) {
  runAuditAndReconcile().catch(err => {
    console.error('Fatal error during role reconciliation:', err);
    process.exit(1);
  });
}

module.exports = { runAuditAndReconcile };
