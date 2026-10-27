const makeWASocket = require('@whiskeysockets/baileys').default;
const {
  DisconnectReason,
  Browsers,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const path = require('path');
const fs = require('fs');
const WhatsAppAuth = require('../models/WhatsAppAuth');
const WhatsAppSessionState = require('../models/WhatsAppSessionState');
const User = require('../models/User');
const { useMongoDBAuthState } = require('./mongoAuthState');
const { notifyWhatsAppDisconnected, notifyWhatsAppReconnected } = require('./notificationService');

// State Machine Constants
const STATES = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  AUTHENTICATION_REQUIRED: 'auth_required',
  DEGRADED: 'degraded',
  ERROR: 'error',
};

// In-memory sockets store
const sessions = {};
// In-memory session state metadata (mirrored and backed by WhatsAppSessionState in MongoDB)
const sessionStates = {};
// Track reconnect attempts
const reconnectAttempts = {};
// Reconnect in-flight lock to prevent duplicate concurrent reconnect tasks
const reconnectInProgress = {};
// Track pairing-specific reconnect attempts
const pairingReconnectAttempts = {};
// Track pairing in progress
const pairingInProgress = {};
// Global per-user lock for pairing code generation
const pairingCodeLocks = {};
// In-memory debounce cache for inbound message notifications
const leadNotificationThrottle = new Map();
// Last active timestamp for tracking
const lastActivityTimestamps = new Map();

