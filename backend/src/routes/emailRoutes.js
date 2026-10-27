const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { protect } = require('../middleware/auth');
const { resolveWorkspace, requirePermission } = require('../middleware/permission');
const emailController = require('../controllers/emailController');

// Multer storage for email attachments
const uploadsDir = path.join(__dirname, '../../uploads/email_attachments');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max standard email attachment limit
  fileFilter: (req, file, cb) => {
    // Disallow dangerous executables
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.msi', '.vbs', '.js'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (dangerousExtensions.includes(ext)) {
      return cb(new Error('Executable attachments are not permitted for security reasons'), false);
    }
    cb(null, true);
  },
});

// Public OAuth Callback (Invoked via browser redirect from Google)
router.get('/oauth/google/callback', emailController.handleGoogleCallback);

// All subsequent routes require authentication & workspace resolution
router.use(protect);
router.use(resolveWorkspace);

// System Configuration Status
router.get('/config-status', emailController.getConfigStatus);

// 1-Click Google OAuth Authorization URL (Admin only)
router.get('/oauth/google/url', requirePermission('email.manage_accounts'), emailController.getGoogleAuthUrl);

// Account Connections & Assignments (Admin only)
router.get('/accounts', requirePermission('email.view'), emailController.getAccounts);
router.post('/accounts/connect', requirePermission('email.manage_accounts'), emailController.connectAccount);
router.put('/accounts/:id/assign', requirePermission('email.manage_accounts'), emailController.updateAccountAssignments);
router.post('/accounts/disconnect', requirePermission('email.manage_accounts'), emailController.disconnectAccount);

// Messages & Folders
router.get('/messages', requirePermission('email.view'), emailController.getMessages);
router.get('/threads/:threadId', requirePermission('email.view'), emailController.getThreadMessages);
router.get('/lead/:leadId', requirePermission('email.view'), emailController.getLeadEmailHistory);

// Sending & Drafts
router.post('/send', requirePermission('email.send'), upload.array('attachments', 10), emailController.sendEmail);
router.post('/drafts', requirePermission('email.send'), emailController.saveDraft);

// Message Updates
router.patch('/messages/:id/read', requirePermission('email.view'), emailController.markRead);
router.patch('/messages/:id/star', requirePermission('email.view'), emailController.markStarred);
router.patch('/messages/:id/folder', requirePermission('email.view'), emailController.moveFolder);
router.delete('/messages/:id', requirePermission('email.view'), emailController.deleteMessage);

module.exports = router;
