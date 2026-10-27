const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');

// VAPID Configuration with resilient dev fallback
let vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
let vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:support@sahyakcrm.com';

// Generate consistent fallback keys for local development if not configured in .env
if (!vapidPublicKey || !vapidPrivateKey) {
  console.log('[WebPush] No VAPID keys detected in environment. Generating local development VAPID pair...');
  try {
    const generated = webpush.generateVAPIDKeys();
    vapidPublicKey = generated.publicKey;
    vapidPrivateKey = generated.privateKey;
    console.log('[WebPush] ✅ Ephemeral VAPID keys generated for dev testing.');
  } catch (err) {
    console.warn('[WebPush] Could not generate VAPID keys:', err.message);
  }
}

if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    console.log('[WebPush] ✅ VAPID configuration registered successfully.');
  } catch (err) {
    console.warn('[WebPush] VAPID registration warning:', err.message);
  }
}

/**
 * Returns the active VAPID public key for frontend subscription registration.
 */
const getVapidPublicKey = () => {
  return vapidPublicKey || null;
};

/**
 * Register or update a device push subscription for a user.
 */
const subscribe = async (userId, subscriptionData, userAgent = '', platform = '', workspaceId = null, companyId = null) => {
  if (!subscriptionData || !subscriptionData.endpoint || !subscriptionData.keys) {
    throw new Error('Invalid push subscription payload');
  }

  const { endpoint, keys } = subscriptionData;
  if (!keys.p256dh || !keys.auth) {
    throw new Error('Push subscription keys (p256dh and auth) are required');
  }

  const sub = await PushSubscription.findOneAndUpdate(
    { endpoint },
    {
      $set: {
        userId,
        workspaceId,
        companyId,
        endpoint,
        keys: {
          p256dh: keys.p256dh,
          auth: keys.auth,
        },
        deviceInfo: {
          userAgent: userAgent || '',
          platform: platform || '',
        },
        isActive: true,
        failedAttempts: 0,
        updatedAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );

  return sub;
};

/**
 * Unsubscribe a device push subscription.
 */
const unsubscribe = async (userId, endpoint) => {
  const result = await PushSubscription.deleteOne({
    userId,
    endpoint,
  });
  return result.deletedCount > 0;
};

/**
 * Dispatch Web Push payload to all active subscriptions of a user.
 * Automatically cleans up expired/unregistered endpoints (HTTP 410 / 404).
 */
const sendPushNotification = async (userId, payload) => {
  if (!vapidPublicKey || !vapidPrivateKey) {
    return { success: false, reason: 'VAPID not configured', sentCount: 0 };
  }

  const subs = await PushSubscription.find({ userId, isActive: true }).lean();
  if (!subs || subs.length === 0) {
    return { success: true, sentCount: 0, reason: 'No active push subscriptions' };
  }

  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
  let sentCount = 0;
  let failedCount = 0;
  const expiredEndpoints = [];

  const promises = subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: sub.keys,
        },
        payloadString,
        {
          TTL: 60 * 60 * 24, // 24 hours
          urgency: 'high',
        }
      );
      sentCount++;
      await PushSubscription.updateOne(
        { _id: sub._id },
        { $set: { lastSuccessAt: new Date(), failedAttempts: 0 } }
      ).catch(() => {});
    } catch (err) {
      failedCount++;
      const statusCode = err.statusCode;
      // 404 Not Found or 410 Gone means device uninstalled PWA or revoked permission
      if (statusCode === 404 || statusCode === 410) {
        expiredEndpoints.push(sub.endpoint);
      } else {
        await PushSubscription.updateOne(
          { _id: sub._id },
          { $inc: { failedAttempts: 1 } }
        ).catch(() => {});
      }
    }
  });

  await Promise.allSettled(promises);

  // Prune expired subscriptions immediately
  if (expiredEndpoints.length > 0) {
    await PushSubscription.deleteMany({ endpoint: { $in: expiredEndpoints } }).catch(() => {});
    console.log(`[WebPush] Pruned ${expiredEndpoints.length} expired/revoked device subscriptions.`);
  }

  return {
    success: sentCount > 0 || failedCount === 0,
    sentCount,
    failedCount,
  };
};

module.exports = {
  getVapidPublicKey,
  subscribe,
  unsubscribe,
  sendPushNotification,
};
