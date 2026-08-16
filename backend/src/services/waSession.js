const makeWASocket = require('@whiskeysockets/baileys').default;
const {
  DisconnectReason,
  Browsers,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const path = require('path');
const fs = require('fs');
const WhatsAppAuth = require('../models/WhatsAppAuth');
const User = require('../models/User');
const { useMongoDBAuthState } = require('./mongoAuthState');

// In-memory sockets store
const sessions = {};
// Store connection status, pending pairing codes, and QR codes
const sessionStates = {};
// Track reconnect attempts to prevent infinite loops
const reconnectAttempts = {};
// Track pairing-specific reconnect attempts (separate counter from general reconnects)
const pairingReconnectAttempts = {};
// Track which users are actively in the pairing window (waiting for user to enter code)
const pairingInProgress = {};
// Global per-user lock to prevent duplicate concurrent requestPairingCode() calls
const pairingCodeLocks = {};
// In-memory object for user cooldowns keyed by userId
const userCooldowns = {};
// Debounce cache for inbound WhatsApp message notifications (key: `${userId}_${leadId}`, val: timestamp)
const leadNotificationThrottle = new Map();
// Last active timestamp for tracking
const lastActivityTimestamps = new Map();

// Maximum reconnect attempts during the pairing window before giving up
const MAX_PAIRING_RECONNECTS = 5;

// Cache the fetched WA version so we don't fetch it on every connection
let cachedWAVersion = null;
let versionFetchedAt = 0;
const VERSION_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

const FALLBACK_WA_VERSION = [2, 3000, 1043857760];

const getWAVersion = async (forceRefresh = false) => {
  const now = Date.now();
  if (!forceRefresh && cachedWAVersion && (now - versionFetchedAt) < VERSION_CACHE_TTL_MS) {
    return cachedWAVersion;
  }
  try {
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`[WA] Fetched WA version: ${version.join('.')} (isLatest: ${isLatest})`);
    cachedWAVersion = version;
    versionFetchedAt = now;
    return version;
  } catch (err) {
    console.warn(`[WA] Failed to fetch latest WA version (${err.message}). Using fallback: ${FALLBACK_WA_VERSION.join('.')}`);
    cachedWAVersion = FALLBACK_WA_VERSION;
    versionFetchedAt = now;
    return FALLBACK_WA_VERSION;
  }
};

const updateActivity = (userId) => {
  if (userId) lastActivityTimestamps.set(userId.toString(), Date.now());
};

const normalizePhoneAndJid = (phone, defaultCountryCode = '91') => {
  let clean = String(phone).replace(/\D/g, '');
  const prefix = String(defaultCountryCode).replace(/\D/g, '') || '91';
  if (clean.length === 10) {
    clean = prefix + clean;
  }
  return {
    cleanPhone: clean,
    jid: `${clean}@s.whatsapp.net`,
  };
};

