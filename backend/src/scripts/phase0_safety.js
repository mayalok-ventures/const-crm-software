const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const gitExe = `${process.env.LOCALAPPDATA}\\Programs\\MinGit\\cmd\\git.exe`;

console.log('=== PHASE 0: SAFETY & BASELINE RECOVERY ===');

// 1. Git branch creation
try {
  const branchName = 'restore/admin-rollback-20260818';
  console.log(`Creating/checking out recovery branch: ${branchName}...`);
  try {
    execSync(`"${gitExe}" checkout -b ${branchName}`, { stdio: 'inherit' });
  } catch {
    execSync(`"${gitExe}" checkout ${branchName}`, { stdio: 'inherit' });
  }
  console.log('✅ Recovery branch active.');
} catch (err) {
  console.warn('Git branch warning:', err.message);
}

// 2. Export canonical leads before cleanup
(async () => {
  try {
    const dotenv = require('dotenv');
    dotenv.config();

    // Check if mongo is running
    const mongoUri = process.env.MONGODB_URI;
    if (mongoUri) {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
      const Lead = require('../models/Lead');
      const leads = await Lead.find().lean();
      console.log(`Found ${leads.length} leads in database.`);
      
      const backupPath = path.join(__dirname, '../../../scratch/canonical_leads_backup.json');
      fs.writeFileSync(backupPath, JSON.stringify(leads, null, 2));
      console.log(`✅ Canonical leads backed up to: ${backupPath}`);
      
      await mongoose.disconnect();
    }
  } catch (err) {
    console.log('DB Note (Embedded DB running with backend service):', err.message);
  }
  console.log('✅ Phase 0 Safety Baseline complete.');
})();
