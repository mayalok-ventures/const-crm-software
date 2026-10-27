const EmailService = require('../services/email/emailService');

/**
 * Controller handling all incoming HTTP requests for the CRM Email module
 */

// @desc    Get system OAuth and provider configuration status
// @route   GET /api/email/config-status
// @access  Private (Authenticated)
exports.getConfigStatus = async (req, res) => {
  try {
    const status = EmailService.getProviderConfigStatus();
    res.json({ success: true, ...status });
  } catch (err) {
    console.error('[EmailController] getConfigStatus error:', err);
    res.status(500).json({ message: err.message || 'Failed to get provider config status' });
  }
};

// @desc    Get connected email accounts for workspace
// @route   GET /api/email/accounts
// @access  Private
exports.getAccounts = async (req, res) => {
  try {
    const accounts = await EmailService.getAccounts(req.workspaceId, req.user);
    res.json({ success: true, accounts });
  } catch (err) {
    console.error('[EmailController] getAccounts error:', err);
    res.status(500).json({ message: err.message || 'Failed to fetch email accounts' });
  }
};

// @desc    Connect a new email account
// @route   POST /api/email/accounts/connect
// @access  Private (Owner / email.manage_accounts)
exports.connectAccount = async (req, res) => {
  try {
    const { provider, email, displayName, isShared, isGlobal, assignedUserIds, credentials } = req.body;

    const isOwnerOrManager = req.user.role === 'owner' || req.user.role === 'admin' || req.membership?.role === 'owner' || req.membership?.role === 'manager';
    const cleanIsShared = isOwnerOrManager ? Boolean(isShared) : false;
    const cleanIsGlobal = isOwnerOrManager ? Boolean(isGlobal) : false;

    const account = await EmailService.connectAccount({
      workspaceId: req.workspaceId,
      userId: req.user._id,
      provider,
      email,
      displayName,
      isShared: cleanIsShared,
      isGlobal: cleanIsGlobal,
      assignedUserIds: Array.isArray(assignedUserIds) ? assignedUserIds : [],
      credentials: credentials || {},
    });

    res.status(201).json({ success: true, account });
  } catch (err) {
    console.error('[EmailController] connectAccount error:', err);
    res.status(400).json({ message: err.message || 'Failed to connect email account' });
  }
};

// @desc    Update email account assignments
// @route   PUT /api/email/accounts/:id/assign
// @access  Private (Owner / email.manage_accounts)
exports.updateAccountAssignments = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedUserIds, isGlobal } = req.body;

    const account = await EmailService.updateAccountAssignments(req.workspaceId, id, {
      assignedUserIds,
      isGlobal,
    });

    res.json({ success: true, message: 'Mailbox assignments updated successfully', account });
  } catch (err) {
    console.error('[EmailController] updateAccountAssignments error:', err);
    res.status(400).json({ message: err.message || 'Failed to update email account assignments' });
  }
};

// @desc    Disconnect an email account
// @route   POST /api/email/accounts/disconnect
// @access  Private
exports.disconnectAccount = async (req, res) => {
  try {
    const { accountId } = req.body;
    if (!accountId) {
      return res.status(400).json({ message: 'accountId is required' });
    }

    const result = await EmailService.disconnectAccount(req.workspaceId, accountId, req.user);
    res.json(result);
  } catch (err) {
    console.error('[EmailController] disconnectAccount error:', err);
    res.status(400).json({ message: err.message || 'Failed to disconnect account' });
  }
};

// @desc    Get paginated messages for folder
// @route   GET /api/email/messages
// @access  Private
exports.getMessages = async (req, res) => {
  try {
    const { accountId, folder, search, unreadOnly, starredOnly, page, limit } = req.query;

    const data = await EmailService.getMessages({
      workspaceId: req.workspaceId,
      accountId,
      folder: folder || 'inbox',
      search: search || '',
      unreadOnly: unreadOnly === 'true',
      starredOnly: starredOnly === 'true',
      page: Number(page) || 1,
      limit: Number(limit) || 30,
      user: req.user,
    });

    res.json({ success: true, ...data });
  } catch (err) {
    console.error('[EmailController] getMessages error:', err);
    res.status(500).json({ message: err.message || 'Failed to fetch email messages' });
  }
};

// @desc    Get full thread messages
// @route   GET /api/email/threads/:threadId
// @access  Private
exports.getThreadMessages = async (req, res) => {
  try {
    const { threadId } = req.params;
    const messages = await EmailService.getThreadMessages(req.workspaceId, threadId, req.user);
    res.json({ success: true, messages });
  } catch (err) {
    console.error('[EmailController] getThreadMessages error:', err);
    res.status(500).json({ message: err.message || 'Failed to fetch thread' });
  }
};

