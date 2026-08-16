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
// In-memory object for user cooldowns keyed by userId
const userCooldowns = {};
// Debounce cache for inbound WhatsApp message notifications (key: `${userId}_${leadId}`, val: timestamp)
const leadNotificationThrottle = new Map();
// Last active timestamp for 24h idle-session cleanup
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
    browser: Browsers.macOS('Desktop'),
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 25000,
    defaultQueryTimeoutMs: 45000,
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

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && sessionStates[userId]) {
      sessionStates[userId] = { ...sessionStates[userId], qrCode: qr };
      console.log(`[WA] QR code updated for user ${userId}`);
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`[WA] Connection closed for user ${userId}. Status: ${statusCode}. Reconnect? ${shouldReconnect}`);

      if (pairingInProgress[userId]) {
        const pairingAttempt = (pairingReconnectAttempts[userId] || 0) + 1;
        pairingReconnectAttempts[userId] = pairingAttempt;

        if (pairingAttempt > MAX_PAIRING_RECONNECTS) {
          console.error(`[WA] Too many pairing reconnect attempts (${pairingAttempt}) for user ${userId}. Giving up.`);
          pairingInProgress[userId] = false;
          delete pairingReconnectAttempts[userId];
          if (sessionStates[userId]) {
            sessionStates[userId] = {
              ...sessionStates[userId],
              status: 'disconnected',
            };
          }
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

      if (shouldReconnect) {
        const attempts = (reconnectAttempts[userId] || 0) + 1;
        reconnectAttempts[userId] = attempts;
        if (attempts <= 5) {
          const delayMs = Math.min(5000 * Math.pow(2, attempts - 1), 60000);
          setTimeout(() => {
            if (!pairingInProgress[userId] && (!sessions[userId] || getStatus(userId).status !== 'connected')) {
              restoreSession(userId, cleanPhone).catch(console.error);
            }
          }, delayMs);
        }
      } else {
        disconnect(userId, true).catch(console.error);
      }
    } else if (connection === 'open') {
      console.log(`[WA] ✅ Connection opened for user ${userId} (${cleanPhone})`);
      sessionStates[userId] = { status: 'connected', phone: cleanPhone, pairingCode: null, qrCode: null };
      pairingInProgress[userId] = false;
      delete pairingReconnectAttempts[userId];
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

  let cleanPhone = String(phoneNumber).replace(/[^0-9]/g, '').replace(/^0+/, '');
  if (cleanPhone.length === 10) {
    cleanPhone = countryCode + cleanPhone;
  }
  if (!cleanPhone || cleanPhone.length < 8) {
    throw new Error('Invalid phone number. Please include your country code.');
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

  const mongoAuth = await useMongoDBAuthState(WhatsAppAuth, userId);
  await mongoAuth.clearAuth(); // Fresh pairing attempt resets credentials

  const { state, saveCreds } = await useMongoDBAuthState(WhatsAppAuth, userId);
  const socketOptions = await buildSocketOptions(state);
  const sock = makeWASocket(socketOptions);

  sessions[userId] = sock;
  sock.ev.on('creds.update', saveCreds);
  updateActivity(userId);

  try {
    const code = await new Promise((resolve, reject) => {
      let requested = false;

      const timeout = setTimeout(() => {
        if (!requested) {
          reject(new Error('Timed out waiting for WhatsApp. Check your internet connection and try again.'));
        }
      }, 35000);

      const tryRequest = async () => {
        if (requested) return;
        requested = true;
        clearTimeout(timeout);
        try {
          // Wait for socket to be fully open before requesting pairing code
          let waitMs = 0;
          const maxWait = 8000;
          while (sock.ws?.readyState !== 1 /* WebSocket.OPEN */ && waitMs < maxWait) {
            await new Promise(r => setTimeout(r, 300));
            waitMs += 300;
          }
          console.log(`[WA] Requesting pairing code for ${cleanPhone} after ${waitMs}ms socket wait...`);
          const pairingCode = await sock.requestPairingCode(cleanPhone);
          resolve(pairingCode);
        } catch (err) {
          console.warn(`[WA] Pairing code attempt 1 failed (${err.message}). Retrying in 3s...`);
          await new Promise(r => setTimeout(r, 3000));
          try {
            const pairingCode2 = await sock.requestPairingCode(cleanPhone);
            resolve(pairingCode2);
          } catch (err2) {
            reject(err2);
          }
        }
      };

      sock.ev.on('connection.update', (update) => {
        if (update.qr) {
          if (sessionStates[userId]) {
            sessionStates[userId] = { ...sessionStates[userId], qrCode: update.qr };
          }
          setTimeout(() => tryRequest(), 1000);
        }

        if (update.connection === 'connecting' && !requested) {
          setTimeout(() => tryRequest(), 3000);
        }
      });

      // Initial trigger: wait 5000ms to let the WebSocket fully handshake
      setTimeout(() => tryRequest(), 5000);
    });

    pairingInProgress[userId] = true;

    sessionStates[userId] = {
      ...sessionStates[userId],
      status: 'connecting',
      phone: cleanPhone,
      pairingCode: code,
    };
    console.log(`[WA] Pairing code generated for user ${userId}: ${code}`);

    setupSocketListeners(sock, userId, cleanPhone, saveCreds);

    setTimeout(() => {
      const currentState = sessionStates[userId];
      if (currentState && currentState.pairingCode === code && currentState.status === 'connecting') {
        console.log(`[WA] Pairing code ${code} expired for user ${userId}. Cleaning up.`);
        pairingInProgress[userId] = false;
        delete pairingReconnectAttempts[userId];
        disconnect(userId, true).catch(console.error);
      }
    }, 110000);

    return { pairingCode: code };
  } catch (err) {
    console.error('[WA] Failed to get pairing code:', err.message);
    pairingInProgress[userId] = false;
    delete pairingReconnectAttempts[userId];
    sessionStates[userId] = { status: 'disconnected', phone: null, pairingCode: null, qrCode: null };
    throw new Error(`Failed to generate pairing code: ${err.message}`);
  }
};

const disconnect = async (userId, clearSession = true) => {
  if (sessions[userId]) {
    try {
      sessions[userId].end();
    } catch (e) {}
    delete sessions[userId];
  }
  delete pairingInProgress[userId];
  delete pairingReconnectAttempts[userId];
  delete reconnectAttempts[userId];
  lastActivityTimestamps.delete(userId.toString());

  sessionStates[userId] = {
    status: 'disconnected',
    phone: null,
    pairingCode: null,
    qrCode: null,
  };

  if (clearSession) {
    try {
      await WhatsAppAuth.deleteMany({ sessionId: userId.toString() });
    } catch (e) {}
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

const sendText = async (userId, to, text) => {
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
  await recordOutboundMessage(userId, to, text);
  return result;
};

const sendMedia = async (userId, to, mediaArg, captionArg = '', mediaTypeArg = null) => {
  let mediaPath = mediaArg;
  let caption = captionArg;
  let mediaType = mediaTypeArg;

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
    caption = caption || mediaArg.text || mediaArg.caption || '';
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

  let payload = {};
  if (mediaType === 'image') {
    payload = { image: mediaSource, caption: caption || undefined };
  } else if (mediaType === 'video') {
    payload = { video: mediaSource, caption: caption || undefined };
  } else if (mediaType === 'audio') {
    payload = { audio: mediaSource, mimetype: 'audio/mp4' };
  } else {
    const fileName = (typeof mediaPath === 'string' && path.basename(mediaPath)) ? path.basename(mediaPath) : 'document.pdf';
    payload = { document: mediaSource, mimetype: 'application/pdf', fileName, caption: caption || undefined };
  }

  const result = await sock.sendMessage(jid, payload);
  updateActivity(userId);
  await recordOutboundMessage(userId, to, caption || `[Media attachment: ${mediaType || 'document'}]`, typeof mediaPath === 'string' ? mediaPath : null, mediaType);
  return result;
};

// ── 24-HOUR IDLE SESSION GARBAGE COLLECTOR ───────────────────────────────────
// Disconnects active WebSocket sockets after 24h of inactivity to free RAM.
// Credentials remain in MongoDB and restore automatically on demand.
const IDLE_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours

const cleanupIdleSessions = () => {
  const now = Date.now();
  for (const [userIdStr, sock] of Object.entries(sessions)) {
    const lastActive = lastActivityTimestamps.get(userIdStr) || 0;
    if (now - lastActive > IDLE_TIMEOUT_MS) {
      console.log(`[WA GC] Disconnecting idle WhatsApp socket for user ${userIdStr} (idle > 24h). Auth preserved in MongoDB.`);
      try { sock.end(); } catch (e) {}
      delete sessions[userIdStr];
      if (sessionStates[userIdStr]) {
        sessionStates[userIdStr].status = 'disconnected';
      }
    }
  }
};

setInterval(cleanupIdleSessions, 60 * 60 * 1000); // Hourly check

// ── INIT SESSIONS ON STARTUP (FROM MONGODB) ──────────────────────────────────
const initSessions = async () => {
  try {
    const sessionsWithCreds = await WhatsAppAuth.distinct('sessionId', { key: 'creds' });
    console.log(`[WA] Found ${sessionsWithCreds.length} stored WhatsApp credentials in MongoDB.`);

    for (const uId of sessionsWithCreds) {
      const user = await User.findById(uId).select('phone').lean();
      if (user && user.phone) {
        console.log(`[WA] Restoring registered MongoDB session for user ${uId} (${user.phone})`);
        try {
          await restoreSession(uId, user.phone);
        } catch (e) {
          console.warn(`[WA] Session restore notice for user ${uId}:`, e.message);
        }
      }
    }
  } catch (err) {
    console.error('[WA] initSessions error:', err.message);
  }
};

module.exports = {
  connect,
  disconnect,
  getStatus,
  sendText,
  sendMedia,
  initSessions,
  restoreSession,
  normalizePhoneAndJid,
};
