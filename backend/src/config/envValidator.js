/**
 * Production Environment Configuration Validator
 * Validates required secrets and runtime configuration at startup.
 * Fails fast in production if critical security variables are missing or insecure.
 */

function validateEnvironment() {
  const isProduction = process.env.NODE_ENV === 'production';
  const errors = [];

  if (isProduction) {
    // 1. JWT Secret Validation
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret === 'crm_jwt_secret_dev_key_2026' || jwtSecret.length < 16) {
      errors.push('JWT_SECRET: Must be configured in production with a strong secret (min 16 chars). Insecure default rejected.');
    }

    // 2. MongoDB URI Validation
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri || (!mongoUri.startsWith('mongodb://') && !mongoUri.startsWith('mongodb+srv://'))) {
      errors.push('MONGO_URI: Must be set to a valid mongodb:// or mongodb+srv:// connection URI in production.');
    }

    if (errors.length > 0) {
      console.error('\n❌ [FATAL] Production Environment Validation Failed:');
      errors.forEach((err) => console.error(`  - ${err}`));
      console.error('\nServer startup aborted to prevent insecure execution.\n');
      process.exit(1);
    }

    console.log('✅ [EnvValidator] Production environment configuration verified.');
  } else {
    // Safe development fallback defaults
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'crm_jwt_secret_dev_key_2026';
  }
}

module.exports = { validateEnvironment };
