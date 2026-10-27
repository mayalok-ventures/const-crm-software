import api from './api';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const isPushSupported = () => {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
};

export const getPushPermissionState = () => {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
};

export const checkIsPushSubscribed = async () => {
  if (!isPushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
};

export const subscribeToWebPush = async () => {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported by this browser');
  }

  // Request user permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted');
  }

  // Fetch VAPID Public Key from CRM Backend
  const res = await api.get('/notifications/push/vapid-key');
  const publicKey = res.data.publicKey;
  if (!publicKey) {
    throw new Error('VAPID public key unavailable from server');
  }

  const reg = await navigator.serviceWorker.ready;
  let subscription = await reg.pushManager.getSubscription();

  // If already subscribed, ensure server is up to date
  if (!subscription) {
    const convertedKey = urlBase64ToUint8Array(publicKey);
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedKey,
    });
  }

  const subJson = subscription.toJSON();
  await api.post('/notifications/push/subscribe', {
    subscription: subJson,
  });

  return subscription;
};

export const unsubscribeFromWebPush = async () => {
  if (!isPushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await sub.unsubscribe();
      await api.post('/notifications/push/unsubscribe', {
        endpoint: sub.endpoint,
      }).catch(() => {});
    }
    return true;
  } catch {
    return false;
  }
};
