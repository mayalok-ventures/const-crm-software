const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey() {
  const secret = process.env.INTEGRATION_ENCRYPTION_KEY;

  if (!secret) {
    throw new Error(
      'INTEGRATION_ENCRYPTION_KEY is not configured'
    );
  }

  return crypto
    .createHash('sha256')
    .update(secret)
    .digest();
}

function encrypt(text) {
  if (!text) return null;

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
}

function decrypt(payload) {
  if (!payload) return null;

  const key = getEncryptionKey();

  const [ivHex, authTagHex, encryptedHex] =
    payload.split(':');

  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error('Invalid encrypted token format');
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
    decipher.update(
      Buffer.from(encryptedHex, 'hex')
    ),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

module.exports = {
  encrypt,
  decrypt,
};