// Instance Identifier for distributed leasing
const INSTANCE_ID = `proc_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;

const MAX_PAIRING_RECONNECTS = 5;
const MAX_CONSECUTIVE_RECONNECTS = 10;

// Cache WA version
let cachedWAVersion = null;
let versionFetchedAt = 0;
const VERSION_CACHE_TTL_MS = 30 * 60 * 1000;
const FALLBACK_WA_VERSION = [2, 3000, 1043857760];

const getWAVersion = async (forceRefresh = false) => {
  const now = Date.now();
  if (!forceRefresh && cachedWAVersion && now - versionFetchedAt < VERSION_CACHE_TTL_MS) {
    return cachedWAVersion;
  }
  try {
    const { version, isLatest } = await fetchLatestBaileysVersion();
    cachedWAVersion = version;
    versionFetchedAt = now;
    return version;
  } catch (err) {
    console.warn(`[WA] Fetch WA version notice (${err.message}). Using fallback.`);
    cachedWAVersion = FALLBACK_WA_VERSION;
    versionFetchedAt = now;
    return FALLBACK_WA_VERSION;
  }
};

const updateActivity = (userId) => {
  if (userId) lastActivityTimestamps.set(userId.toString(), Date.now());
};

/**
 * Persist state transitions both in memory and MongoDB
 */
const persistStateTransition = async (userId, updateData) => {
  const uIdStr = userId.toString();
  const current = sessionStates[uIdStr] || {
    status: STATES.DISCONNECTED,
    phone: null,
    pairingCode: null,
    qrCode: null,
  };

  const nextState = {
    ...current,
    ...updateData,
    updatedAt: new Date(),
  };
  sessionStates[uIdStr] = nextState;

  try {
    const dbUpdate = {
      sessionId: uIdStr,
      userId,
      transport: 'baileys',
      status: nextState.status.toUpperCase(),
      phone: nextState.phone || null,
      pairingCode: nextState.pairingCode || null,
      qrCode: nextState.qrCode || null,
      lastConfirmedAt: nextState.lastConfirmedAt || null,
      lastDisconnectAt: nextState.lastDisconnectAt || null,
      lastDisconnectReason: nextState.lastDisconnectReason || null,
      reconnectAttempts: reconnectAttempts[uIdStr] || 0,
      nextRetryAt: nextState.nextRetryAt || null,
      requiresAction: !!nextState.requiresAction,
      leaseOwner: INSTANCE_ID,
      leaseExpiresAt: new Date(Date.now() + 60000), // 60s lease
    };

    await WhatsAppSessionState.findOneAndUpdate(
      { sessionId: uIdStr },
      { $set: dbUpdate },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.warn(`[WA] State persistence notice for ${uIdStr}:`, err.message);
  }

  return nextState;
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
  const safePath = Array.isArray(mediaPath)
    ? mediaPath[0]
    : typeof mediaPath === 'object'
    ? mediaPath.url || mediaPath.image || mediaPath.video || mediaPath.document || ''
    : mediaPath;
  if (!safePath || typeof safePath !== 'string') return null;

  if (safePath.startsWith('http://') || safePath.startsWith('https://')) {
    return { url: safePath };
  }

  let localPath = safePath;
  if (localPath.startsWith('/uploads/')) {
    localPath = path.join(__dirname, '../../', localPath.replace(/^\//, ''));
  } else if (!path.isAbsolute(localPath)) {
    localPath = path.join(__dirname, '../../uploads/templates', localPath);
  }

  if (fs.existsSync(localPath)) {
    return fs.readFileSync(localPath);
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
    console.warn('[WA] Outbound chat logging notice:', e.message);
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
  const uIdStr = userId.toString();

  sock.ev.on('creds.update', saveCreds);

  // Inbound messages handler
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    updateActivity(uIdStr);
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (msg.key.fromMe) continue;
      const remoteJid = msg.key.remoteJid;
      if (!remoteJid || remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast') continue;

      const senderPhone = remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g, '');
      const text =
        msg.message?.conversation ||
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
        const { broadcastNotification, broadcastChatMessage } = require('../utils/realtime');
        const { dispatchNotification } = require('./notificationService');

        const tenDigit = senderPhone.slice(-10);
        const user = await User.findById(userId).select('companyId workStatus companyRole localization').lean();
        const countryCode = user?.localization?.countryPhoneCode || '91';
        const phoneVariants = [senderPhone, tenDigit, countryCode + tenDigit];

        const isOwner = user?.workStatus === 'company_owner' || user?.companyRole === 'owner';
        const companyId = isOwner ? userId : user?.companyId;

        const lead = await Lead.findOne({
          phone: { $in: phoneVariants },
          $or: [{ userId }, ...(companyId ? [{ companyId }, { userId: companyId }] : [])],
        });
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
          timestamp: new Date(Number(msg.messageTimestamp) * 1000 || Date.now()),
        });

        broadcastChatMessage(userId, {
          message: chatMsg,
          phone: senderPhone,
          leadId: lead._id,
        });

        // Trigger Inbound WhatsApp Chatbot & Automation Workflow
        try {
          const AutomationEngine = require('./automationEngine');
          AutomationEngine.handleInboundWhatsAppMessage({
            userId,
            workspaceId: lead.workspaceId || userId,
            lead,
            phone: senderPhone,
            text,
            channel: 'baileys',
          }).catch(err => console.error('[WA] Inbound automation trigger error:', err.message));
        } catch (autoErr) {
          console.error('[WA] AutomationEngine dispatch error:', autoErr.message);
        }

        const throttleKey = `${uIdStr}_${lead._id}`;
        const lastNotified = leadNotificationThrottle.get(throttleKey) || 0;
        const now = Date.now();
        const THREE_MINUTES = 3 * 60 * 1000;

        if (now - lastNotified > THREE_MINUTES) {
          leadNotificationThrottle.set(throttleKey, now);

          const notifTitle = `💬 New WhatsApp from ${lead.name}`;
          const notifMessage = text
            ? text.length > 80
              ? text.substring(0, 80) + '...'
              : text
            : `Sent an attachment [${mediaType || 'document'}]`;

          const sendNotif = async (recipientId) => {
            await dispatchNotification({
              userId: recipientId,
              leadId: lead._id,
              leadName: lead.name,
              title: notifTitle,
              message: notifMessage,
              type: 'wa_reply',
              priority: 'high',
              category: 'communication',
              entityType: 'Lead',
              entityId: lead._id,
              channels: ['in_app', 'push', 'sse'],
              pushPayload: { url: `/leads/${lead._id}` },
            });
          };

          if (lead.assignedTo) {
            await sendNotif(lead.assignedTo);
            if (String(lead.assignedTo) !== String(userId)) {
              await sendNotif(userId);
            }
          } else {
            await sendNotif(userId);
          }
        }
      } catch (e) {
        console.error('[WA] Inbound message handling error:', e.message);
      }
    }
  });

  // Connection Update Event
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      await persistStateTransition(userId, {
        status: STATES.CONNECTING,
        qrCode: qr,
        phone: cleanPhone,
      });
      console.log(`[WA] QR code refreshed for user ${uIdStr}`);
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;
      const shouldReconnect = !isLoggedOut;

      const normalizedReason = isLoggedOut
        ? 'device_logged_out'
        : statusCode === 515
        ? 'restart_required'
        : statusCode === 428
        ? 'connection_closed'
        : statusCode === 408
        ? 'timed_out'
        : 'network_drop';

      console.log(`[WA] Connection closed for ${uIdStr}. Status: ${statusCode} (${normalizedReason}). Should Reconnect? ${shouldReconnect}`);

      // Case 1: Remote logout or revoked credentials
      if (isLoggedOut) {
        console.log(`[WA] Explicit remote logout detected for user ${uIdStr}. Requiring re-authentication.`);
        await persistStateTransition(userId, {
          status: STATES.AUTHENTICATION_REQUIRED,
          lastDisconnectAt: new Date(),
          lastDisconnectReason: 'logged_out',
          requiresAction: true,
          phone: cleanPhone,
          pairingCode: null,
          qrCode: null,
        });
        await notifyWhatsAppDisconnected(userId, cleanPhone, 'Session unlinked from phone. Please re-pair.').catch(() => {});
        await disconnect(userId, true, false);
        return;
      }

      // Case 2: During active pairing window
      if (pairingInProgress[uIdStr]) {
        const pairingAttempt = (pairingReconnectAttempts[uIdStr] || 0) + 1;
        pairingReconnectAttempts[uIdStr] = pairingAttempt;

        if (pairingAttempt > MAX_PAIRING_RECONNECTS) {
          console.warn(`[WA] Pairing attempts exceeded for user ${uIdStr}. Resetting to disconnected.`);
          pairingInProgress[uIdStr] = false;
          delete pairingReconnectAttempts[uIdStr];
          delete pairingCodeLocks[uIdStr];
          await persistStateTransition(userId, {
            status: STATES.DISCONNECTED,
            phone: null,
            pairingCode: null,
            qrCode: null,
            requiresAction: true,
            lastDisconnectReason: 'pairing_timeout',
          });
          return;
        }

        const delayMs = 2500 * pairingAttempt;
        setTimeout(() => {
          if (!pairingInProgress[uIdStr]) return;
          restoreSession(userId, cleanPhone).catch(e => {
            console.error(`[WA] Pairing reconnect failed for ${uIdStr}:`, e.message);
          });
        }, delayMs);
        return;
      }

      // Case 3: Standard active session dropped (Recoverable Network Failure)
      // Immediately set state to RECONNECTING so UI NEVER shows false "Connected"
      if (shouldReconnect) {
        const attempts = (reconnectAttempts[uIdStr] || 0) + 1;
        reconnectAttempts[uIdStr] = attempts;

        // Bounded exponential backoff with jitter (3s to max 60s)
        const baseDelay = Math.min(3000 * Math.pow(1.5, Math.min(attempts, 8)), 60000);
        const jitter = Math.floor(Math.random() * 2000);
        const delayMs = baseDelay + jitter;
        const nextRetryAt = new Date(Date.now() + delayMs);

        if (attempts > MAX_CONSECUTIVE_RECONNECTS) {
          console.warn(`[WA] Reconnect attempts exceeded (${attempts}) for user ${uIdStr}. Entering degraded cooldown.`);
          await persistStateTransition(userId, {
            status: STATES.DEGRADED,
            lastDisconnectAt: new Date(),
            lastDisconnectReason: normalizedReason,
            nextRetryAt: new Date(Date.now() + 5 * 60 * 1000), // 5-minute cooldown
            requiresAction: true,
          });
          await notifyWhatsAppDisconnected(userId, cleanPhone, 'Repeated reconnect attempts exhausted. Cooldown active.').catch(() => {});
          return;
        }

        await persistStateTransition(userId, {
          status: STATES.RECONNECTING,
          lastDisconnectAt: new Date(),
          lastDisconnectReason: normalizedReason,
          nextRetryAt,
          requiresAction: false,
        });

        if (reconnectInProgress[uIdStr]) {
          return;
        }
        reconnectInProgress[uIdStr] = true;

        console.log(`[WA] Scheduling auto-reconnect attempt #${attempts} in ${Math.round(delayMs / 1000)}s for user ${uIdStr}...`);

        setTimeout(async () => {
          try {
            if (!pairingInProgress[uIdStr]) {
              const liveStatus = getStatus(userId);
              if (liveStatus.status !== STATES.CONNECTED) {
                await restoreSession(userId, cleanPhone);
              }
            }
          } catch (err) {
            console.error(`[WA] Auto-reconnect failed for ${uIdStr}:`, err.message);
          } finally {
            reconnectInProgress[uIdStr] = false;
          }
        }, delayMs);
      }
    } else if (connection === 'open') {
      console.log(`[WA] ✅ Connection confirmed live & authenticated for user ${uIdStr} (${cleanPhone})`);
      const wasReconnecting = sessionStates[uIdStr]?.status === STATES.RECONNECTING || sessionStates[uIdStr]?.status === STATES.DEGRADED;

      await persistStateTransition(userId, {
        status: STATES.CONNECTED,
        phone: cleanPhone,
        pairingCode: null,
        qrCode: null,
        lastConfirmedAt: new Date(),
        requiresAction: false,
        lastDisconnectReason: null,
      });

      pairingInProgress[uIdStr] = false;
      reconnectInProgress[uIdStr] = false;
      delete pairingReconnectAttempts[uIdStr];
      delete pairingCodeLocks[uIdStr];
      reconnectAttempts[uIdStr] = 0;
      updateActivity(uIdStr);

      if (wasReconnecting) {
        notifyWhatsAppReconnected(userId, cleanPhone).catch(() => {});
      }
    }
  });
};

