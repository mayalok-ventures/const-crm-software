const { z } = require('zod');

const loginSchema = z.object({
  email: z.string().min(1, 'Email or phone is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  twoFactorToken: z.string().optional(),
});

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone must be at least 10 digits'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  industryType: z.enum(['Education', 'Real Estate', 'Event Management', 'General Sales']).default('Education'),
  companyName: z.string().optional(),
});

const verify2FASchema = z.object({
  userId: z.string().min(1),
  token: z.string().length(6, '2FA token must be 6 digits'),
});

module.exports = {
  loginSchema,
  registerSchema,
  verify2FASchema,
};
