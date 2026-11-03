const makeWASocket = require('@whiskeysockets/baileys').default;
const {
  DisconnectReason,
  Browsers,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
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
// Last active timestamp for tracking socket freshness
const lastActivityTimestamps = new Map();

// Instance Identifier for distributed leasing (PM2 Cluster / Multi-process fence)
const INSTANCE_ID = `proc_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;

const MAX_PAIRING_RECONNECTS = 5;
const MAX_CONSECUTIVE_RECONNECTS = 10;
const LEASE_DURATION_MS = 60000; // 60s lease window

// Cache WA version
let cachedWAVersion = null;
let versionFetchedAt = 0;
const VERSION_CACHE_TTL_MS = 30 * 60 * 1000;
const FALLBACK_WA_VERSION = [2, 3000, 1043857760];

// Silent logger implementation compatible with Baileys and makeCacheableSignalKeyStore
const silentLogger = {
  level: 'silent',
  child: () => silentLogger,
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
};

// ── OUTBOUND MESSAGE RATE LIMITING QUEUE ─────────────────────────────────────
// Enforces minimum inter-message delays with natural jitter to prevent WhatsApp rate bans & socket drops
const outboundQueues = new Map();
const isProcessingQueue = new Map();
const MIN_OUTBOUND_DELAY_MS = 1400; // 1.4s minimum delay
const JITTER_MAX_MS = 600;          // +0 to 600ms random jitter

const enqueueOutbound = (sessionId, taskFn) => {
  return new Promise((resolve, reject) => {
    const sId = sessionId.toString();
    if (!outboundQueues.has(sId)) {
      outboundQueues.set(sId, []);
    }
    outboundQueues.get(sId).push({ taskFn, resolve, reject });
    processOutboundQueue(sId);
  });
};

const processOutboundQueue = async (sessionId) => {
  const sId = sessionId.toString();
  if (isProcessingQueue.get(sId)) return;
  isProcessingQueue.set(sId, true);

  const queue = outboundQueues.get(sId);
  while (queue && queue.length > 0) {
    const item = queue.shift();
    try {
      const res = await item.taskFn();
      item.resolve(res);
    } catch (err) {
      item.reject(err);
    }

    if (queue.length > 0) {
      const delay = MIN_OUTBOUND_DELAY_MS + Math.floor(Math.random() * JITTER_MAX_MS);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  isProcessingQueue.set(sId, false);
};

// ── DISTRIBUTED LEASING (PM2 CLUSTER & MULTI-PROCESS FENCING) ────────────────
const acquireLease = async (sessionId) => {
  const sId = sessionId.toString();
  const now = new Date();
  const leaseExpiresAt = new Date(Date.now() + LEASE_DURATION_MS);

  try {
    const acquired = await WhatsAppSessionState.findOneAndUpdate(
      {
        sessionId: sId,
        $or: [
          { leaseOwner: null },
          { leaseOwner: INSTANCE_ID },
          { leaseExpiresAt: { $lt: now } },
          { leaseExpiresAt: null },
        ],
      },
      {
        $set: {
          leaseOwner: INSTANCE_ID,
          leaseExpiresAt,
        },
      },
      { new: true }
    );

    if (!acquired) {
      const current = await WhatsAppSessionState.findOne({ sessionId: sId })
        .select('leaseOwner leaseExpiresAt')
        .lean();
      console.warn(`[WA-Cluster] Session ${sId} is active in another worker (${current?.leaseOwner}). Skipping socket bind in current process.`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[WA-Cluster] Lease acquisition notice for ${sId}:`, err.message);
    return true; // Fallback to allowing in case of non-fatal DB glitch
  }
};

const renewLease = async (sessionId) => {
  try {
    await WhatsAppSessionState.updateOne(
      { sessionId: sessionId.toString(), leaseOwner: INSTANCE_ID },
      { $set: { leaseExpiresAt: new Date(Date.now() + LEASE_DURATION_MS) } }
    );
  } catch (e) {}
};

const releaseLease = async (sessionId) => {
  try {
    await WhatsAppSessionState.updateOne(
      { sessionId: sessionId.toString(), leaseOwner: INSTANCE_ID },
      { $set: { leaseOwner: null, leaseExpiresAt: null } }
    );
  } catch (e) {}
};

