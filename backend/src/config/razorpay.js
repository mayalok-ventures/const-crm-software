const Razorpay = require('razorpay');

const key_id = process.env.RAZORPAY_KEY_ID || 'rzp_test_mockkey12345';
const key_secret = process.env.RAZORPAY_KEY_SECRET || 'rzp_test_mocksecret12345';
const webhook_secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'rzp_webhook_secret_secure_2026';

let razorpayInstance = null;

try {
  razorpayInstance = new Razorpay({
    key_id,
    key_secret,
  });
} catch (err) {
  console.warn('[Razorpay] Instance initialization warning:', err.message);
}

module.exports = {
  razorpayInstance,
  RAZORPAY_KEY_ID: key_id,
  RAZORPAY_KEY_SECRET: key_secret,
  RAZORPAY_WEBHOOK_SECRET: webhook_secret,
};
