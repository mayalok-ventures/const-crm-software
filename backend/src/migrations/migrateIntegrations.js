const crypto = require('crypto');
const Integration = require('../models/Integration');

/**
 * Migration helper for existing Google Ads and Sheets integrations.
 * Generates cryptographically secure per-integration inbound keys for any
 * legacy records that were configured prior to the self-serve architecture.
 */
async function migrateIntegrations() {
  try {
    const unmigratedGoogle = await Integration.find({
      provider: 'google',
      $or: [
        { googleKeyHash: { $exists: false } },
        { googleKeyHash: null },
      ],
    }).select('+googleKeyHash');

    if (unmigratedGoogle.length > 0) {
      console.log(`[Migration] Migrating ${unmigratedGoogle.length} Google Ads integrations to per-integration keys...`);
      for (const integration of unmigratedGoogle) {
        const rawKey = `gads_sec_${crypto.randomBytes(24).toString('hex')}`;
        const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

        integration.googleKeyHash = keyHash;
        integration.googleKeyPrefix = rawKey.substring(0, 12) + '...';
        integration.metadata = {
          ...(integration.metadata || {}),
          legacyWebhookNeedsUpdate: true,
          keyGeneratedAt: new Date(),
          legacyCutoffDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60-day migration window
          generatedKeyPlaintextOnce: rawKey, // Available only until first admin view or dismissed
        };

        await integration.save();
      }
      console.log(`[Migration] Successfully generated per-integration keys for ${unmigratedGoogle.length} Google integrations.`);
    }

    // Ensure website forms have unique formKeys
    const unmigratedForms = await Integration.find({
      provider: 'website',
      $or: [
        { 'websiteFormConfig.formKey': { $exists: false } },
        { 'websiteFormConfig.formKey': null },
      ],
    });

    for (const formInt of unmigratedForms) {
      formInt.websiteFormConfig = {
        ...(formInt.websiteFormConfig || {}),
        formKey: `form_${crypto.randomBytes(16).toString('hex')}`,
        allowedOrigins: ['*'],
        honeypotField: '_crm_hp_trap',
      };
      await formInt.save();
    }

    // Reconcile indexes on leads and integrations to ensure partial filter expressions are active
    const Lead = require('../models/Lead');
    const db = Integration.db;
    if (db) {
      try {
        await db.collection('leads').dropIndex('companyId_1_phone_1').catch(() => {});
        await db.collection('leads').dropIndex('userId_1_phone_1').catch(() => {});
        await db.collection('integrations').dropIndex('companyId_1_provider_1_accountId_1').catch(() => {});
        await Lead.syncIndexes().catch(() => {});
        await Integration.syncIndexes().catch(() => {});
      } catch (idxErr) {
        // Non-blocking index sync
      }
    }
  } catch (error) {
    console.error('[Migration Error] migrateIntegrations failed:', error.message);
  }
}

module.exports = { migrateIntegrations };