const resolveMediaSource = (mediaPath) => {
  if (!mediaPath) return null;
  const safePath = Array.isArray(mediaPath) ? mediaPath[0] : (typeof mediaPath === 'object' ? (mediaPath.url || mediaPath.image || mediaPath.video || mediaPath.document || '') : mediaPath);
  if (!safePath || typeof safePath !== 'string') return null;

  if (safePath.startsWith('http://') || safePath.startsWith('https://')) {
    return { url: safePath };
  }

  // Local file
  let localPath = safePath;
  if (localPath.startsWith('/uploads/')) {
    localPath = path.join(__dirname, '../../', localPath.replace(/^\//, ''));
  } else if (!path.isAbsolute(localPath)) {
    localPath = path.join(__dirname, '../../uploads/templates', localPath);
  }

  if (fs.existsSync(localPath)) {
    return fs.readFileSync(localPath); // Buffer for Baileys
  }
  return { url: safePath };
};

const recordOutboundMessage = async (userId, to, text, mediaUrl = null, mediaType = null) => {
  try {
    const mongoose = require('mongoose');
    const Lead = mongoose.model('Lead');
    const ChatMessage = mongoose.model('ChatMessage');

    const clean = String(to).replace(/\D/g, '');
    const tenDigit = clean.slice(-10);
    const lead = await Lead.findOne({
      userId,
      phone: { $in: [clean, tenDigit] },
    });

    await ChatMessage.create({
      userId,
      leadId: lead ? lead._id : null,
      phone: clean,
      senderName: 'You',
      direction: 'outbound',
      text: text || '',
      mediaUrl: mediaUrl || null,
      mediaType: mediaType || null,
      status: 'sent',
      timestamp: new Date(),
    });

    if (lead) {
      lead.lastContactedAt = new Date();
      await lead.save();
    }
  } catch (e) {
    console.warn('[WA] Could not record outbound chat message:', e.message);
  }
};

const buildSocketOptions = async (state) => {
  const version = await getWAVersion();
  return {
    version,
    auth: state,
    printQRInTerminal: false,
    logger: {
      level: 'silent',
      child: () => ({
        level: 'silent',
        trace: () => {},
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        fatal: () => {},
      }),
      trace: () => {},
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
      fatal: () => {},
    },
    // Standard pairing-compatible browser identifier for WhatsApp Mobile
    browser: Browsers.ubuntu('Chrome'),
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 25000,
    defaultQueryTimeoutMs: 60000,
    retryRequestDelayMs: 2000,
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
    linkPreviewImageThumbnailWidth: 192,
    markOnlineOnConnect: false,
  };
};

const setupSocketListeners = (sock, userId, cleanPhone, saveCreds) => {
  sock.ev.on('creds.update', saveCreds);

  // Inbound messages & chat synchronization
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    updateActivity(userId);
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (msg.key.fromMe) continue;
      const remoteJid = msg.key.remoteJid;
      if (!remoteJid || remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast') continue;

      const senderPhone = remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g, '');
      const text = msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        msg.message?.videoMessage?.caption ||
        msg.message?.documentMessage?.caption ||
        '';

      let mediaType = null;
      let mediaUrl = null;

      if (msg.message?.imageMessage) {
        mediaType = 'image';
        mediaUrl = msg.message.imageMessage.url || null;
      } else if (msg.message?.videoMessage) {
        mediaType = 'video';
        mediaUrl = msg.message.videoMessage.url || null;
      } else if (msg.message?.documentMessage) {
        mediaType = 'document';
        mediaUrl = msg.message.documentMessage.url || null;
      } else if (msg.message?.audioMessage) {
        mediaType = 'audio';
      }

      try {
        const mongoose = require('mongoose');
        const Lead = mongoose.model('Lead');
        const ChatMessage = mongoose.model('ChatMessage');
        const Notification = mongoose.model('Notification');
        const { broadcastNotification, broadcastChatMessage } = require('../utils/realtime');

        const tenDigit = senderPhone.slice(-10);
        const user = await User.findById(userId).select('companyId workStatus companyRole localization').lean();
        const countryCode = user?.localization?.countryPhoneCode || '91';
        const phoneVariants = [senderPhone, tenDigit, countryCode + tenDigit];

        const isOwner = user?.workStatus === 'company_owner' || user?.companyRole === 'owner';
        const companyId = isOwner ? userId : user?.companyId;

        const leadQuery = {
          phone: { $in: phoneVariants },
          $or: [
            { userId },
            ...(companyId ? [{ companyId }, { userId: companyId }] : [])
          ]
        };

        const lead = await Lead.findOne(leadQuery);
        if (!lead) return;

        const chatMsg = await ChatMessage.create({
          userId,
          leadId: lead._id,
          phone: senderPhone,
          senderName: lead.name || senderPhone,
          direction: 'inbound',
          text: text || (mediaType ? `[${mediaType.toUpperCase()}]` : ''),
          mediaUrl,
          mediaType,
          status: 'received',
          waMessageId: msg.key.id || null,
          timestamp: new Date(Number(msg.messageTimestamp) * 1000 || Date.now())
        });

        broadcastChatMessage(userId, {
          message: chatMsg,
          phone: senderPhone,
          leadId: lead._id
        });

        const throttleKey = `${userId}_${lead._id}`;
        const lastNotified = leadNotificationThrottle.get(throttleKey) || 0;
        const now = Date.now();
        const THREE_MINUTES = 3 * 60 * 1000;

        if (now - lastNotified > THREE_MINUTES) {
          leadNotificationThrottle.set(throttleKey, now);

          const notifTitle = `💬 New reply from ${lead.name}`;
          const notifMessage = text ? (text.length > 80 ? text.substring(0, 80) + '...' : text) : `Sent an attachment [${mediaType}]`;

          const sendNotif = async (recipientId) => {
            const notif = await Notification.create({
              userId: recipientId,
              type: 'wa_reply',
              title: notifTitle,
              message: notifMessage,
              leadId: lead._id,
              leadName: lead.name,
              isRead: false
            });
            broadcastNotification(recipientId, {
              type: 'wa_reply',
              notification: notif,
              lead: { _id: lead._id, name: lead.name, phone: lead.phone }
            });
          };

          if (lead.assignedTo) {
            await sendNotif(lead.assignedTo);
            if (String(lead.assignedTo) !== String(userId)) {
              await sendNotif(userId);
            }
          } else {
            await sendNotif(userId);
            const poolAgents = await User.find({ companyId: userId }).select('_id').lean();
            for (const ag of poolAgents) {
              await sendNotif(ag._id);
            }
          }
        }
      } catch (e) {
        console.error('[WA] Failed to process inbound message:', e.message);
      }
    }
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && sessionStates[userId]) {
      sessionStates[userId] = { ...sessionStates[userId], qrCode: qr };
      console.log(`[WA] QR code updated for user ${userId}`);
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;
      const shouldReconnect = !isLoggedOut;
      console.log(`[WA] Connection closed for user ${userId}. Status: ${statusCode}. Should Reconnect? ${shouldReconnect}`);

      // Case 1: Explicit remote logout from phone
      if (isLoggedOut) {
        console.log(`[WA] Remote logout detected for user ${userId}. Purging session credentials.`);
        await disconnect(userId, true, false);
        return;
      }

      // Case 2: In pairing window
      if (pairingInProgress[userId]) {
        const pairingAttempt = (pairingReconnectAttempts[userId] || 0) + 1;
        pairingReconnectAttempts[userId] = pairingAttempt;

        if (pairingAttempt > MAX_PAIRING_RECONNECTS) {
          console.error(`[WA] Pairing attempts exceeded for user ${userId}. Resetting.`);
          pairingInProgress[userId] = false;
          delete pairingReconnectAttempts[userId];
          delete pairingCodeLocks[userId];
          sessionStates[userId] = { status: 'disconnected', phone: null, pairingCode: null, qrCode: null };
          return;
        }

        const delayMs = 2000 * pairingAttempt;
        setTimeout(() => {
          if (!pairingInProgress[userId]) return;
          restoreSession(userId, cleanPhone).catch(e => {
            console.error(`[WA] Pairing reconnect failed for ${userId}:`, e.message);
          });
        }, delayMs);
        return;
      }

      // Case 3: Standard connection dropped (network blip, server restart, keepalive drop)
      // Keep reconnecting indefinitely with capped backoff (never abandon an authenticated user)
      if (shouldReconnect) {
        const attempts = (reconnectAttempts[userId] || 0) + 1;
        reconnectAttempts[userId] = attempts;
        const delayMs = Math.min(3000 * Math.pow(1.4, Math.min(attempts, 8)), 30000); // 3s to max 30s
        console.log(`[WA] Scheduling auto-reconnect attempt #${attempts} in ${Math.round(delayMs / 1000)}s for user ${userId}...`);

        setTimeout(() => {
          if (!pairingInProgress[userId] && (!sessions[userId] || getStatus(userId).status !== 'connected')) {
            restoreSession(userId, cleanPhone).catch(err => {
              console.error(`[WA] Auto-reconnect failed for ${userId}:`, err.message);
            });
          }
        }, delayMs);
      }
    } else if (connection === 'open') {
      console.log(`[WA] ✅ Connection opened successfully for user ${userId} (${cleanPhone})`);
      sessionStates[userId] = { status: 'connected', phone: cleanPhone, pairingCode: null, qrCode: null };
      pairingInProgress[userId] = false;
      delete pairingReconnectAttempts[userId];
      delete pairingCodeLocks[userId];
      reconnectAttempts[userId] = 0;
      updateActivity(userId);
    }
  });
};