const getWAVersion = async (forceRefresh = false) => {
  const now = Date.now();
  if (!forceRefresh && cachedWAVersion && now - versionFetchedAt < VERSION_CACHE_TTL_MS) {
    return cachedWAVersion;
  }
  try {
    const { version } = await fetchLatestBaileysVersion();
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
      leaseExpiresAt: new Date(Date.now() + LEASE_DURATION_MS),
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

/**
 * Socket Configuration Builder
 * Uses in-memory Signal Key Store caching and tuned keep-alive timings
 */
const buildSocketOptions = async (state) => {
  const version = await getWAVersion();
  return {
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, silentLogger),
    },
    printQRInTerminal: false,
    logger: silentLogger,
    browser: Browsers.ubuntu('Chrome'),
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 30000, // 30s ping keeps NAT & proxy connections alive
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
        const { broadcastChatMessage } = require('../utils/realtime');
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

  // Connection Update Event with Smart Reconnect Filter & DisconnectReason Handling
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
      const error = lastDisconnect?.error;
      const statusCode = error?.output?.statusCode;
      const errorMsg = (error?.message || '').toLowerCase();

      const isLoggedOut = statusCode === DisconnectReason.loggedOut;
      const isBadSession = statusCode === DisconnectReason.badSession;
      const isMultideviceMismatch = statusCode === DisconnectReason.multideviceMismatch;
      const isForbidden = statusCode === DisconnectReason.forbidden;
      const isRestartRequired = statusCode === DisconnectReason.restartRequired || statusCode === 515;
      const isConnectionReplaced = statusCode === DisconnectReason.connectionReplaced || statusCode === 440 || errorMsg.includes('conflict');
      const isConnectionClosed = statusCode === DisconnectReason.connectionClosed || statusCode === 428;
      const isTimedOut = statusCode === DisconnectReason.timedOut || statusCode === 408;
      const isUnavailable = statusCode === DisconnectReason.unavailableService || statusCode === 503;
      const isStreamError = errorMsg.includes('stream errored');

      const normalizedReason = isLoggedOut
        ? 'device_logged_out'
        : isBadSession
        ? 'bad_session_corrupted'
        : isRestartRequired
        ? 'restart_required'
        : isConnectionReplaced
        ? 'connection_replaced_conflict'
        : isConnectionClosed
        ? 'connection_closed'
        : isTimedOut
        ? 'timed_out'
        : isStreamError
        ? 'stream_errored'
        : isUnavailable
        ? 'service_unavailable'
        : 'network_drop';

      console.log(`[WA] Socket closed for ${uIdStr}. StatusCode: ${statusCode}, NormalizedReason: ${normalizedReason}`);

      // ──────────────────────────────────────────────────────────────────────────
      // CASE 1: FATAL DISCONNECTS (Clear auth, halt reconnect, notify user)
      // ──────────────────────────────────────────────────────────────────────────
      if (isLoggedOut || isBadSession || isMultideviceMismatch || isForbidden) {
        console.warn(`[WA] Fatal disconnect for ${uIdStr} (${normalizedReason}). Clearing stored credentials.`);
        await releaseLease(uIdStr);
        await persistStateTransition(userId, {
          status: STATES.AUTHENTICATION_REQUIRED,
          lastDisconnectAt: new Date(),
          lastDisconnectReason: normalizedReason,
          requiresAction: true,
          phone: cleanPhone,
          pairingCode: null,
          qrCode: null,
        });
        await disconnect(userId, true, false);
        await notifyWhatsAppDisconnected(userId, cleanPhone, 'Session unlinked from phone or auth expired. Please re-pair.').catch(() => {});
        return;
      }

      // ──────────────────────────────────────────────────────────────────────────
      // CASE 2: CONFLICT / CONNECTION REPLACED (440)
      // Another instance or rapid reload connected; release lease and cool down to avoid thrashing
      // ──────────────────────────────────────────────────────────────────────────
      if (isConnectionReplaced) {
        console.warn(`[WA] Connection replaced/conflict detected for ${uIdStr}. Releasing lease and cooling down.`);
        await releaseLease(uIdStr);
        const attempts = (reconnectAttempts[uIdStr] || 0) + 1;
        reconnectAttempts[uIdStr] = attempts;

        if (attempts > 3) {
          console.warn(`[WA] Repeated connection conflicts for ${uIdStr}. Pausing auto-reconnect to avoid socket fighting.`);
          await persistStateTransition(userId, {
            status: STATES.DEGRADED,
            lastDisconnectAt: new Date(),
            lastDisconnectReason: 'connection_conflict',
            requiresAction: true,
          });
          return;
        }

        // Wait 7.5s before attempting re-acquisition to prevent ping-pong battle
        setTimeout(async () => {
          if (!pairingInProgress[uIdStr]) {
            const canAcquire = await acquireLease(uIdStr);
            if (canAcquire) {
              await restoreSession(userId, cleanPhone).catch(console.error);
            }
          }
        }, 7500);
        return;
      }

      // ──────────────────────────────────────────────────────────────────────────
      // CASE 3: IMMEDIATE RESTART REQUIRED (515)
      // Normal Baileys stream reset or handshake refresh: reconnect quickly in 1.5s
      // ──────────────────────────────────────────────────────────────────────────
      if (isRestartRequired) {
        console.log(`[WA] Server requested restart (515) for ${uIdStr}. Reconnecting in 1.5s...`);
        setTimeout(async () => {
          if (!pairingInProgress[uIdStr]) {
            const canAcquire = await acquireLease(uIdStr);
            if (canAcquire) {
              await restoreSession(userId, cleanPhone).catch(console.error);
            }
          }
        }, 1500);
        return;
      }

      // ──────────────────────────────────────────────────────────────────────────
      // CASE 4: PAIRING IN PROGRESS
      // ──────────────────────────────────────────────────────────────────────────
      if (pairingInProgress[uIdStr]) {
        const pairingAttempt = (pairingReconnectAttempts[uIdStr] || 0) + 1;
        pairingReconnectAttempts[uIdStr] = pairingAttempt;

        if (pairingAttempt > MAX_PAIRING_RECONNECTS) {
          console.warn(`[WA] Pairing attempts exceeded for user ${uIdStr}. Resetting to disconnected.`);
          pairingInProgress[uIdStr] = false;
          delete pairingReconnectAttempts[uIdStr];
          delete pairingCodeLocks[uIdStr];
          await releaseLease(uIdStr);
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

      // ──────────────────────────────────────────────────────────────────────────
      // CASE 5: RECOVERABLE TRANSIENT NETWORK DROPS (428, 408, Stream Errored)
      // Bounded exponential backoff with jitter
      // ──────────────────────────────────────────────────────────────────────────
      const attempts = (reconnectAttempts[uIdStr] || 0) + 1;
      reconnectAttempts[uIdStr] = attempts;

      if (attempts > MAX_CONSECUTIVE_RECONNECTS) {
        console.warn(`[WA] Reconnect attempts exceeded (${attempts}) for user ${uIdStr}. Entering degraded cooldown.`);
        await releaseLease(uIdStr);
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

      // Bounded exponential backoff with jitter (3s to max 60s)
      const baseDelay = Math.min(3000 * Math.pow(1.5, Math.min(attempts, 8)), 60000);
      const jitter = Math.floor(Math.random() * 2000);
      const delayMs = baseDelay + jitter;
      const nextRetryAt = new Date(Date.now() + delayMs);

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
              const canAcquire = await acquireLease(uIdStr);
              if (canAcquire) {
                await restoreSession(userId, cleanPhone);
              }
            }
          }
        } catch (err) {
          console.error(`[WA] Auto-reconnect failed for ${uIdStr}:`, err.message);
        } finally {
          reconnectInProgress[uIdStr] = false;
        }
      }, delayMs);
    } else if (connection === 'open') {
      console.log(`[WA] ✅ Connection confirmed live & authenticated for user ${uIdStr} (${cleanPhone})`);
      const wasReconnecting =
        sessionStates[uIdStr]?.status === STATES.RECONNECTING ||
        sessionStates[uIdStr]?.status === STATES.DEGRADED;

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
      await renewLease(uIdStr);

      if (wasReconnecting) {
        notifyWhatsAppReconnected(userId, cleanPhone).catch(() => {});
      }
    }
  });
};