const restoreSession = async (userId, cleanPhone) => {
  const uIdStr = userId.toString();

  if (sessions[uIdStr]) {
    const old = sessions[uIdStr];
    try { old.end(); } catch (e) {}
    delete sessions[uIdStr];
  }

  await persistStateTransition(userId, {
    status: STATES.CONNECTING,
    phone: cleanPhone,
  });

  const { state, saveCreds } = await useMongoDBAuthState(WhatsAppAuth, userId);
  const socketOptions = await buildSocketOptions(state);

  const sock = makeWASocket(socketOptions);
  sessions[uIdStr] = sock;
  updateActivity(uIdStr);
  setupSocketListeners(sock, userId, cleanPhone, saveCreds);
};

const connect = async (userId, phoneNumber) => {
  const uIdStr = userId.toString();
  const user = await User.findById(userId).select('phone localization').lean();
  const countryCode = user?.localization?.countryPhoneCode || '91';

  let cleanPhone = String(phoneNumber)
    .replace(/[\s\-().+]/g, '')
    .replace(/[^0-9]/g, '')
    .replace(/^0+/, '');

  if (cleanPhone.length === 10) {
    cleanPhone = countryCode + cleanPhone;
  }

  if (!cleanPhone || cleanPhone.length < 7 || cleanPhone.length > 15) {
    throw new Error(`Invalid phone number "${phoneNumber}". Please provide your full mobile number with country code.`);
  }

  // Anti-Fraud check
  const WAFingerprint = require('../models/WAFingerprint');
  const bannedFingerprint = await WAFingerprint.findOne({
    phone: cleanPhone,
    cooldownUntil: { $gt: new Date() },
    unbannedAt: null,
  });

  if (bannedFingerprint) {
    const unbanDate = new Date(bannedFingerprint.cooldownUntil).toLocaleDateString();
    throw new Error(`Anti-Fraud Lock: WhatsApp number +${cleanPhone} is under a cooldown until ${unbanDate} due to ${bannedFingerprint.reason}.`);
  }

  if (pairingCodeLocks[uIdStr]) {
    throw new Error('A pairing code request is already in progress. Please wait a few seconds.');
  }

  if (sessions[uIdStr]) {
    const old = sessions[uIdStr];
    delete sessions[uIdStr];
    delete pairingInProgress[uIdStr];
    delete pairingReconnectAttempts[uIdStr];
    try { old.end(); } catch (e) {}
  }

  await persistStateTransition(userId, {
    status: STATES.CONNECTING,
    phone: cleanPhone,
    pairingCode: null,
    qrCode: null,
  });
  pairingInProgress[uIdStr] = false;
  pairingReconnectAttempts[uIdStr] = 0;

  const mongoAuth = await useMongoDBAuthState(WhatsAppAuth, userId);
  await mongoAuth.clearAuth();

  const { state, saveCreds } = await useMongoDBAuthState(WhatsAppAuth, userId);
  const socketOptions = await buildSocketOptions(state);
  const sock = makeWASocket(socketOptions);

  sessions[uIdStr] = sock;
  updateActivity(uIdStr);
  setupSocketListeners(sock, userId, cleanPhone, saveCreds);

  pairingCodeLocks[uIdStr] = true;
  try {
    let waitMs = 0;
    const maxWait = 7000;
    while (sock.ws?.readyState !== 1 && waitMs < maxWait) {
      await new Promise(r => setTimeout(r, 250));
      waitMs += 250;
    }

    console.log(`[WA] Requesting 8-digit pairing code for ${cleanPhone}...`);

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

    pairingInProgress[uIdStr] = true;
    await persistStateTransition(userId, {
      status: STATES.CONNECTING,
      phone: cleanPhone,
      pairingCode,
    });

    // Expiry timeout: 160s
    setTimeout(() => {
      const currentState = sessionStates[uIdStr];
      if (currentState && currentState.pairingCode === pairingCode && currentState.status === STATES.CONNECTING) {
        console.log(`[WA] Pairing code ${pairingCode} window expired for user ${uIdStr}.`);
        pairingInProgress[uIdStr] = false;
        delete pairingCodeLocks[uIdStr];
        delete pairingReconnectAttempts[uIdStr];
        disconnect(userId, true, false).catch(console.error);
      }
    }, 160000);

    delete pairingCodeLocks[uIdStr];
    return { pairingCode };
  } catch (err) {
    console.error('[WA] Failed to get pairing code:', err.message);
    pairingInProgress[uIdStr] = false;
    delete pairingCodeLocks[uIdStr];
    delete pairingReconnectAttempts[uIdStr];
    await persistStateTransition(userId, {
      status: STATES.DISCONNECTED,
      phone: null,
      pairingCode: null,
      qrCode: null,
      requiresAction: true,
      lastDisconnectReason: err.message,
    });
    throw new Error(`Failed to generate pairing code: ${err.message}`);
  }
};

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
  delete reconnectInProgress[uIdStr];
  delete pairingCodeLocks[uIdStr];
  lastActivityTimestamps.delete(uIdStr);

  await persistStateTransition(userId, {
    status: STATES.DISCONNECTED,
    phone: null,
    pairingCode: null,
    qrCode: null,
    requiresAction: true,
    lastDisconnectReason: 'user_disconnected',
  });

  if (clearSession) {
    try {
      await WhatsAppAuth.deleteMany({ sessionId: uIdStr });
      console.log(`[WA] Stored MongoDB credentials cleared for session ${uIdStr}.`);
    } catch (e) {
      console.error(`[WA] Failed to clear MongoDB auth for session ${uIdStr}:`, e.message);
    }
  }
};