const restoreSession = async (userId, cleanPhone) => {
  if (sessions[userId]) {
    const old = sessions[userId];
    try { old.end(); } catch (e) {}
    delete sessions[userId];
  }

  const existingState = sessionStates[userId] || {};
  sessionStates[userId] = {
    status: 'connecting',
    phone: cleanPhone,
    pairingCode: existingState.pairingCode || null,
    qrCode: existingState.qrCode || null,
  };

  const { state, saveCreds } = await useMongoDBAuthState(WhatsAppAuth, userId);
  const socketOptions = await buildSocketOptions(state);

  const sock = makeWASocket(socketOptions);
  sessions[userId] = sock;
  updateActivity(userId);
  setupSocketListeners(sock, userId, cleanPhone, saveCreds);
};

const connect = async (userId, phoneNumber) => {
  const user = await User.findById(userId).select('phone localization').lean();
  const countryCode = user?.localization?.countryPhoneCode || '91';

  // ── STRICT E.164 PHONE NORMALIZATION ───────────────────────────────────────
  let cleanPhone = String(phoneNumber)
    .replace(/[\s\-().+]/g, '')  // Remove spaces, dashes, parens, plus
    .replace(/[^0-9]/g, '')      // Remove non-numeric
    .replace(/^0+/, '');         // Strip leading zeros

  // Prefix country code for 10-digit local numbers
  if (cleanPhone.length === 10) {
    cleanPhone = countryCode + cleanPhone;
  }

  // Validate ITU E.164 (7-15 digits)
  if (!cleanPhone || cleanPhone.length < 7 || cleanPhone.length > 15) {
    throw new Error(`Invalid phone number "${phoneNumber}". Please provide your full mobile number with country code (e.g. 919876543210).`);
  }

  // ── ANTI-FRAUD: 90-DAY WHATSAPP NUMBER COOLDOWN CHECK ────────────────────
  const WAFingerprint = require('../models/WAFingerprint');
  const bannedFingerprint = await WAFingerprint.findOne({
    phone: cleanPhone,
    cooldownUntil: { $gt: new Date() },
    unbannedAt: null,
  });

  if (bannedFingerprint) {
    const unbanDate = new Date(bannedFingerprint.cooldownUntil).toLocaleDateString();
    throw new Error(`Anti-Fraud Security Lock: WhatsApp number +${cleanPhone} is under a 90-day cooldown until ${unbanDate} due to ${bannedFingerprint.reason}.`);
  }

  // Guard: prevent concurrent pairing code requests for the same user
  if (pairingCodeLocks[userId]) {
    throw new Error('A pairing code request is already in progress. Please wait a few seconds.');
  }

  if (sessions[userId]) {
    const old = sessions[userId];
    delete sessions[userId];
    delete pairingInProgress[userId];
    delete pairingReconnectAttempts[userId];
    try { old.end(); } catch (e) {}
  }

  sessionStates[userId] = { status: 'connecting', phone: cleanPhone, pairingCode: null, qrCode: null };
  pairingInProgress[userId] = false;
  pairingReconnectAttempts[userId] = 0;

  // Fresh pairing attempt clears any stale/corrupted crypto credentials
  const mongoAuth = await useMongoDBAuthState(WhatsAppAuth, userId);
  await mongoAuth.clearAuth();

  const { state, saveCreds } = await useMongoDBAuthState(WhatsAppAuth, userId);
  const socketOptions = await buildSocketOptions(state);
  const sock = makeWASocket(socketOptions);

  sessions[userId] = sock;
  updateActivity(userId);
  setupSocketListeners(sock, userId, cleanPhone, saveCreds);

  pairingCodeLocks[userId] = true;
  try {
    // Wait for the socket connection to stabilize before requesting pairing code
    let waitMs = 0;
    const maxWait = 7000;
    while (sock.ws?.readyState !== 1 && waitMs < maxWait) {
      await new Promise(r => setTimeout(r, 250));
      waitMs += 250;
    }

    console.log(`[WA] Requesting 8-digit pairing code for ${cleanPhone} (socket ready in ${waitMs}ms)...`);
    
    let pairingCode = null;
    try {
      pairingCode = await sock.requestPairingCode(cleanPhone);
    } catch (firstErr) {
      console.warn(`[WA] Pairing code attempt 1 warning (${firstErr.message}). Retrying in 2.5s...`);
      await new Promise(r => setTimeout(r, 2500));
      pairingCode = await sock.requestPairingCode(cleanPhone);
    }

    if (!pairingCode) {
      throw new Error('WhatsApp server returned an empty pairing code. Please try again.');
    }

    pairingInProgress[userId] = true;
    sessionStates[userId] = {
      ...sessionStates[userId],
      status: 'connecting',
      phone: cleanPhone,
      pairingCode: pairingCode,
    };
    console.log(`[WA] ✅ Pairing code generated for user ${userId}: ${pairingCode}`);

    // Pairing Safety Expiry (160 seconds):
    // If the user does not enter the code on mobile within 160s, release the lock.
    setTimeout(() => {
      const currentState = sessionStates[userId];
      if (currentState && currentState.pairingCode === pairingCode && currentState.status === 'connecting') {
        console.log(`[WA] Pairing code ${pairingCode} window ended for user ${userId}.`);
        pairingInProgress[userId] = false;
        delete pairingCodeLocks[userId];
        delete pairingReconnectAttempts[userId];
        disconnect(userId, true, false).catch(console.error);
      }
    }, 160000);

    delete pairingCodeLocks[userId];
    return { pairingCode };
  } catch (err) {
    console.error('[WA] Failed to get pairing code:', err.message);
    pairingInProgress[userId] = false;
    delete pairingCodeLocks[userId];
    delete pairingReconnectAttempts[userId];
    sessionStates[userId] = { status: 'disconnected', phone: null, pairingCode: null, qrCode: null };
    throw new Error(`Failed to generate pairing code: ${err.message}`);
  }
};

