# CoreSetu CRM — Disaster Recovery & Database Restore Runbook

## 1. Disaster Recovery Objectives
- **RPO (Recovery Point Objective)**: < 5 minutes (Continuous backup via MongoDB Atlas Oplog)
- **RTO (Recovery Time Objective)**: < 30 minutes (Snapshot restoration to a provisioned cluster)

---

## 2. MongoDB Backup Architecture
- **Primary Mechanism**: MongoDB Atlas Automated Continuous Backups
- **Snapshot Frequency**: Continuous oplog backup with daily cluster snapshots retained for 30 days
- **Storage**: Multi-region geographically distributed cloud storage

---

## 3. Database Restore Runbook (Step-by-Step)
1. **Identify Incident & Recovery Point**:
   - Determine exact timestamp prior to corruption or accidental deletion.
2. **Halt Application Traffic**:
   - Set frontend maintenance page or stop API container to prevent inconsistent writes.
3. **Initiate Atlas Point-in-Time Restore**:
   - Navigate to MongoDB Atlas Console > Clusters > Backup > Point in Time Restore.
   - Select the target timestamp and provision a new restore cluster (e.g., `crm-restore-cluster`).
4. **Validate Restored Cluster**:
   - Verify document counts across `users`, `leads`, `projects`, `subscriptions`.
   - Verify compound indexes are active.
5. **Switch Connection String**:
   - Update `MONGO_URI` in `/app/backend/.env` to the new cluster URI.
6. **Restart Backend & Validate**:
   - Restart backend container / PM2 process.
   - Verify `/health/ready` returns HTTP 200.
   - Execute production smoke tests.
7. **Resume Traffic**:
   - Re-enable reverse proxy routing to the application.
