const assert = require('assert');

describe('RC-2 Production Fail-Safe Environment Validator', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should flag errors in production when JWT_SECRET is dev default or less than 32 characters', () => {
    const { validateEnvironment, getConfigurationErrors } = require('../src/config/envValidator');

    process.env.NODE_ENV = 'production';
    process.env.STRICT_ENV_EXIT = 'false'; // prevent process.exit during unit test inspection
    process.env.JWT_SECRET = 'short_secret_16';
    process.env.MONGO_URI = 'mongodb+srv://cluster.mongodb.net/crm_prod';
    process.env.INTEGRATION_ENCRYPTION_KEY = '12345678901234567890123456789012';

    validateEnvironment();
    const errors = getConfigurationErrors();

    assert.ok(errors.some(e => e.includes('JWT_SECRET')), 'Must flag JWT_SECRET error for <32 chars');
  });

  it('should flag errors in production when MONGO_URI is missing or pointing to localhost', () => {
    const { validateEnvironment, getConfigurationErrors } = require('../src/config/envValidator');

    process.env.NODE_ENV = 'production';
    process.env.STRICT_ENV_EXIT = 'false';
    process.env.JWT_SECRET = 'a_very_strong_production_jwt_secret_key_32_chars!';
    process.env.MONGO_URI = 'mongodb://localhost:27017/crm_dev';
    process.env.INTEGRATION_ENCRYPTION_KEY = '12345678901234567890123456789012';

    validateEnvironment();
    const errors = getConfigurationErrors();

    assert.ok(errors.some(e => e.includes('MONGO_URI') && e.includes('localhost')), 'Must flag MONGO_URI pointing to localhost');
  });

  it('should pass cleanly with 0 errors when all production security variables are strong', () => {
    const { validateEnvironment, getConfigurationErrors } = require('../src/config/envValidator');

    process.env.NODE_ENV = 'production';
    process.env.STRICT_ENV_EXIT = 'false';
    process.env.JWT_SECRET = 'a_very_strong_production_jwt_secret_key_32_chars!';
    process.env.MONGO_URI = 'mongodb+srv://user:pass@production-cluster.mongodb.net/crm_production?retryWrites=true&w=majority';
    process.env.INTEGRATION_ENCRYPTION_KEY = 'a_very_strong_aes_256_gcm_key_32_chars_prod!';
    process.env.WA_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    validateEnvironment();
    const errors = getConfigurationErrors();

    assert.strictEqual(errors.length, 0, `Expected 0 errors, got: ${errors.join('; ')}`);
  });
});