/**
 * Disconnect WhatsApp session cleanly on both CRM and mobile device ends.
 * @param {string|ObjectId} userId
 * @param {boolean} clearSession - Whether to delete stored MongoDB auth credentials
 * @param {boolean} notifyRemote - Whether to send official logout signal to WhatsApp servers
 */
const disconnect = async (userId, clearSession = true, notifyRemote = true) => {
  const uIdStr = userId.toString();
  const sock = sessions[uIdStr];

  if (sock) {
    if (notifyRemote) {
      try {
        console.log(`[WA] Sending remote logout notification for user ${uIdStr}...`);
        await sock.logout('User explicitly disconnected from SalesCRM');
      } catch (logoutErr) {
        console.warn(`[WA] Remote logout notice: ${logoutErr.message}`);
      }
    }

    try {
      sock.end();
    } catch (e) {}
    delete sessions[uIdStr];
  }

  delete pairingInProgress[uIdStr];
  delete pairingReconnectAttempts[uIdStr];
  delete reconnectAttempts[uIdStr];
  delete pairingCodeLocks[uIdStr];
  lastActivityTimestamps.delete(uIdStr);

  sessionStates[uIdStr] = {
    status: 'disconnected',
    phone: null,
    pairingCode: null,
    qrCode: null,
  };

  if (clearSession) {
    try {
      await WhatsAppAuth.deleteMany({ sessionId: uIdStr });
      console.log(`[WA] Stored MongoDB credentials cleared for session ${uIdStr}.`);
    } catch (e) {
      console.error(`[WA] Failed to clear MongoDB auth for session ${uIdStr}:`, e.message);
    }
  }
};