/**
 * TRUTHFUL STATUS PROBE:
 * Never returns a stale database boolean or in-memory flag.
 * Inspects real socket readyState and validates active transport.
 */
const getStatus = (userId) => {
  const uIdStr = userId ? userId.toString() : '';
  const inMemory = sessionStates[uIdStr];
  const sock = sessions[uIdStr];

  // If in-memory says connected, verify that socket is actually OPEN (readyState === 1)
  if (inMemory && inMemory.status === STATES.CONNECTED) {
    const isSocketOpen = sock && sock.ws && sock.ws.readyState === 1;
    if (!isSocketOpen) {
      // Socket dropped or is dead! Transition to RECONNECTING or DEGRADED immediately
      const attempts = reconnectAttempts[uIdStr] || 0;
      const effectiveStatus = attempts > 0 ? STATES.RECONNECTING : STATES.DEGRADED;
      return {
        ...inMemory,
        status: effectiveStatus,
        isSocketLive: false,
        requiresAction: attempts > MAX_CONSECUTIVE_RECONNECTS,
      };
    }
    return {
      ...inMemory,
      status: STATES.CONNECTED,
      isSocketLive: true,
      requiresAction: false,
    };
  }

  const base = inMemory || {
    status: STATES.DISCONNECTED,
    phone: null,
    pairingCode: null,
    qrCode: null,
    requiresAction: false,
  };

  return {
    ...base,
    isSocketLive: false,
  };
};