const restoreSession = async (userId, cleanPhone) => {
  const uIdStr = userId.toString();

  // PM2 Cluster & Multi-process lease fence
  const canAcquire = await acquireLease(uIdStr);
  if (!canAcquire) {
    console.log(`[WA-Cluster] Skipping session restore for ${uIdStr}: managed by another instance.`);
    return false;
  }

  if (sessions[uIdStr]) {
    const old = sessions[uIdStr];
    try {
      old.ev.removeAllListeners();
      old.end();
    } catch (e) {}
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
  return true;
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

  // Acquire lease
  const canAcquire = await acquireLease(uIdStr);
  if (!canAcquire) {
    throw new Error('Another server instance is currently managing this WhatsApp session. Please try again shortly.');
  }

  if (sessions[uIdStr]) {
    const old = sessions[uIdStr];
    delete sessions[uIdStr];
    delete pairingInProgress[uIdStr];
    delete pairingReconnectAttempts[uIdStr];
    try {
      old.ev.removeAllListeners();
      old.end();
    } catch (e) {}
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
    await releaseLease(uIdStr);
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
      sock.ev.removeAllListeners();
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

  await releaseLease(uIdStr);

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
  return enqueueOutbound(userId.toString(), async () => {
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
  });
};

const sendMedia = async (userId, to, mediaArg, callerUserId = null, callerName = null) => {
  return enqueueOutbound(userId.toString(), async () => {
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
  });
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
// Sockets do NOT auto-connect on server launch unless explicitly requested with { force: true }
const initSessions = async (options = {}) => {
  if (!options || !options.force) {
    console.log('⚡ [WA] WhatsApp auto-connect on server launch is disabled (on-demand mode active).');
    return [];
  }

  try {
    const sessionsWithCreds = await WhatsAppAuth.distinct('sessionId', { key: 'creds' });
    console.log(`[WA] Found ${sessionsWithCreds.length} stored WhatsApp credentials in MongoDB. Force restoring...`);

    for (const uId of sessionsWithCreds) {
      const user = await User.findById(uId).select('phone').lean();
      const phoneToUse = user?.phone || 'whatsapp';
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

// Background Heartbeat, Lease Renewal & Zombie Watchdog (Every 30 seconds)
// ONLY monitors sessions that are currently alive in this process; does NOT resurrect offline sessions!
let isHeartbeatRunning = false;
const healFailureCooldowns = new Map();

const heartbeatTimer = setInterval(async () => {
  if (isHeartbeatRunning) return;
  isHeartbeatRunning = true;
  try {
    const activeUserIds = Object.keys(sessions);
    const now = Date.now();

    for (const uId of activeUserIds) {
      if (pairingInProgress[uId]) continue;

      const sock = sessions[uId];
      if (!sock) continue;

      const isLive = sock.ws && sock.ws.readyState === 1;

      if (isLive) {
        // 1. Renew lease for this process
        await renewLease(uId);

        // 2. Zombie socket watchdog: if no activity for 3 minutes, perform lightweight ping/check
        const lastActive = lastActivityTimestamps.get(uId) || now;
        if (now - lastActive > 180000) {
          try {
            if (sock.ws.ping) {
              sock.ws.ping();
            }
          } catch (pingErr) {
            console.warn(`[WA-Heartbeat] Zombie socket detected for user ${uId}. Re-establishing connection...`);
            const user = await User.findById(uId).select('phone').lean();
            await restoreSession(uId, user?.phone || 'whatsapp');
          }
        }
      } else {
        // Socket unexpectedly dropped while session state is active
        const st = sessionStates[uId];
        if (st && st.status !== STATES.DISCONNECTED && st.status !== STATES.AUTHENTICATION_REQUIRED) {
          const cooldown = healFailureCooldowns.get(String(uId));
          if (cooldown && now < cooldown.nextAllowedAt) continue;

          console.log(`[WA-Heartbeat] Recovering dropped connection for active user ${uId}...`);
          try {
            const user = await User.findById(uId).select('phone').lean();
            await restoreSession(uId, user?.phone || 'whatsapp');
            healFailureCooldowns.delete(String(uId));
          } catch (err) {
            const failCount = (cooldown?.failCount || 0) + 1;
            const cooldownMs = Math.min(60000 * Math.pow(2, Math.min(failCount - 1, 4)), 600000);
            healFailureCooldowns.set(String(uId), { nextAllowedAt: now + cooldownMs, failCount });
            console.warn(`[WA-Heartbeat] Session restore error for ${uId}:`, err.message);
          }
        }
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
  console.log(`\n[WA] Received ${signal || 'SIGTERM'}. Closing Baileys WebSockets cleanly without logging out...`);
  const activeIds = Object.keys(sessions);
  for (const uId of activeIds) {
    try {
      const sock = sessions[uId];
      if (sock) {
        sock.ev.removeAllListeners();
        sock.end();
      }
      await releaseLease(uId);
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
  closeAllSessions: handleGracefulShutdown,
  isClientReady: () => Object.values(sessions).some(s => s && s.ws && s.ws.readyState === 1),
};
