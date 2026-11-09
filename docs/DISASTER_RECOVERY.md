# Disaster Recovery & Point-in-Time Database Restoration Runbook
**Target Release**: `release/rc-3`  
**Status**: Stage Gates Specified; Local BSON Verification Executed

---

## 1. Objectives & Verification Status

| Objective | Target Level | Status | Details / Conditions |
|---|---|---|---|
| **Recovery Point Objective (RPO)** | < 1 Hour | **DOCUMENTED (STAGING TARGET)** | Requires production replica set with continuous Oplog streaming or hourly cloud snapshot manager. |
| **Recovery Time Objective (RTO)** | < 30 Minutes | **DOCUMENTED (STAGING TARGET)** | Requires automated cluster spin-up & network restore orchestration in production/staging environment. |
| **Local Dump / Restore Integrity** | 100% Checksum Match | **VERIFIED (LOCAL HARNESS)** | Executed via `backend/src/scripts/backupRestoreVerification.js`. 100% SHA-256 document checksum parity. |

> [!NOTE]
> MongoDB Database Tools (`mongodump`, `mongorestore` CLI binaries) are required for external CLI snapshot orchestration but were **not installed on the Windows developer host** (`where.exe mongodump` returned not found). Local rehearsal was executed natively in Node.js using MongoDB BSON serialization and collection streaming. Production/staging deployment images must ensure MongoDB Database Tools are installed if CLI scripts are invoked directly.

---

## 2. Automated Snapshot & Continuous Backup Strategy (Target Infrastructure)

### 2.1 Snapshot Schedule
| Tier | Frequency | Retention | Storage Target |
|---|---|---|---|
| **Continuous Oplog** | Real-time stream | 7 Days | Cloud Storage / S3 Immutable Vault |
| **Hourly Incremental** | Hourly at HH:00 | 14 Days | Dedicated Geo-Redundant Bucket |
| **Daily Full** | 02:00 UTC daily | 90 Days | KMS-Encrypted Archive |

---

## 3. Production CLI Backup & Restore Commands (`mongodump` / `mongorestore`)

### 3.1 Full Database Backup (Requires MongoDB Database Tools in container)
```bash
# Capture full database with oplog for point-in-time consistency
mongodump \
  --uri="$MONGODB_URI" \
  --oplog \
  --gzip \
  --archive="./backup_crm_$(date +%Y%m%d_%H%M%S).gz"
```

### 3.2 Full Database Restore
```bash
# Replay full archive into target recovery database with oplog replay
mongorestore \
  --uri="$TARGET_MONGODB_URI" \
  --oplogReplay \
  --gzip \
  --archive="./backup_crm_20261109_020000.gz"
```

---

## 4. Local Rehearsal Telemetry & Measured Throughput

**Hardware / Environment:**  
- **Host**: AMD Ryzen 7 PRO 5850U with Radeon Graphics (16 vCPUs, 11.83 GB RAM)  
- **OS**: Windows 11 Enterprise (10.0.26100)  
- **Runtime**: Node.js v24.22.1, MongoDB Memory Server  
- **Tool**: `backend/src/scripts/backupRestoreVerification.js` (BSON serializer + SHA-256 field hashing)

### Measured Results:
| Operation | Dataset Size | Duration | Throughput | Integrity Status |
|---|---|---|---|---|
| **BSON Dump + Checksum** | 2,002 documents (users, workspaces, leads) | 96 ms | 20,854 docs/sec | 100% SHA-256 checksums calculated |
| **BSON Restore + Checksum** | 2,002 documents (clean collection drop & insert) | 155 ms | 12,916 docs/sec | 100% count match & SHA-256 parity |
| **Total Drill Cycle** | 2,002 documents | 251 ms | ~7,976 docs/sec end-to-end | 0 corrupted or lost fields |

To run the local verification drill:
```bash
node -e "require('./backend/tests/setupBdd.js'); require('./backend/tests/rc3_backup_restore_verification.test.js');"
```

---

## 5. Soft-Delete Retention & Purge Policy

- **Retention Window**: Active soft-deleted leads are preserved for exactly **90 days** in the `deletedAt` state to permit recovery from accidental counsellor deletion.
- **Automated Retention Purge Script**: `backend/src/scripts/purgeSoftDeletedLeads.js`
- **Execution Command (Dry Run)**:
  ```bash
  node backend/src/scripts/purgeSoftDeletedLeads.js
  ```
- **Execution Command (Apply)**:
  ```bash
  node backend/src/scripts/purgeSoftDeletedLeads.js --apply --retention-days 90
  ```
- **Durability Guarantee**: All related sub-documents, deals, installments, and recordings are purged inside a single atomic multi-document transaction (`withTransaction`).
