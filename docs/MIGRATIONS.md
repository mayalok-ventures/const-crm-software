# Database Migrations & Reconciliations Runbook (Stage B3)
**Target Branch**: `release/rc-2`  
**Standard Principle**: Safe by default. Every migration is **idempotent**, **dry-run by default**, **logs progress every 500 documents**, and provides an **explicit rollback procedure**.

---

## 1. Migration Inventory

| Script | Purpose | Models Impacted | Dry-Run Flag | Rollback Strategy |
|---|---|---|---|---|
| `backfillLegacyLeadWorkspaceId.js` | Assigns missing `workspaceId` on legacy leads from company owner or creator membership | `Lead`, `Workspace`, `WorkspaceMembership` | Default (pass `--apply` to write) | Stored `unresolvedLeadIds` audit log; restore `workspaceId: null` via query |
| `reconcilePaymentFieldPairs.js` | Synchronizes drifted snake_case and camelCase field pairs on payments | `Payment` | Default (pass `--apply` to write) | Forward compatible bidirectional sync (both keys preserved) |
| `backfillWorkspaceIdForRecordingsAndPayments.js` | Resolves and attaches `workspaceId` to orphaned recordings and payments from parent Lead | `Recording`, `Payment`, `Lead` | Default (pass `--apply` to write) | Point-in-time snapshot or unset `workspaceId` where populated from migration run |
| `reconcileCouponUsageCounters.js` | Reconciles coupon counters (`usageCount`, `currentUsageCount`) against redemption audit logs | `Coupon`, `CouponRedemption` | Default (pass `--apply` to write) | Re-run script against latest redemption count |
| `backfillTokenVersion.js` | Initializes `tokenVersion: 0` for all legacy users without a session version | `User` | Default (pass `--apply` to write) | Backward compatible; `tokenVersion: 0` is default |
| `repairLeadStageStatus.js` | Repairs unaligned or legacy `pipeline_stage` fields into canonical `pipelineStage` and `status` | `Lead` | Default (pass `--apply` to write) | Snapshot collection before run; unsets legacy fields safely |

---

## 2. Standard Operational Procedure

### Step 1: Pre-Migration Snapshot (MANDATORY)
Before applying ANY migration in staging or production, capture a collection dump:
```bash
mongodump --uri="$MONGODB_URI" --collection=<collection_name> --out=./pre_migration_backup_$(date +%Y%m%d_%H%M%S)
```

### Step 2: Dry-Run Verification
Execute the script without `--apply` to preview affected document counts:
```bash
node backend/src/scripts/<scriptName>.js
```
Verify that:
- Total scanned matches expected drift.
- Zero uncaught exceptions occur.
- Memory usage remains stable.

### Step 3: Apply Migration
Execute with `--apply`:
```bash
node backend/src/scripts/<scriptName>.js --apply
```

### Step 4: Post-Migration Re-Verification
Run dry-run again to assert idempotency (reported drift must be 0):
```bash
node backend/src/scripts/<scriptName>.js
# Expected output: "Zero actions needed / 0 drifted"
```

---

## 3. Rollback Procedures by Migration

### 3.1 `backfillLegacyLeadWorkspaceId.js`
- **Rollback Command**:
  ```javascript
  // If specific backfilled leads need to be unlinked:
  await db.collection('leads').updateMany(
    { _id: { $in: [/* list of migrated lead IDs */] } },
    { $unset: { workspaceId: 1 } }
  );
  ```

### 3.2 `repairLeadStageStatus.js`
- Restore collection from pre-migration mongodump:
  ```bash
  mongorestore --uri="$MONGODB_URI" --drop --collection=leads ./pre_migration_backup_*/leads.bson
  ```

### 3.3 `syncIndexes.js` & `pruneRedundantLeadIndexes.js`
- Rollback statements are printed directly to stdout on every prune execution. Example:
  ```javascript
  await db.collection('leads').createIndex({ campaignName: 1 }, { name: 'campaignName_1' });
  ```