const getStatus = (userId) => {
  return sessionStates[userId] || {
    status: 'disconnected',
    phone: null,
    pairingCode: null,
    qrCode: null,
  };
};

const sendText = async (userId, to, text, callerUserId = null, callerName = null) => {
  const user = await User.findById(userId).select('phone localization').lean();
  const countryCode = user?.localization?.countryPhoneCode || '91';

  let sock = sessions[userId];
  if (!sock) {
    const authExists = await WhatsAppAuth.findOne({ sessionId: userId.toString(), key: 'creds' }).lean();
    if (authExists && user && user.phone) {
      await restoreSession(userId, user.phone);
      sock = sessions[userId];
    }
  }

  if (!sock) {
    throw new Error('WhatsApp is not connected for this account.');
  }

  const { jid } = normalizePhoneAndJid(to, countryCode);
  const result = await sock.sendMessage(jid, { text });
  updateActivity(userId);
  await recordOutboundMessage(callerUserId || userId, to, text);
  return result;
};

const sendMedia = async (userId, to, mediaArg, callerUserId = null, callerName = null) => {
  let mediaPath = mediaArg;
  let caption = '';
  let mediaType = null;

  if (mediaArg && typeof mediaArg === 'object' && !Array.isArray(mediaArg)) {
    if (mediaArg.image) {
      mediaPath = mediaArg.image;
      mediaType = 'image';
    } else if (mediaArg.video) {
      mediaPath = mediaArg.video;
      mediaType = 'video';
    } else if (mediaArg.document) {
      mediaPath = mediaArg.document;
      mediaType = 'document';
    } else if (mediaArg.audio) {
      mediaPath = mediaArg.audio;
      mediaType = 'audio';
    } else if (mediaArg.url || mediaArg.mediaUrl) {
      mediaPath = mediaArg.url || mediaArg.mediaUrl;
    }
    caption = mediaArg.text || mediaArg.caption || '';
    if (mediaArg.type) mediaType = mediaArg.type;
  }

  if (Array.isArray(mediaPath)) {
    mediaPath = mediaPath[0];
  }

  const user = await User.findById(userId).select('phone localization').lean();
  const countryCode = user?.localization?.countryPhoneCode || '91';

  let sock = sessions[userId];
  if (!sock) {
    const authExists = await WhatsAppAuth.findOne({ sessionId: userId.toString(), key: 'creds' }).lean();
    if (authExists && user && user.phone) {
      await restoreSession(userId, user.phone);
      sock = sessions[userId];
    }
  }

  if (!sock) {
    throw new Error('WhatsApp is not connected for this account.');
  }

  const { jid } = normalizePhoneAndJid(to, countryCode);
  const mediaSource = resolveMediaSource(mediaPath);
  if (!mediaSource) throw new Error('Could not resolve media source file');

  const captionText = (typeof caption === 'string' && caption.trim().length > 0)
    ? caption.trim()
    : undefined;

  let payload = {};
  if (mediaType === 'image') {
    payload = { image: mediaSource, caption: captionText };
  } else if (mediaType === 'video') {
    payload = { video: mediaSource, caption: captionText };
  } else if (mediaType === 'audio') {
    payload = { audio: mediaSource, mimetype: 'audio/mp4' };
  } else {
    const fileName = (typeof mediaPath === 'string' && path.basename(mediaPath))
      ? path.basename(mediaPath)
      : 'document.pdf';
    payload = { document: mediaSource, mimetype: 'application/pdf', fileName, caption: captionText };
  }

  const result = await sock.sendMessage(jid, payload);
  updateActivity(userId);
  await recordOutboundMessage(
    callerUserId || userId,
    to,
    caption || `[Media attachment: ${mediaType || 'document'}]`,
    typeof mediaPath === 'string' ? mediaPath : null,
    mediaType
  );
  return result;
};

