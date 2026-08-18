const express = require('express');
const router = express.Router();
const {
  register,
  login,
  verify2FA,
  setup2FA,
  enable2FA,
  disable2FA,
  reset2FAEmergency,
  updatePipelineStages,
  updateCustomFields,
  updateFormSchema,
  getMe,
  updateProfile,
  changePassword,
  applyCoupon,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/verify-2fa', authLimiter, verify2FA);
router.post('/reset-2fa-emergency', authLimiter, reset2FAEmergency);

router.get('/me', protect, getMe);
router.get('/user', protect, getMe); // Alias route
router.put('/profile', protect, updateProfile);
router.post('/2fa/setup', protect, setup2FA);
router.post('/2fa/enable', protect, enable2FA);
router.post('/2fa/disable', protect, disable2FA);
router.put('/pipeline-stages', protect, updatePipelineStages);
router.put('/form-schema', protect, updateFormSchema || updateCustomFields);
router.put('/custom-fields', protect, updateCustomFields);
router.put('/change-password', protect, changePassword);
router.post('/apply-coupon', protect, applyCoupon);

module.exports = router;