const sendText = async (userId, to, text, callerUserId = null, callerName = null) => {
  const user = await User.findById(userId).select('phone localization').lean();
  const countryCode = user?.localization?.countryPhoneCode || '91';

  let sock = sessions[userId.toString()];
  if (!sock || !sock.ws || sock.ws.readyState !== 1) {
    const authExists = await WhatsAppAuth.findOne({ sessionId: userId.toString(), key: 'creds' }).lean();
    if (authExists && user && user.phone) {
      await restoreSession(userId, user.phone);
      sock = sessions[userId.toString()];
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

  let sock = sessions[userId.toString()];
  if (!sock || !sock.ws || sock.ws.readyState !== 1) {
    const authExists = await WhatsAppAuth.findOne({ sessionId: userId.toString(), key: 'creds' }).lean();
    if (authExists && user && user.phone) {
      await restoreSession(userId, user.phone);
      sock = sessions[userId.toString()];
    }
  }

  if (!sock) {
    throw new Error('WhatsApp is not connected for this account.');
  }

  const { jid } = normalizePhoneAndJid(to, countryCode);
  const mediaSource = resolveMediaSource(mediaPath);
  if (!mediaSource) throw new Error('Could not resolve media source file');

  const captionText = typeof caption === 'string' && caption.trim().length > 0 ? caption.trim() : undefined;

  let payload = {};
  if (mediaType === 'image') {
    payload = { image: mediaSource, caption: captionText };
  } else if (mediaType === 'video') {
    payload = { video: mediaSource, caption: captionText };
  } else if (mediaType === 'audio') {
    payload = { audio: mediaSource, mimetype: 'audio/mp4' };
  } else {
    const fileName = typeof mediaPath === 'string' && path.basename(mediaPath) ? path.basename(mediaPath) : 'document.pdf';
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

const sendFromAnyActiveSession = async (to, text) => {
  const activeUserIds = Object.keys(sessions);
  for (const uId of activeUserIds) {
    const st = getStatus(uId);
    if (st.status === STATES.CONNECTED) {
      try {
        await sendText(uId, to, text);
        return true;
      } catch (e) {
        console.warn(`[WA] Admin alert dispatch notice for session ${uId}:`, e.message);
      }
    }
  }
  return false;
};

// Startup session restoration
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

// Background Heartbeat & Self-Healing Engine (Every 30 seconds)
let isHeartbeatRunning = false;
const healFailureCooldowns = new Map();

const heartbeatTimer = setInterval(async () => {
  if (isHeartbeatRunning) return;
  isHeartbeatRunning = true;
  try {
    const sessionsWithCreds = await WhatsAppAuth.distinct('sessionId', { key: 'creds' });
    const now = Date.now();

    for (const uId of sessionsWithCreds) {
      if (pairingInProgress[uId]) continue;

      const cooldown = healFailureCooldowns.get(String(uId));
      if (cooldown && now < cooldown.nextAllowedAt) {
        continue;
      }

      const st = getStatus(uId);
      const isDeadSocket = !sessions[uId] || !sessions[uId].ws || sessions[uId].ws.readyState !== 1;

      if (isDeadSocket || (st.status !== STATES.CONNECTED && st.status !== STATES.CONNECTING)) {
        const user = await User.findById(uId).select('phone').lean();
        console.log(`[WA-Heartbeat] Auto-healing offline WhatsApp session for user ${uId}...`);
        try {
          await restoreSession(uId, user?.phone || 'whatsapp');
          healFailureCooldowns.delete(String(uId));
        } catch (err) {
          const failCount = (cooldown?.failCount || 0) + 1;
          const cooldownMs = Math.min(60000 * Math.pow(2, Math.min(failCount - 1, 4)), 600000);
          healFailureCooldowns.set(String(uId), { nextAllowedAt: now + cooldownMs, failCount });
          console.warn(`[WA-Heartbeat] Session heal retry notice for ${uId}:`, err.message);
        }
      } else {
        healFailureCooldowns.delete(String(uId));
      }
    }
  } catch (e) {
    // Silent background recovery
  } finally {
    isHeartbeatRunning = false;
  }
}, 30000);

if (heartbeatTimer && heartbeatTimer.unref) {
  heartbeatTimer.unref();
}

// Graceful Process Termination (does NOT treat server shutdown as user logout!)
const handleGracefulShutdown = async (signal) => {
  console.log(`\n[WA] Received ${signal}. Closing Baileys WebSockets cleanly without logging out...`);
  const activeIds = Object.keys(sessions);
  for (const uId of activeIds) {
    try {
      const sock = sessions[uId];
      if (sock) {
        sock.end();
      }
      await WhatsAppSessionState.updateOne(
        { sessionId: uId },
        {
          $set: {
            status: 'DISCONNECTED',
            lastDisconnectAt: new Date(),
            lastDisconnectReason: 'server_shutdown',
          },
        }
      ).catch(() => {});
    } catch {}
  }
};

process.once('SIGINT', () => handleGracefulShutdown('SIGINT'));
process.once('SIGTERM', () => handleGracefulShutdown('SIGTERM'));

module.exports = {
  STATES,
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