/**
 * Send text from any currently active connected session (used for automated admin alerts).
 */
const sendFromAnyActiveSession = async (to, text) => {
  const activeUserIds = Object.keys(sessions);
  for (const uId of activeUserIds) {
    const st = getStatus(uId);
    if (st.status === 'connected') {
      try {
        await sendText(uId, to, text);
        return true;
      } catch (e) {
        console.warn(`[WA] Could not send admin alert via session ${uId}:`, e.message);
      }
    }
  }
  return false;
};

// ── INIT SESSIONS ON STARTUP (FROM MONGODB) ──────────────────────────────────
const initSessions = async () => {
  try {
    const sessionsWithCreds = await WhatsAppAuth.distinct('sessionId', { key: 'creds' });
    console.log(`[WA] Found ${sessionsWithCreds.length} stored WhatsApp credentials in MongoDB.`);

    for (const uId of sessionsWithCreds) {
      const user = await User.findById(uId).select('phone').lean();
      const phoneToUse = user?.phone || 'whatsapp';
      console.log(`[WA] Restoring registered MongoDB session for user ${uId} (${phoneToUse})`);
      try {
        await restoreSession(uId, phoneToUse);
      } catch (e) {
        console.warn(`[WA] Session restore notice for user ${uId}:`, e.message);
      }
    }
  } catch (err) {
    console.error('[WA] initSessions error:', err.message);
  }
};

// ── 7-DAY RESILIENT SESSION GUARANTEE & BACKGROUND HEARTBEAT ───────────────
// Periodically checks all registered credentials in MongoDB every 45 seconds.
// If any session dropped connection or server restarted, automatically restore it
// so users stay connected even after leaving the site or being offline for 7+ days.
setInterval(async () => {
  try {
    const sessionsWithCreds = await WhatsAppAuth.distinct('sessionId', { key: 'creds' });
    for (const uId of sessionsWithCreds) {
      if (pairingInProgress[uId]) continue; // Skip if actively in pairing window
      
      const st = getStatus(uId);
      if (st.status !== 'connected' && st.status !== 'connecting') {
        const user = await User.findById(uId).select('phone').lean();
        console.log(`[WA-Heartbeat] Auto-healing offline WhatsApp session for user ${uId}...`);
        try {
          await restoreSession(uId, user?.phone || 'whatsapp');
        } catch (err) {
          console.warn(`[WA-Heartbeat] Session heal retry notice for ${uId}:`, err.message);
        }
      }
    }
  } catch (e) {
    // Non-blocking background heartbeat
  }
}, 45000);

module.exports = {
  connect,
  disconnect,
  getStatus,
  sendText,
  sendMedia,
  sendFromAnyActiveSession,
  initSessions,
  restoreSession,
  normalizePhoneAndJid,
};
