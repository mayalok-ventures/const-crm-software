const assert = require('assert');

// 1. Phone Normalizer Test
function normalizePhone(rawPhone) {
  if (!rawPhone || typeof rawPhone !== 'string') return '';
  let digits = rawPhone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits;
}

// 2. Private LAN IP detector
const isPrivateLanIp = (hostname) => {
  if (!hostname || typeof hostname !== 'string') return false;
  return (
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)
  );
};

function getMockBaseUrl(hostname) {
  if (hostname === 'localhost' || hostname === '127.0.0.1' || isPrivateLanIp(hostname)) {
    return `http://${hostname}:5000/api`;
  }
  return 'https://api.sahyak.com/api';
}

console.log('🧪 Testing Frontend Helpers...');

// Test Phone Normalizer
assert.strictEqual(normalizePhone('+91 98765-43210'), '9876543210');
assert.strictEqual(normalizePhone('919876543210'), '9876543210');
assert.strictEqual(normalizePhone('09876543210'), '9876543210');
assert.strictEqual(normalizePhone('9876543210'), '9876543210');
console.log('  ✅ normalizePhone passes all formats (+91, 91, 0, plain 10 digits)');

// Test Private LAN IP
assert.strictEqual(isPrivateLanIp('192.168.1.15'), true);
assert.strictEqual(isPrivateLanIp('10.0.0.5'), true);
assert.strictEqual(isPrivateLanIp('172.20.10.4'), true);
assert.strictEqual(isPrivateLanIp('8.8.8.8'), false);
assert.strictEqual(isPrivateLanIp('crm.sahyak.com'), false);
console.log('  ✅ isPrivateLanIp correctly identifies LAN vs public IPs');

// Test Base URL resolution
assert.strictEqual(getMockBaseUrl('localhost'), 'http://localhost:5000/api');
assert.strictEqual(getMockBaseUrl('127.0.0.1'), 'http://127.0.0.1:5000/api');
assert.strictEqual(getMockBaseUrl('192.168.1.42'), 'http://192.168.1.42:5000/api');
assert.strictEqual(getMockBaseUrl('crm.sahyak.com'), 'https://api.sahyak.com/api');
console.log('  ✅ getBaseUrl routes LAN devices to port 5000 and production to api.sahyak.com');

console.log('\n🎉 ALL FRONTEND HELPER TESTS PASSED!\n');
