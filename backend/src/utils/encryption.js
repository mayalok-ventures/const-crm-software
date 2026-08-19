const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey() {
  const secret =
    process.env.INTEGRATION_ENCRYPTION_KEY ||
    process.env.ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    'crm_default_integration_aes_key_32_bytes_2026';

  return crypto
    .createHash('sha256')
    .update(String(secret))
    .digest();
}

/**
 * Encrypt plaintext string using AES-256-GCM
 * Output format: ivHex:authTagHex:encryptedHex
 */
function encrypt(text) {
  if (!text) return null;

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(12);

    const cipher = crypto.createCipheriv(
      ALGORITHM,
      key,
      iv
    );

    const encrypted = Buffer.concat([
      cipher.update(String(text), 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return [
      iv.toString('hex'),
      authTag.toString('hex'),
      encrypted.toString('hex'),
    ].join(':');
  } catch (error) {
    console.error('Encryption error:', error.message);
    throw new Error('Failed to encrypt sensitive data');
  }
}

/**
 * Decrypt AES-256-GCM ciphertext
 */
function decrypt(payload) {
  if (!payload) return null;

  try {
    const key = getEncryptionKey();

    const parts = String(payload).split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted token format');
    }

    const [ivHex, authTagHex, encryptedHex] = parts;

    if (!ivHex || !authTagHex || !encryptedHex) {
      throw new Error('Invalid encrypted token components');
    }

    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(ivHex, 'hex')
    );

    decipher.setAuthTag(
      Buffer.from(authTagHex, 'hex')
    );

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedHex, 'hex')),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Decryption error:', error.message);
    throw new Error('Failed to decrypt token: invalid payload or key mismatch');
  }
}

module.exports = {
  encrypt,
  decrypt,
};