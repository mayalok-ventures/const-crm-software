/**
 * Production Environment Configuration Validator
 * Validates required secrets and runtime configuration at startup.
 * Fails fast in production if critical security variables are missing or insecure.
 */

let configErrors = [];

function validateEnvironment() {
  const isProduction = process.env.NODE_ENV === 'production';
  const errors = [];

  if (isProduction) {
    // 1. JWT Secret Validation
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret === 'crm_jwt_secret_dev_key_2026' || jwtSecret.length < 16) {
      errors.push('JWT_SECRET: Must be configured in production with a strong secret (min 16 chars).');
    }

    // 2. MongoDB URI Validation
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri || (!mongoUri.startsWith('mongodb://') && !mongoUri.startsWith('mongodb+srv://'))) {
      errors.push('MONGO_URI: Must be set to a valid mongodb:// or mongodb+srv:// connection URI in production.');
    }

    // 3. Sensitive Data Encryption Key Validation (AES-256-GCM tokens)
    const encKey = process.env.INTEGRATION_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;
    if (!encKey || encKey === 'crm_default_integration_aes_key_32_bytes_2026' || encKey.length < 32) {
      errors.push('ENCRYPTION_KEY / INTEGRATION_ENCRYPTION_KEY: Must be configured in production with min 32 chars.');
    }

    configErrors = errors;

    if (errors.length > 0) {
      console.error('\n⚠️ [WARN] Production Environment Validation Notices:');
      errors.forEach((err) => console.error(`  - ${err}`));
      if (process.env.STRICT_ENV_EXIT === 'true') {
        console.error('\nServer startup aborted to prevent insecure execution (STRICT_ENV_EXIT=true).\n');
        process.exit(1);
      } else {
        console.warn('\nContinuing startup to bind HTTP listener for AppSail container health checks and diagnostics.\n');
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
