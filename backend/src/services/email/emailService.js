const EmailAccount = require('../../models/EmailAccount');
const EmailMessage = require('../../models/EmailMessage');
const Lead = require('../../models/Lead');
const Template = require('../../models/Template');
const { getProviderAdapter, formatEmailHtml, generatePlainText } = require('./emailProviderAdapters');
const crypto = require('crypto');

/**
 * Security sanitizer: strips dangerous script execution, embedded objects,
 * javascript: pseudo-protocols, and inline event handlers while allowing
 * all standard HTML email markup, inline styles, typography, buttons, and layouts.
 */
function sanitizeEmailHtml(html) {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<\/?(iframe|object|embed|applet|form|input)\b[^>]*>/gi, '')
    .replace(/\b(href|src)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi, '$1="#"')
    .replace(/\s+on[a-z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');
}

/**
 * Service orchestrating CRM Email operations, multi-tenant isolation,
 * threading, drafts, and lead relationship linking.
 */
class EmailService {
  /**
   * Diagnostic method: Check external OAuth environment availability
   */
  static getProviderConfigStatus() {
    return {
      google: {
        configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
        clientId: process.env.GOOGLE_CLIENT_ID ? `${process.env.GOOGLE_CLIENT_ID.slice(0, 12)}...` : null,
        requiredEnv: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
        scopes: [
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.modify',
          'https://www.googleapis.com/auth/userinfo.email',
        ],
      },
      microsoft: {
        configured: Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET),
        clientId: process.env.MICROSOFT_CLIENT_ID ? `${process.env.MICROSOFT_CLIENT_ID.slice(0, 12)}...` : null,
        requiredEnv: ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET'],
        scopes: ['Mail.ReadWrite', 'Mail.Send', 'offline_access', 'User.Read'],
      },
      smtp: {
        supported: true,
        description: 'Standard SMTP/IMAP protocol compatible with all custom domains, Zoho, Google Workspace App Passwords, and cPanel mailboxes.',
      },
    };
  }

  /**
   * Get all connected email accounts available to user in workspace
   */
  static async getAccounts(workspaceId, user) {
    const isPrivileged = user.role === 'owner' || user.role === 'admin' || user.companyRole === 'owner' || user.workspaceRole === 'owner' || user.membership?.role === 'owner';
    const query = {
      workspaceId,
      status: { $ne: 'disconnected' },
    };

    if (!isPrivileged) {
      query.$or = [
        { userId: user._id },
        { isShared: true },
        { isGlobal: true },
        { assignedUserIds: user._id }
      ];
    }

    const accounts = await EmailAccount.find(query)
      .populate('assignedUserIds', 'name email phone avatarIcon')
      .sort({ createdAt: -1 });

    return accounts.map(acc => {
      const json = acc.toSafeJSON();
      json.isGlobal = Boolean(acc.isGlobal);
      json.assignedUserIds = acc.assignedUserIds || [];
      return json;
    });
  }

  /**
   * Helper: Resolve authorized account IDs for a given user in a workspace
   * Returns null if user is privileged (owner/manager), meaning all accounts accessible.
   */
  static async getAuthorizedAccountIds(workspaceId, user) {
    if (!user) return null;
    const isPrivileged = user.role === 'owner' || user.role === 'admin' || user.companyRole === 'owner' || user.workspaceRole === 'owner' || user.membership?.role === 'owner';
    if (isPrivileged) return null;

    const accounts = await EmailAccount.find({
      workspaceId,
      status: { $ne: 'disconnected' },
      $or: [
        { userId: user._id },
        { isShared: true },
        { isGlobal: true },
        { assignedUserIds: user._id }
      ],
    }).select('_id').lean();
    return accounts.map(a => a._id);
  }

  /**
   * Admin updates user assignments and global accessibility of an email account
   */
  static async updateAccountAssignments(workspaceId, accountId, { assignedUserIds, isGlobal }) {
    const account = await EmailAccount.findOne({ _id: accountId, workspaceId });
    if (!account) {
      throw new Error('Email account not found in this workspace');
    }

    if (isGlobal !== undefined) {
      account.isGlobal = Boolean(isGlobal);
    }
    if (Array.isArray(assignedUserIds)) {
      account.assignedUserIds = assignedUserIds;
    }

    await account.save();
    const populated = await EmailAccount.findById(account._id)
      .populate('assignedUserIds', 'name email phone avatarIcon');
    const json = populated.toSafeJSON();
    json.isGlobal = Boolean(populated.isGlobal);
    json.assignedUserIds = populated.assignedUserIds || [];
    return json;
  }

  /**
   * Connect and verify a new email account
   */
  static async connectAccount({ workspaceId, userId, provider, email, displayName, isShared = false, isGlobal = false, assignedUserIds = [], credentials = {} }) {
    if (!email || !provider) {
      throw new Error('Email address and provider are required');
    }

    const cleanEmail = email.trim().toLowerCase();
    let account = await EmailAccount.findOne({ workspaceId, email: cleanEmail })
      .select('+accessTokenEncrypted +refreshTokenEncrypted +smtpPassEncrypted');

    if (!account) {
      account = new EmailAccount({
        workspaceId,
        userId,
        provider: provider.toLowerCase(),
        email: cleanEmail,
        displayName: displayName || cleanEmail.split('@')[0],
        isShared: Boolean(isShared),
        isGlobal: Boolean(isGlobal),
        assignedUserIds: Array.isArray(assignedUserIds) ? assignedUserIds : [],
      });
    } else {
      account.provider = provider.toLowerCase();
      account.displayName = displayName || account.displayName;
      account.isShared = Boolean(isShared);
      if (isGlobal !== undefined) account.isGlobal = Boolean(isGlobal);
      if (Array.isArray(assignedUserIds)) account.assignedUserIds = assignedUserIds;
      account.status = 'active';
      account.lastError = null;
    }

    // Assign credentials based on provider
    if (provider === 'gmail' || provider === 'outlook') {
      const existingRefreshToken = account.getDecryptedRefreshToken();
      const resolvedRefreshToken = credentials.refreshToken || existingRefreshToken;

      account.setTokens({
        accessToken: credentials.accessToken,
        refreshToken: resolvedRefreshToken,
        expiresIn: credentials.expiresIn || 3600,
      });
      if (credentials.scope) {
        account.scope = Array.isArray(credentials.scope) ? credentials.scope : [credentials.scope];
      }
    } else if (provider === 'smtp') {
      account.smtpHost = credentials.smtpHost;
      account.smtpPort = credentials.smtpPort || 587;
      account.smtpSecure = Boolean(credentials.smtpSecure);
      account.smtpUser = credentials.smtpUser || cleanEmail;
      if (credentials.smtpPassword) {
        account.setSmtpPassword(credentials.smtpPassword);
      }
      account.imapHost = credentials.imapHost || null;
      account.imapPort = credentials.imapPort || 993;
      account.imapSecure = Boolean(credentials.imapSecure !== false);
    }

    // Verify connection using the adapter
    const Adapter = getProviderAdapter(account.provider);
    try {
      await Adapter.testConnection(account);
      account.status = 'active';
      account.lastSyncAt = new Date();
      account.lastError = null;
    } catch (testErr) {
      console.warn(`[EmailService] Connection verification warning: ${testErr.message}`);
      account.lastError = testErr.message;
      // If credentials were provided, we save the account in 'error' or 'needs_reauth' state
      account.status = 'error';
    }

    await account.save();
    return account.toSafeJSON();
  }

  /**
   * Disconnect an email account
   */
  static async disconnectAccount(workspaceId, accountId, user) {
    const account = await EmailAccount.findOne({ _id: accountId, workspaceId });
    if (!account) {
      throw new Error('Email account not found');
    }
    if (user) {
      const isPrivileged = user.role === 'owner' || user.role === 'admin' || user.companyRole === 'owner' || user.workspaceRole === 'owner' || user.workspaceRole === 'manager';
      if (!isPrivileged && account.userId && account.userId.toString() !== user._id.toString()) {
        throw new Error('Not authorized to disconnect this email account');
      }
    }
    account.status = 'disconnected';
    await account.save();
    return { success: true, message: 'Account disconnected successfully' };
  }

  /**
   * Automatically resolve or associate a Lead by email address
   */
  static async resolveLeadByEmail(workspaceId, emailAddress) {
    if (!emailAddress) return null;
    const clean = emailAddress.trim().toLowerCase();
    const lead = await Lead.findOne({
      workspaceId,
      email: clean,
    }).select('_id name phone email status assignedTo leadActivities');
    return lead;
  }

  /**
   * Send an email message via connected account and link with CRM
   */
  static async sendEmail({
    workspaceId,
    userId,
    userName = 'Advisor',
    accountId,
    to,
    cc = [],
    bcc = [],
    subject,
    bodyHtml,
    bodyText,
    attachments = [],
    inReplyTo = null,
    references = [],
    threadId = null,
    leadId = null,
    templateId = null,
  }) {
    if (!accountId) {
      throw new Error('Please select a connected email account to send from');
    }
    if (!to || (Array.isArray(to) && to.length === 0)) {
      throw new Error('Recipient email (To) is required');
    }

    const account = await EmailAccount.findOne({ _id: accountId, workspaceId })
      .select('+accessTokenEncrypted +refreshTokenEncrypted +smtpPassEncrypted');
    if (!account || account.status === 'disconnected') {
      throw new Error('Connected email account not found or disconnected');
    }

    // Authorization check: User must be account owner, account must be global, account must be shared, or user must be assigned
    const isAccountOwner = account.userId && account.userId.toString() === userId?.toString();
    const isAssigned = Array.isArray(account.assignedUserIds) && account.assignedUserIds.some(uid => uid.toString() === userId?.toString());
    if (!account.isGlobal && !account.isShared && !isAccountOwner && !isAssigned) {
      const User = require('../../models/User');
      const senderUser = await User.findById(userId).select('role companyRole').lean();
      const isPrivileged = senderUser?.role === 'owner' || senderUser?.role === 'admin' || senderUser?.companyRole === 'owner';
      if (!isPrivileged) {
        throw new Error('Access denied: You are not assigned to send from this email account');
      }
    }

    // Normalize recipients
    const normalizeRecipientList = (recipients) => {
      if (!recipients) return [];
      const list = Array.isArray(recipients) ? recipients : [recipients];
      return list
        .map(item => {
          if (typeof item === 'string') {
            return { name: '', email: item.trim().toLowerCase() };
          }
          if (item && item.email) {
            return { name: item.name || '', email: item.email.trim().toLowerCase() };
          }
          return null;
        })
        .filter(Boolean);
    };

    const formattedTo = normalizeRecipientList(to);
    const formattedCc = normalizeRecipientList(cc);
    const formattedBcc = normalizeRecipientList(bcc);

    if (formattedTo.length === 0) {
      throw new Error('At least one valid recipient email is required');
    }

    // Auto-resolve Lead if not explicitly provided
    let matchedLead = null;
    if (leadId) {
      matchedLead = await Lead.findOne({ _id: leadId, workspaceId });
    } else if (formattedTo.length > 0) {
      matchedLead = await this.resolveLeadByEmail(workspaceId, formattedTo[0].email);
    }

    // Generate RFC 5322 threadId if not provided
    const resolvedThreadId = threadId || inReplyTo || `thread_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    // Sanitize and format rich HTML email and plain text alternative
    const sanitizedHtml = sanitizeEmailHtml(bodyHtml || '');
    const resolvedHtml = formatEmailHtml(sanitizedHtml || bodyText || '');
    const resolvedText = bodyText || generatePlainText(resolvedHtml);

    // Send via provider adapter
    const Adapter = getProviderAdapter(account.provider);
    const sendResult = await Adapter.sendEmail(account, {
      to: formattedTo,
      cc: formattedCc,
      bcc: formattedBcc,
      subject: subject || '(No Subject)',
      bodyHtml: resolvedHtml,
      bodyText: resolvedText,
      attachments,
      inReplyTo,
      references: inReplyTo ? [...(references || []), inReplyTo] : references,
      threadId: resolvedThreadId,
    });

    // Create snippet for inbox lists
    const cleanSnippet = resolvedText.slice(0, 140).trim();

    // Persist in EmailMessage collection
    const savedMessage = await EmailMessage.create({
      workspaceId,
      accountId: account._id,
      userId,
      leadId: matchedLead?._id || null,
      folder: 'sent',
      status: 'sent',
      threadId: sendResult.threadId || resolvedThreadId,
      messageId: sendResult.messageId,
      providerMessageId: sendResult.providerMessageId,
      inReplyTo,
      references: inReplyTo ? [...(references || []), inReplyTo] : references,
      from: {
        name: account.displayName || account.email.split('@')[0],
        email: account.email,
      },
      to: formattedTo,
      cc: formattedCc,
      bcc: formattedBcc,
      subject: subject || '(No Subject)',
      snippet: cleanSnippet,
      bodyHtml: resolvedHtml,
      bodyText: resolvedText,
      isRead: true,
      hasAttachments: attachments && attachments.length > 0,
      attachments: (attachments || []).map(att => ({
        filename: att.filename,
        contentType: att.contentType || 'application/octet-stream',
        size: att.size || (att.content ? Buffer.byteLength(att.content) : 0),
        url: att.url || '',
      })),
      sentAt: new Date(),
      date: new Date(),
    });

    // Update Lead timeline if linked
    if (matchedLead) {
      if (!Array.isArray(matchedLead.leadActivities)) {
        matchedLead.leadActivities = [];
      }
      matchedLead.leadActivities.push({
        action: 'email_sent',
        performedBy: userId,
        performerName: userName,
        details: `Sent email "${subject || '(No Subject)'}" to ${formattedTo.map(t => t.email).join(', ')}`,
        timestamp: new Date(),
      });
      await matchedLead.save();
    }

    // Increment template usage count if used
    if (templateId) {
      await Template.findByIdAndUpdate(templateId, { $inc: { usageCount: 1 } });
    }

    // Increment account total messages count
    await EmailAccount.findByIdAndUpdate(account._id, {
      $inc: { totalMessagesCount: 1 },
      lastSyncAt: new Date(),
    });

    return savedMessage;
  }

  /**
   * Save or update draft email
   */
  static async saveDraft({
    workspaceId,
    userId,
    accountId,
    draftId = null,
    to = [],
    cc = [],
    bcc = [],
    subject = '',
    bodyHtml = '',
    bodyText = '',
    attachments = [],
    leadId = null,
    inReplyTo = null,
    threadId = null,
  }) {
    if (!accountId) {
      throw new Error('Account ID is required to save draft');
    }

    const account = await EmailAccount.findOne({ _id: accountId, workspaceId });
    if (!account) {
      throw new Error('Email account not found');
    }

    const sanitizedHtml = sanitizeEmailHtml(bodyHtml || '');
    const resolvedText = bodyText || generatePlainText(sanitizedHtml);
    const cleanSnippet = resolvedText.slice(0, 140).trim();
    const resolvedThreadId = threadId || `thread_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    let draft;
    if (draftId) {
      draft = await EmailMessage.findOne({ _id: draftId, workspaceId, folder: 'drafts' });
    }

    const draftData = {
      workspaceId,
      accountId: account._id,
      userId,
      leadId: leadId || null,
      folder: 'drafts',
      status: 'draft',
      threadId: resolvedThreadId,
      inReplyTo,
      from: { name: account.displayName, email: account.email },
      to: Array.isArray(to) ? to : [{ email: to }],
      cc: Array.isArray(cc) ? cc : [],
      bcc: Array.isArray(bcc) ? bcc : [],
      subject: subject || '(Draft)',
      snippet: cleanSnippet,
      bodyHtml: sanitizedHtml,
      bodyText: resolvedText,
      isRead: true,
      hasAttachments: attachments.length > 0,
      attachments,
      date: new Date(),
    };

    if (draft) {
      Object.assign(draft, draftData);
      await draft.save();
    } else {
      draft = await EmailMessage.create(draftData);
    }

    return draft;
  }

  /**
   * Get paginated messages for a mailbox folder
   */
  static async getMessages({
    workspaceId,
    accountId = null,
    folder = 'inbox',
    search = '',
    unreadOnly = false,
    starredOnly = false,
    page = 1,
    limit = 30,
    user = null,
  }) {
    const query = {
      workspaceId,
      folder: folder.toLowerCase(),
    };

    // Scoping check for non-privileged users
    const authorizedAccountIds = await this.getAuthorizedAccountIds(workspaceId, user);
    if (authorizedAccountIds !== null) {
      if (accountId && accountId !== 'all') {
        const isAuth = authorizedAccountIds.some(id => id.toString() === accountId.toString());
        if (!isAuth) {
          return {
            messages: [],
            total: 0,
            page: Number(page),
            limit: Number(limit),
            totalPages: 0,
            unreadInboxCount: 0,
          };
        }
        query.accountId = accountId;
      } else {
        query.accountId = { $in: authorizedAccountIds };
      }
    } else {
      if (accountId && accountId !== 'all') {
        query.accountId = accountId;
      }
    }

    if (unreadOnly) {
      query.isRead = false;
    }

    if (starredOnly) {
      query.isStarred = true;
    }

    if (search && search.trim()) {
      const term = search.trim();
      query.$or = [
        { subject: { $regex: term, $options: 'i' } },
        { snippet: { $regex: term, $options: 'i' } },
        { 'from.name': { $regex: term, $options: 'i' } },
        { 'from.email': { $regex: term, $options: 'i' } },
        { 'to.email': { $regex: term, $options: 'i' } },
      ];
    }

    const skip = (Math.max(1, page) - 1) * Math.min(100, limit);
    const [messages, total] = await Promise.all([
      EmailMessage.find(query)
        .sort({ date: -1 })
        .skip(skip)
        .limit(Math.min(100, limit))
        .populate('leadId', 'name phone email status targetCourse')
        .populate('accountId', 'email displayName provider')
        .lean(),
      EmailMessage.countDocuments(query),
    ]);

    // Calculate unread counts for folder badges
    const unreadInboxCount = await EmailMessage.countDocuments({
      workspaceId,
      folder: 'inbox',
      isRead: false,
      ...(query.accountId ? { accountId: query.accountId } : {}),
    });

    return {
      messages,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit) || 1,
      unreadInboxCount,
    };
  }

  /**
   * Get full conversation thread by threadId
   */
  static async getThreadMessages(workspaceId, threadId, user = null) {
    if (!threadId) throw new Error('threadId is required');

    const authorizedAccountIds = await this.getAuthorizedAccountIds(workspaceId, user);
    const query = { workspaceId, threadId };
    if (authorizedAccountIds !== null) {
      query.accountId = { $in: authorizedAccountIds };
    }

    const messages = await EmailMessage.find(query)
      .sort({ date: 1 })
      .populate('leadId', 'name phone email status targetCourse')
      .populate('accountId', 'email displayName provider')
      .lean();

    return messages;
  }

  /**
   * Mark message read / unread
   */
  static async markMessageRead(workspaceId, messageId, isRead = true, user = null) {
    const authorizedAccountIds = await this.getAuthorizedAccountIds(workspaceId, user);
    const filter = { _id: messageId, workspaceId };
    if (authorizedAccountIds !== null) filter.accountId = { $in: authorizedAccountIds };

    const msg = await EmailMessage.findOneAndUpdate(
      filter,
      { isRead: Boolean(isRead) },
      { new: true }
    );
    return msg;
  }

  /**
   * Mark message starred
   */
  static async markMessageStarred(workspaceId, messageId, isStarred = true, user = null) {
    const authorizedAccountIds = await this.getAuthorizedAccountIds(workspaceId, user);
    const filter = { _id: messageId, workspaceId };
    if (authorizedAccountIds !== null) filter.accountId = { $in: authorizedAccountIds };

    const msg = await EmailMessage.findOneAndUpdate(
      filter,
      { isStarred: Boolean(isStarred) },
      { new: true }
    );
    return msg;
  }

  /**
   * Move message to folder (trash, archive, inbox, etc.)
   */
  static async moveMessageFolder(workspaceId, messageId, targetFolder, user = null) {
    const validFolders = ['inbox', 'sent', 'drafts', 'scheduled', 'trash', 'archive'];
    if (!validFolders.includes(targetFolder)) {
      throw new Error(`Invalid target folder: ${targetFolder}`);
    }

    const authorizedAccountIds = await this.getAuthorizedAccountIds(workspaceId, user);
    const filter = { _id: messageId, workspaceId };
    if (authorizedAccountIds !== null) filter.accountId = { $in: authorizedAccountIds };

    const msg = await EmailMessage.findOneAndUpdate(
      filter,
      { folder: targetFolder },
      { new: true }
    );
    return msg;
  }

  /**
   * Permanently delete message or move to trash
   */
  static async deleteMessage(workspaceId, messageId, permanent = false, user = null) {
    const authorizedAccountIds = await this.getAuthorizedAccountIds(workspaceId, user);
    const filter = { _id: messageId, workspaceId };
    if (authorizedAccountIds !== null) filter.accountId = { $in: authorizedAccountIds };

    if (permanent) {
      await EmailMessage.deleteOne(filter);
      return { success: true, permanent: true };
    }
    const msg = await EmailMessage.findOneAndUpdate(
      filter,
      { folder: 'trash' },
      { new: true }
    );
    return { success: true, message: msg };
  }

  /**
   * Get all emails associated with a CRM lead
   */
  static async getLeadEmailHistory(workspaceId, leadId, user = null) {
    const lead = await Lead.findOne({ _id: leadId, workspaceId });
    if (!lead) {
      throw new Error('Lead not found');
    }

    if (user) {
      const isPrivileged = user.role === 'owner' || user.role === 'admin' || user.companyRole === 'owner' || user.workspaceRole === 'owner' || user.workspaceRole === 'manager';
      if (!isPrivileged) {
        const isAssigned = (lead.assignedTo && lead.assignedTo.toString() === user._id.toString()) ||
          (lead.userId && lead.userId.toString() === user._id.toString()) ||
          (lead.currentOwnerId && lead.currentOwnerId.toString() === user._id.toString());
        if (!isAssigned) {
          throw new Error('Not authorized to access emails for this lead');
        }
      }
    }

    const conditions = [{ leadId: lead._id }];
    if (lead.email) {
      conditions.push({ 'to.email': lead.email.toLowerCase() });
      conditions.push({ 'from.email': lead.email.toLowerCase() });
    }

    const emails = await EmailMessage.find({
      workspaceId,
      $or: conditions,
    })
      .sort({ date: -1 })
      .populate('accountId', 'email displayName provider')
      .lean();

    return emails;
  }

  /**
   * Generate 1-Click Google OAuth 2.0 authorization URL
   */
  static getGoogleAuthUrl(workspaceId, userId) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new Error('Google OAuth is not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to backend/.env');
    }

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    const redirectUri = process.env.GOOGLE_EMAIL_REDIRECT_URI || `${backendUrl}/api/email/oauth/google/callback`;

    const statePayload = {
      workspaceId: workspaceId.toString(),
      userId: userId.toString(),
      nonce: crypto.randomBytes(8).toString('hex'),
      timestamp: Date.now(),
    };
    const secret = process.env.JWT_SECRET || 'crm_email_oauth_secret';
    const sig = crypto.createHmac('sha256', secret).update(JSON.stringify(statePayload)).digest('hex');
    const state = Buffer.from(JSON.stringify({ ...statePayload, sig })).toString('base64url');

    const scopes = [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
    ];

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Handle Google OAuth 2.0 redirect callback & exchange code for tokens
   */
  static async handleGoogleOAuthCallback(code, state) {
    if (!code) {
      throw new Error('Authorization code missing from Google callback');
    }

    let parsedState;
    try {
      parsedState = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
    } catch {
      throw new Error('Invalid or corrupted OAuth state parameter');
    }

    const { workspaceId, userId, nonce, timestamp, sig } = parsedState;
    if (!workspaceId || !userId || !sig || !timestamp) {
      throw new Error('OAuth state is missing required security parameters');
    }

    const secret = process.env.JWT_SECRET || 'crm_email_oauth_secret';
    const expectedSig = crypto.createHmac('sha256', secret).update(JSON.stringify({
      workspaceId,
      userId,
      nonce,
      timestamp,
    })).digest('hex');

    if (sig !== expectedSig) {
      throw new Error('OAuth state signature verification failed');
    }

    if (Date.now() - timestamp > 15 * 60 * 1000) {
      throw new Error('OAuth state has expired. Please restart the authorization process.');
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth credentials not configured on server (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)');
    }

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    const redirectUri = process.env.GOOGLE_EMAIL_REDIRECT_URI || `${backendUrl}/api/email/oauth/google/callback`;

    const axios = require('axios');
    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    });

    const { access_token, refresh_token, expires_in, scope } = tokenRes.data;

    // Fetch user profile from Google
    const profileRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const { email, name } = profileRes.data;
    if (!email) {
      throw new Error('Failed to retrieve email address from Google profile');
    }

    const account = await this.connectAccount({
      workspaceId,
      userId,
      provider: 'gmail',
      email,
      displayName: name || email.split('@')[0],
      isShared: false,
      credentials: {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresIn: expires_in || 3600,
        scope,
      },
    });

    return { account, email };
  }
}

module.exports = EmailService;
