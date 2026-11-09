/**
 * Production Environment Configuration Validator
 * Validates required secrets and runtime configuration at startup.
 * Fails fast in production if critical security variables are missing, weak, or pointing to local dev resources.
 */

let configErrors = [];

function validateEnvironment() {
  const isProduction = process.env.NODE_ENV === 'production';
  const errors = [];

  if (isProduction) {
    // 1. JWT Secret Validation (Must be cryptographically strong, min 32 chars)
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret === 'crm_jwt_secret_dev_key_2026' || jwtSecret.length < 32) {
      errors.push('JWT_SECRET: Must be configured in production with a strong secret (min 32 chars).');
    }

    // 2. MongoDB URI Validation (Must be cluster connection, never local in production)
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri || (!mongoUri.startsWith('mongodb://') && !mongoUri.startsWith('mongodb+srv://'))) {
      errors.push('MONGO_URI: Must be set to a valid mongodb:// or mongodb+srv:// connection URI in production.');
    } else if (mongoUri.includes('localhost') || mongoUri.includes('127.0.0.1')) {
      errors.push('MONGO_URI: Production database URI cannot point to localhost or 127.0.0.1.');
    }

    // 3. Sensitive Data Encryption Key Validation (AES-256-GCM tokens)
    const encKey = process.env.INTEGRATION_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;
    if (!encKey || encKey === 'crm_default_integration_aes_key_32_bytes_2026' || encKey.length < 32) {
      errors.push('ENCRYPTION_KEY / INTEGRATION_ENCRYPTION_KEY: Must be configured in production with min 32 chars.');
    }

    // 4. WhatsApp Auth Encryption Key Validation
    const waKey = process.env.WA_ENCRYPTION_KEY || encKey;
    if (!waKey || waKey.length < 32) {
      errors.push('WA_ENCRYPTION_KEY: Must be configured in production with min 32 chars or 64 hex chars for Baileys auth at-rest encryption.');
    }

    // 5. Inbound Webhook Secrets Validation (Fail-Closed Notice)
    if (!process.env.META_APP_SECRET) {
      console.warn('⚠️ [EnvValidator] META_APP_SECRET is not configured. Inbound Meta webhooks will fail closed.');
    }

    configErrors = errors;

    if (errors.length > 0) {
      console.error('\n⚠️ [WARN] Production Environment Validation Notices:');
      errors.forEach((err) => console.error(`  - ${err}`));
      if (process.env.STRICT_ENV_EXIT !== 'false') {
        console.error('\nServer startup aborted to prevent insecure execution in production (STRICT_ENV_EXIT!=false).\n');
        process.exit(1);
      } else {
        console.warn('\nContinuing startup because STRICT_ENV_EXIT=false (permissive testing mode).\n');
      }
    } else {
      console.log('✅ [EnvValidator] Production environment configuration verified.');
    }
  } else {
    // Safe development fallback defaults
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'crm_jwt_secret_dev_key_2026';
  }
}

function getConfigurationErrors() {
  return configErrors;
}

module.exports = { validateEnvironment, getConfigurationErrors };