// @desc    Send an email
// @route   POST /api/email/send
// @access  Private
exports.sendEmail = async (req, res) => {
  try {
    const {
      accountId,
      to,
      cc,
      bcc,
      subject,
      bodyHtml,
      bodyText,
      inReplyTo,
      references,
      threadId,
      leadId,
      templateId,
    } = req.body;

    // Handle any uploaded attachments from multipart/form-data
    let attachments = [];
    if (req.files && Array.isArray(req.files)) {
      attachments = req.files.map(file => ({
        filename: file.originalname,
        contentType: file.mimetype,
        size: file.size,
        url: `/uploads/templates/${file.filename}`, // or uploaded path
      }));
    } else if (req.body.attachments && Array.isArray(req.body.attachments)) {
      attachments = req.body.attachments;
    }

    const message = await EmailService.sendEmail({
      workspaceId: req.workspaceId,
      userId: req.user._id,
      userName: req.user.name || 'Advisor',
      accountId,
      to,
      cc,
      bcc,
      subject,
      bodyHtml,
      bodyText,
      attachments,
      inReplyTo,
      references,
      threadId,
      leadId,
      templateId,
    });

    res.status(201).json({ success: true, message });
  } catch (err) {
    console.error('[EmailController] sendEmail error:', err);
    const detailedMessage = err.response?.data?.error?.message ||
                            err.response?.data?.message ||
                            err.message ||
                            'Failed to send email';
    const status = (detailedMessage && detailedMessage.toLowerCase().includes('access denied')) ? 403 : 400;
    res.status(status).json({ message: detailedMessage });
  }
};

// @desc    Save or update draft
// @route   POST /api/email/drafts
// @access  Private
exports.saveDraft = async (req, res) => {
  try {
    const draft = await EmailService.saveDraft({
      workspaceId: req.workspaceId,
      userId: req.user._id,
      ...req.body,
    });

    res.json({ success: true, draft });
  } catch (err) {
    console.error('[EmailController] saveDraft error:', err);
    res.status(400).json({ message: err.message || 'Failed to save draft' });
  }
};

// @desc    Toggle message read / unread
// @route   PATCH /api/email/messages/:id/read
// @access  Private
exports.markRead = async (req, res) => {
  try {
    const { isRead = true } = req.body;
    const message = await EmailService.markMessageRead(req.workspaceId, req.params.id, isRead, req.user);
    res.json({ success: true, message });
  } catch (err) {
    console.error('[EmailController] markRead error:', err);
    res.status(400).json({ message: err.message || 'Failed to update read status' });
  }
};

// @desc    Toggle message star
// @route   PATCH /api/email/messages/:id/star
// @access  Private
exports.markStarred = async (req, res) => {
  try {
    const { isStarred = true } = req.body;
    const message = await EmailService.markMessageStarred(req.workspaceId, req.params.id, isStarred, req.user);
    res.json({ success: true, message });
  } catch (err) {
    console.error('[EmailController] markStarred error:', err);
    res.status(400).json({ message: err.message || 'Failed to update star status' });
  }
};

// @desc    Move message to folder
// @route   PATCH /api/email/messages/:id/folder
// @access  Private
exports.moveFolder = async (req, res) => {
  try {
    const { folder } = req.body;
    const message = await EmailService.moveMessageFolder(req.workspaceId, req.params.id, folder, req.user);
    res.json({ success: true, message });
  } catch (err) {
    console.error('[EmailController] moveFolder error:', err);
    res.status(400).json({ message: err.message || 'Failed to move folder' });
  }
};

// @desc    Delete message
// @route   DELETE /api/email/messages/:id
// @access  Private
exports.deleteMessage = async (req, res) => {
  try {
    const permanent = req.query.permanent === 'true';
    const result = await EmailService.deleteMessage(req.workspaceId, req.params.id, permanent, req.user);
    res.json(result);
  } catch (err) {
    console.error('[EmailController] deleteMessage error:', err);
    res.status(400).json({ message: err.message || 'Failed to delete message' });
  }
};

// @desc    Get email history for a specific lead
// @route   GET /api/email/lead/:leadId
// @access  Private
exports.getLeadEmailHistory = async (req, res) => {
  try {
    const { leadId } = req.params;
    const emails = await EmailService.getLeadEmailHistory(req.workspaceId, leadId, req.user);
    res.json({ success: true, emails });
  } catch (err) {
    console.error('[EmailController] getLeadEmailHistory error:', err);
    res.status(500).json({ message: err.message || 'Failed to fetch lead emails' });
  }
};

// @desc    Generate 1-Click Google OAuth authorization URL
// @route   GET /api/email/oauth/google/url
// @access  Private
exports.getGoogleAuthUrl = async (req, res) => {
  try {
    const url = EmailService.getGoogleAuthUrl(req.workspaceId, req.user._id);
    res.json({ success: true, url });
  } catch (err) {
    console.error('[EmailController] getGoogleAuthUrl error:', err.message);
    res.status(400).json({ message: err.message || 'Failed to generate Google OAuth URL' });
  }
};

// @desc    Handle Google OAuth 2.0 redirect callback
// @route   GET /api/email/oauth/google/callback
// @access  Public (Google Redirect)
exports.handleGoogleCallback = async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`${frontendUrl}/email?error=google_denied&message=${encodeURIComponent(error)}`);
  }

  try {
    const { email } = await EmailService.handleGoogleOAuthCallback(code, state);
    res.redirect(`${frontendUrl}/email?connected=google&email=${encodeURIComponent(email)}`);
  } catch (err) {
    console.error('[EmailController] Google OAuth callback error:', err.message);
    res.redirect(`${frontendUrl}/email?error=google_failed&message=${encodeURIComponent(err.message)}`);
  }
};
