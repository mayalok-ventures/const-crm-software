const Razorpay = require('razorpay');

const key_id = process.env.RAZORPAY_KEY_ID || 'rzp_test_TQ9ZmdeL8EFkTc';
const key_secret = process.env.RAZORPAY_KEY_SECRET || 'w7hwqkHg6QalS7ALERousgsV';
const webhook_secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'rzp_webhook_secret_secure_2026';

let razorpayInstance = null;

try {
  if (key_id && key_secret) {
    razorpayInstance = new Razorpay({
      key_id,
      key_secret,
    });
  }
} catch (err) {
  console.warn('[Razorpay] Instance initialization warning:', err.message);
}

module.exports = {
  razorpayInstance,
  RAZORPAY_KEY_ID: key_id,
  RAZORPAY_KEY_SECRET: key_secret,
  RAZORPAY_WEBHOOK_SECRET: webhook_secret,
};

