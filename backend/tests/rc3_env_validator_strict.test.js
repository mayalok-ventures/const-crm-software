const { validateEnvironment, getConfigurationErrors } = require('../src/config/envValidator');

describe('Release RC-3: Strict Production Environment Configuration Validator', () => {
  const originalEnv = { ...process.env };

  const validProdEnv = {
    NODE_ENV: 'production',
    STRICT_ENV_EXIT: 'false', // allow inspecting error array without exiting test process
    JWT_SECRET: 'production_super_strong_cryptographic_jwt_secret_64_bytes_long_1234567890',
    MONGO_URI: 'mongodb+srv://produser:StrongProdPass123!@cluster0.crm.mongodb.net/crm_production?retryWrites=true&w=majority',
    INTEGRATION_ENCRYPTION_KEY: 'production_integration_aes_key_32_bytes_super_secure!',
    WA_ENCRYPTION_KEY: 'production_dedicated_wa_auth_key_64_hex_characters_f0e1d2c3b4a59687',
    RUN_BACKGROUND_WORKERS: 'true',
    REDIS_URL: 'rediss://default:SecureRedisPass123!@redis-cluster.internal:6379',
    INSTANCE_COUNT: '2',
    ALLOWED_ORIGINS: 'https://app.sahyak.com,https://crm.sahyak.com',
    CORS_ORIGIN: 'https://app.sahyak.com',
    CLIENT_URL: 'https://app.sahyak.com',
  };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = { ...originalEnv };
  });

  test('Passes cleanly when all production variables meet strict criteria', () => {
    process.env = { ...validProdEnv };
    const res = validateEnvironment();
    const errors = getConfigurationErrors();
    expect(errors.length).toBe(0);
    if (res) expect(res.valid).toBe(true);
  });

  test('Refuses boot when ALLOW_UNSCOPED_TENANT_READS=true is set in production', () => {
    process.env = {
      ...validProdEnv,
      ALLOW_UNSCOPED_TENANT_READS: 'true',
    };
    validateEnvironment();
    const errors = getConfigurationErrors();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.includes('ALLOW_UNSCOPED_TENANT_READS'))).toBe(true);
  });

  test('Refuses boot when INSTANCE_COUNT > 1 and REDIS_URL is missing', () => {
    const env = { ...validProdEnv, INSTANCE_COUNT: '2' };
    delete env.REDIS_URL;
    process.env = env;

    validateEnvironment();
    const errors = getConfigurationErrors();
    expect(errors.some(e => e.includes('REDIS_URL'))).toBe(true);
  });

  test('Refuses boot when CORS wildcard (*) is configured with credentials', () => {
    process.env = {
      ...validProdEnv,
      ALLOWED_ORIGINS: 'https://app.sahyak.com,*',
    };
    validateEnvironment();
    let errors = getConfigurationErrors();
    expect(errors.some(e => e.includes('Wildcard origin') || e.includes('CORS_ORIGIN'))).toBe(true);

    process.env = {
      ...validProdEnv,
      CLIENT_URL: '*',
    };
    validateEnvironment();
    errors = getConfigurationErrors();
    expect(errors.some(e => e.includes('Wildcard origin') || e.includes('CORS_ORIGIN'))).toBe(true);
  });

  test('Refuses boot on weak secrets (< 32 characters) without leaking secret values', () => {
    const weakSecretValue = 'very_short_secret';
    process.env = {
      ...validProdEnv,
      JWT_SECRET: weakSecretValue,
    };
    validateEnvironment();
    const errors = getConfigurationErrors();
    expect(errors.some(e => e.includes('JWT_SECRET'))).toBe(true);
    // CRITICAL: Ensure raw secret string is NEVER leaked in the error message
    const errorDump = errors.join(' ');
    expect(errorDump.includes(weakSecretValue)).toBe(false);
  });

  test('Refuses boot when WA_ENCRYPTION_KEY is missing while background workers are active', () => {
    const env = { ...validProdEnv, RUN_BACKGROUND_WORKERS: 'true' };
    delete env.WA_ENCRYPTION_KEY;
    process.env = env;

    validateEnvironment();
    const errors = getConfigurationErrors();
    expect(errors.some(e => e.includes('WA_ENCRYPTION_KEY'))).toBe(true);
  });

  test('Refuses boot on localhost MONGO_URI in production', () => {
    process.env = {
      ...validProdEnv,
      MONGO_URI: 'mongodb://127.0.0.1:27017/crm_prod',
    };
    validateEnvironment();
    const errors = getConfigurationErrors();
    expect(errors.some(e => e.includes('MONGO_URI') && e.includes('127.0.0.1'))).toBe(true);
  });
});
