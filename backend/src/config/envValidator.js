/**
 * Production Environment Configuration Validator
 * Validates required secrets and runtime configuration at startup.
 * Fails fast (exit 1) in production if critical security variables are missing, weak, or pointing to local dev resources.
 * STRICT SECURITY: Never prints raw secret values in logs or exception messages.
 */

let configErrors = [];

function validateEnvironment() {
  const isProduction = process.env.NODE_ENV === 'production';
  const errors = [];

  if (isProduction) {
    // 0. Strict Scoped Tenant Security (ALLOW_UNSCOPED_* strictly prohibited in production)
    const unscopedFlags = Object.keys(process.env).filter(
      (k) => k.startsWith('ALLOW_UNSCOPED_') && process.env[k] === 'true'
    );
    if (unscopedFlags.length > 0) {
      errors.push(
        `ALLOW_UNSCOPED_TENANT_READS: Unscoped cross-tenant operations are strictly prohibited in production (${unscopedFlags.join(', ')}).`
      );
    }

    // 1. Multi-Instance Distributed Topology & Redis Validation
    const rawInstanceCount = process.env.INSTANCE_COUNT || process.env.WEB_CONCURRENCY || '1';
    const instanceCount = parseInt(rawInstanceCount, 10);
    if (instanceCount > 1 && !process.env.REDIS_URL) {
      errors.push(
        'REDIS_URL: Multi-instance production deployment (INSTANCE_COUNT > 1 or WEB_CONCURRENCY > 1) requires REDIS_URL for distributed rate limiting, lease coordination, and cache synchronization.'
      );
    }

    // 2. CORS Wildcard with Credentials Validation
    const candidateOrigins = [
      process.env.CLIENT_URL,
      process.env.CORS_ORIGIN,
      ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()) : []),
    ].filter(Boolean);

    if (candidateOrigins.includes('*')) {
      errors.push(
        'CORS_ORIGIN / ALLOWED_ORIGINS: Wildcard origin (\'*\') with credentials enabled is insecure and rejected by modern browsers. Specify explicit trusted domain(s).'
      );
    }

    // 3. Cryptographic Secrets Hardening (Must be >= 32 chars, never default, no secrets printed in errors)
    const secretChecks = [
      { name: 'JWT_SECRET', val: process.env.JWT_SECRET, defaultVal: 'crm_jwt_secret_dev_key_2026', required: true },
      { name: 'SESSION_SECRET', val: process.env.SESSION_SECRET, defaultVal: 'crm_session_dev_secret', required: false },
      { name: 'ADMIN_JWT_SECRET', val: process.env.ADMIN_JWT_SECRET, defaultVal: 'crm_admin_jwt_dev_key_2026', required: false },
      {
        name: 'ENCRYPTION_KEY / INTEGRATION_ENCRYPTION_KEY',
        val: process.env.INTEGRATION_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY,
        defaultVal: 'crm_default_integration_aes_key_32_bytes_2026',
        required: true,
      },
    ];

    for (const s of secretChecks) {
      if (s.required && !s.val) {
        errors.push(`${s.name}: Required secret is missing in production.`);
      } else if (s.val) {
        if (s.val === s.defaultVal) {
          errors.push(`${s.name}: Insecure default development secret detected in production.`);
        } else if (s.val.trim().length < 32) {
          errors.push(`${s.name}: Secret length (${s.val.trim().length} chars) is below the minimum cryptographic requirement of 32 characters.`);
        }
      }
    }

    // 4. Dedicated WhatsApp Auth Encryption Key Validation (AES-256-GCM, NO fallback to INTEGRATION_ENCRYPTION_KEY)
    const isWhatsAppEnabled = process.env.RUN_BACKGROUND_WORKERS !== 'false';
    const waKey = (process.env.WA_ENCRYPTION_KEY || '').trim();
    if (isWhatsAppEnabled) {
      if (!waKey) {
        errors.push(
          'WA_ENCRYPTION_KEY: Dedicated WhatsApp auth encryption key (min 32 chars or 64 hex chars) is required in production when WhatsApp background workers are active.'
        );
      } else if (waKey === 'crm_default_integration_aes_key_32_bytes_2026') {
        errors.push('WA_ENCRYPTION_KEY: Insecure default key detected. Must use a unique dedicated key.');
      } else if (waKey.length < 32) {
        errors.push(`WA_ENCRYPTION_KEY: Key length (${waKey.length} chars) is below the minimum cryptographic requirement of 32 characters.`);
      }
    }

    // 5. MongoDB URI Validation (Must be cluster connection, never local in production)
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri || (!mongoUri.startsWith('mongodb://') && !mongoUri.startsWith('mongodb+srv://'))) {
      errors.push('MONGO_URI: Must be set to a valid mongodb:// or mongodb+srv:// connection URI in production.');
    } else if (mongoUri.includes('localhost') || mongoUri.includes('127.0.0.1')) {
      errors.push('MONGO_URI: Production database URI cannot point to localhost or 127.0.0.1.');
    }

    // 6. Inbound Webhook Secrets Validation (Fail-Closed Notice)
    if (!process.env.META_APP_SECRET) {
      console.warn('⚠️ [EnvValidator] META_APP_SECRET is not configured. Inbound Meta webhooks will fail closed.');
    }

    configErrors = errors;

    if (errors.length > 0) {
      console.error('\n⚠️ [FATAL] Production Environment Validation Failed:');
      errors.forEach((err) => console.error(`  - ${err}`));
      if (process.env.STRICT_ENV_EXIT !== 'false') {
        console.error('\nServer startup aborted to prevent insecure execution in production (exit code 1).\n');
        process.exit(1);
      } else {
        console.warn('\nContinuing startup because STRICT_ENV_EXIT=false (permissive testing mode).\n');
      }
      return { valid: false, errors };
    } else {
      console.log('✅ [EnvValidator] Production environment configuration verified.');
      return { valid: true, errors: [] };
    }
  } else {
    // Safe development fallback defaults
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'crm_jwt_secret_dev_key_2026';
    return { valid: true, errors: [] };
  }
}

function getConfigurationErrors() {
  return configErrors;
}

module.exports = { validateEnvironment, getConfigurationErrors };
