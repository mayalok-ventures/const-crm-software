const axios = require('axios');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

/**
 * Normalizes email HTML into a bulletproof, high-deliverability responsive template.
 * If input is plain text or mixed markdown (contains newlines/asterisks), it converts
 * paragraphs, linebreaks, bolding, and lists into clean HTML.
 * Wraps everything in a responsive 640px card container with system typography.
 */
function formatEmailHtml(content) {
  if (!content || typeof content !== 'string') {
    return `<!DOCTYPE html><html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; line-height: 1.6; color: #1e293b;"><p></p></body></html>`;
  }

  const trimmed = content.trim();

  // If already a full HTML document, preserve it
  if (/<html\b[^>]*>/i.test(trimmed) || /<!doctype\s+html/i.test(trimmed)) {
    return trimmed;
  }

  let formattedBody = trimmed;

  // Check if content contains standard HTML block tags
  const hasHtmlBlocks = /<(p|div|table|h[1-6]|ul|ol|li|blockquote|hr|section|article)\b[^>]*>/i.test(trimmed);

  if (!hasHtmlBlocks) {
    // It's plain text or counselor-typed text with newlines and markdown-style formatting
    // 1. Convert markdown bold **text** or *text* and italics
    let converted = formattedBody
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^\*])\*([^*]+)\*(?!\*)/g, '$1<strong>$2</strong>')
      .replace(/_([^_]+)_/g, '<em>$1</em>');

    // 2. Split by paragraphs (double newlines)
    const blocks = converted.split(/(?:\r?\n){2,}/);
    const htmlBlocks = [];

    for (const block of blocks) {
      const trimmedBlock = block.trim();
      if (!trimmedBlock) continue;

      const lines = trimmedBlock.split(/\r?\n/);
      const hasListLines = lines.some(l => /^\s*[-*•]\s+/.test(l));

      if (hasListLines) {
        let blockHtml = '';
        let inList = false;

        for (const line of lines) {
          const listMatch = line.match(/^\s*[-*•]\s+(.*)$/);
          if (listMatch) {
            if (!inList) {
              blockHtml += '<ul style="margin: 0 0 16px 20px; padding: 0; color: #1e293b;">';
              inList = true;
            }
            blockHtml += `<li style="margin-bottom: 6px; line-height: 1.6;">${listMatch[1]}</li>`;
          } else {
            if (inList) {
              blockHtml += '</ul>';
              inList = false;
            }
            const trimmedLine = line.trim();
            if (trimmedLine) {
              blockHtml += `<p style="margin: 0 0 8px 0; font-size: 15px; line-height: 1.6; color: #1e293b;">${trimmedLine}</p>`;
            }
          }
        }
        if (inList) blockHtml += '</ul>';
        htmlBlocks.push(blockHtml);
      } else {
        const withBr = trimmedBlock.replace(/\r?\n/g, '<br/>');
        htmlBlocks.push(`<p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #1e293b;">${withBr}</p>`);
      }
    }

    formattedBody = htmlBlocks.join('\n');
  } else {
    // Ensure all <p> tags without styles have default comfortable line-height and margin
    formattedBody = formattedBody.replace(/<p(?![^>]*style=)/gi, '<p style="margin: 0 0 16px 0; line-height: 1.6;"');
  }

  // Wrap in executive responsive container
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; -webkit-font-smoothing: antialiased; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    p { margin: 0 0 16px 0; }
    h1, h2, h3, h4 { color: #0f172a; margin-top: 0; }
    a { color: #4f46e5; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; border-radius: 0 !important; }
      .email-cell { padding: 20px 16px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 24px 8px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; font-size: 15px; line-height: 1.6;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; width: 100%;">
    <tr>
      <td align="center" style="padding: 0;">
        <!--[if (gte mso 9)|(IE)]>
        <table role="presentation" align="center" border="0" cellspacing="0" cellpadding="0" width="620">
        <tr>
        <td align="center" valign="top" width="620">
        <![endif]-->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-container" style="max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          <tr>
            <td class="email-cell" style="padding: 32px 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #1e293b;">
              ${formattedBody}
            </td>
          </tr>
        </table>
        <!--[if (gte mso 9)|(IE)]>
        </td>
        </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Generates a clean plain text fallback from HTML
 */
function generatePlainText(html) {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Helper to build RFC 2822 / RFC 2046 MIME Message string for Gmail API
 */
function buildMimeMessage({ from, to, cc, bcc, subject, bodyHtml, bodyText, inReplyTo, references, attachments = [] }) {
  const mixedBoundary = `----=_Part_Mixed_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const altBoundary = `----=_Part_Alt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@sahyakcrm.com>`;
  
  const resolvedHtml = formatEmailHtml(bodyHtml || bodyText || '');
  const resolvedText = bodyText || generatePlainText(resolvedHtml);

  const headers = [
    `From: ${from.name ? `"${from.name}" <${from.email}>` : from.email}`,
    `To: ${to.map(r => (r.name ? `"${r.name}" <${r.email}>` : r.email)).join(', ')}`,
  ];

  if (cc && cc.length > 0) {
    headers.push(`Cc: ${cc.map(r => (r.name ? `"${r.name}" <${r.email}>` : r.email)).join(', ')}`);
  }
  if (bcc && bcc.length > 0) {
    headers.push(`Bcc: ${bcc.map(r => (r.name ? `"${r.name}" <${r.email}>` : r.email)).join(', ')}`);
  }

  headers.push(`Subject: =?UTF-8?B?${Buffer.from(subject || '').toString('base64')}?=`);
  headers.push(`Message-ID: ${messageId}`);
  headers.push(`Date: ${new Date().toUTCString()}`);
  headers.push('MIME-Version: 1.0');

  if (inReplyTo) {
    headers.push(`In-Reply-To: ${inReplyTo}`);
  }
  if (references && references.length > 0) {
    headers.push(`References: ${Array.isArray(references) ? references.join(' ') : references}`);
  }

  const hasAttachments = attachments && attachments.length > 0;

  if (hasAttachments) {
    headers.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);
    let mime = headers.join('\r\n') + '\r\n\r\n';

    // Body Alternative Container
    mime += `--${mixedBoundary}\r\n`;
    mime += `Content-Type: multipart/alternative; boundary="${altBoundary}"\r\n\r\n`;

    // 1. Text part
    mime += `--${altBoundary}\r\n`;
    mime += 'Content-Type: text/plain; charset="UTF-8"\r\n';
    mime += 'Content-Transfer-Encoding: base64\r\n\r\n';
    mime += Buffer.from(resolvedText).toString('base64') + '\r\n\r\n';

    // 2. HTML part
    mime += `--${altBoundary}\r\n`;
    mime += 'Content-Type: text/html; charset="UTF-8"\r\n';
    mime += 'Content-Transfer-Encoding: base64\r\n\r\n';
    mime += Buffer.from(resolvedHtml).toString('base64') + '\r\n\r\n';

    mime += `--${altBoundary}--\r\n\r\n`;

    // 3. Attachments
    for (const att of attachments) {
      mime += `--${mixedBoundary}\r\n`;
      mime += `Content-Type: ${att.contentType || 'application/octet-stream'}; name="${att.filename}"\r\n`;
      mime += 'Content-Transfer-Encoding: base64\r\n';
      mime += `Content-Disposition: attachment; filename="${att.filename}"\r\n\r\n`;
      if (att.content) {
        mime += (Buffer.isBuffer(att.content) ? att.content.toString('base64') : Buffer.from(att.content).toString('base64')) + '\r\n\r\n';
      }
    }

    mime += `--${mixedBoundary}--\r\n`;
    return { rawMessage: mime, messageId };
  } else {
    // No attachments - direct multipart/alternative structure
    headers.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
    let mime = headers.join('\r\n') + '\r\n\r\n';

    // 1. Text part
    mime += `--${altBoundary}\r\n`;
    mime += 'Content-Type: text/plain; charset="UTF-8"\r\n';
    mime += 'Content-Transfer-Encoding: base64\r\n\r\n';
    mime += Buffer.from(resolvedText).toString('base64') + '\r\n\r\n';

    // 2. HTML part
    mime += `--${altBoundary}\r\n`;
    mime += 'Content-Type: text/html; charset="UTF-8"\r\n';
    mime += 'Content-Transfer-Encoding: base64\r\n\r\n';
    mime += Buffer.from(resolvedHtml).toString('base64') + '\r\n\r\n';

    mime += `--${altBoundary}--\r\n`;
    return { rawMessage: mime, messageId };
  }
}

/**
 * Base64url encoder
 */
function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ─────────────────────────────────────────────────────────────
// 1. GMAIL ADAPTER
// ─────────────────────────────────────────────────────────────
class GmailAdapter {
  static async refreshAccessToken(account) {
    const refreshToken = account.getDecryptedRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available for Gmail account. Please reconnect your Gmail account in Settings with consent prompt.');
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth credentials not configured on server (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)');
    }

    try {
      const res = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      });

      const { access_token, expires_in } = res.data;
      account.setTokens({ accessToken: access_token, expiresIn: expires_in });
      await account.save();
      return access_token;
    } catch (err) {
      const googleError = err.response?.data?.error || err.message;
      if (googleError === 'invalid_grant') {
        account.status = 'error';
        account.lastError = 'Google refresh token has expired or was revoked. Please reconnect your Gmail account.';
        await account.save().catch(() => {});
        throw new Error('Google refresh token has expired or was revoked (invalid_grant). Please reconnect your Gmail account in Settings.');
      }
      throw err;
    }
  }

  static async getValidToken(account) {
    if (account.tokenExpiresAt && new Date(account.tokenExpiresAt) > new Date(Date.now() + 60000)) {
      const token = account.getDecryptedAccessToken();
      if (token) return token;
    }
    return await this.refreshAccessToken(account);
  }

  static async testConnection(account) {
    const token = await this.getValidToken(account);
    const res = await axios.get('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return {
      connected: true,
      email: res.data.emailAddress,
      messagesTotal: res.data.messagesTotal,
      threadsTotal: res.data.threadsTotal,
    };
  }

  static async sendEmail(account, options) {
    const token = await this.getValidToken(account);
    const { rawMessage, messageId } = buildMimeMessage({
      from: { name: account.displayName || '', email: account.email },
      to: options.to,
      cc: options.cc,
      bcc: options.bcc,
      subject: options.subject,
      bodyHtml: options.bodyHtml,
      bodyText: options.bodyText,
      inReplyTo: options.inReplyTo,
      references: options.references,
      attachments: options.attachments,
    });

    const payload = {
      raw: base64UrlEncode(rawMessage),
    };

    // In Gmail API, threadId must ONLY be attached if it is an authentic Gmail hex thread ID.
    // Attaching a synthetic CRM thread identifier (e.g. thread_1793...) causes Google to reject with 400 INVALID_ARGUMENT.
    const isAuthenticGmailThread = options.threadId &&
      typeof options.threadId === 'string' &&
      /^[0-9a-fA-F]{16,}$/.test(options.threadId) &&
      !options.threadId.startsWith('thread_') &&
      !options.threadId.startsWith('msg_');

    if (isAuthenticGmailThread) {
      payload.threadId = options.threadId;
    }

    const res = await axios.post(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      messageId,
      providerMessageId: res.data.id,
      threadId: res.data.threadId || options.threadId || res.data.id,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// 2. MICROSOFT GRAPH ADAPTER
// ─────────────────────────────────────────────────────────────
class OutlookAdapter {
  static async refreshAccessToken(account) {
    const refreshToken = account.getDecryptedRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available for Microsoft account');
    }

    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    const tenant = process.env.MICROSOFT_TENANT_ID || 'common';

    if (!clientId || !clientSecret) {
      throw new Error('Microsoft OAuth credentials not configured on server (MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET)');
    }

    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('refresh_token', refreshToken);
    params.append('grant_type', 'refresh_token');

    const res = await axios.post(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, params);
    const { access_token, expires_in } = res.data;
    account.setTokens({ accessToken: access_token, expiresIn: expires_in });
    await account.save();
    return access_token;
  }

  static async getValidToken(account) {
    if (account.tokenExpiresAt && new Date(account.tokenExpiresAt) > new Date(Date.now() + 60000)) {
      const token = account.getDecryptedAccessToken();
      if (token) return token;
    }
    return await this.refreshAccessToken(account);
  }

  static async testConnection(account) {
    const token = await this.getValidToken(account);
    const res = await axios.get('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return {
      connected: true,
      email: res.data.mail || res.data.userPrincipalName,
      displayName: res.data.displayName,
    };
  }

  static async sendEmail(account, options) {
    const token = await this.getValidToken(account);
    const resolvedHtml = formatEmailHtml(options.bodyHtml || options.bodyText || '');

    const message = {
      subject: options.subject || '',
      body: {
        contentType: 'HTML',
        content: resolvedHtml,
      },
      toRecipients: options.to.map(r => ({
        emailAddress: { address: r.email, name: r.name || '' },
      })),
      ccRecipients: (options.cc || []).map(r => ({
        emailAddress: { address: r.email, name: r.name || '' },
      })),
      bccRecipients: (options.bcc || []).map(r => ({
        emailAddress: { address: r.email, name: r.name || '' },
      })),
    };

    if (options.attachments && options.attachments.length > 0) {
      message.attachments = options.attachments.map(att => ({
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: att.filename,
        contentType: att.contentType || 'application/octet-stream',
        contentBytes: att.content ? Buffer.from(att.content).toString('base64') : '',
      }));
    }

    const res = await axios.post(
      'https://graph.microsoft.com/v1.0/me/sendMail',
      { message, saveToSentItems: true },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const generatedId = `<${Date.now()}@graph.microsoft.com>`;
    return {
      messageId: generatedId,
      providerMessageId: generatedId,
      threadId: options.threadId || generatedId,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// 3. SMTP / IMAP ADAPTER
// ─────────────────────────────────────────────────────────────
class SmtpAdapter {
  static createTransporter(account) {
    const password = account.getDecryptedSmtpPassword();
    return nodemailer.createTransport({
      host: account.smtpHost,
      port: account.smtpPort || 587,
      secure: Boolean(account.smtpSecure),
      auth: {
        user: account.smtpUser || account.email,
        pass: password,
      },
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production',
      },
    });
  }

  static async testConnection(account) {
    const transporter = this.createTransporter(account);
    const verified = await transporter.verify();
    return {
      connected: verified,
      host: account.smtpHost,
      email: account.email,
    };
  }

  static async sendEmail(account, options) {
    const transporter = this.createTransporter(account);
    const resolvedHtml = formatEmailHtml(options.bodyHtml || options.bodyText || '');
    const resolvedText = options.bodyText || generatePlainText(resolvedHtml);

    const fromAddress = account.displayName
      ? `"${account.displayName}" <${account.email}>`
      : account.email;

    const mailOptions = {
      from: fromAddress,
      to: options.to.map(r => (r.name ? `"${r.name}" <${r.email}>` : r.email)).join(', '),
      subject: options.subject,
      text: resolvedText,
      html: resolvedHtml,
    };

    if (options.cc && options.cc.length > 0) {
      mailOptions.cc = options.cc.map(r => (r.name ? `"${r.name}" <${r.email}>` : r.email)).join(', ');
    }
    if (options.bcc && options.bcc.length > 0) {
      mailOptions.bcc = options.bcc.map(r => (r.name ? `"${r.name}" <${r.email}>` : r.email)).join(', ');
    }

    if (options.inReplyTo) {
      mailOptions.inReplyTo = options.inReplyTo;
    }
    if (options.references) {
      mailOptions.references = options.references;
    }

    if (options.attachments && options.attachments.length > 0) {
      mailOptions.attachments = options.attachments.map(att => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType,
        path: att.url && !att.content ? att.url : undefined,
      }));
    }

    const info = await transporter.sendMail(mailOptions);
    const generatedThreadId = options.threadId || options.inReplyTo || info.messageId;

    return {
      messageId: info.messageId,
      providerMessageId: info.messageId,
      threadId: generatedThreadId,
    };
  }
}

/**
 * Adapter Registry Factory
 */
function getProviderAdapter(provider) {
  switch (provider?.toLowerCase()) {
    case 'gmail':
      return GmailAdapter;
    case 'outlook':
      return OutlookAdapter;
    case 'smtp':
      return SmtpAdapter;
    default:
      throw new Error(`Unsupported email provider: ${provider}`);
  }
}

module.exports = {
  formatEmailHtml,
  generatePlainText,
  buildMimeMessage,
  GmailAdapter,
  OutlookAdapter,
  SmtpAdapter,
  getProviderAdapter,
};
