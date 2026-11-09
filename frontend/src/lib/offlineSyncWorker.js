/**
 * Offline Mutation Queue Replay Worker (F3.1)
 *
 * Durably processes Dexie `offlineMutationQueue` in FIFO order when connectivity is restored.
 * Prevents lost writes when counselors update lead statuses or fields while offline.
 */

import { localDb } from './db';
import api from './api';

let isReplaying = false;

export async function replayOfflineMutationQueue() {
  if (isReplaying || typeof window === 'undefined' || !navigator.onLine || !localDb) {
    return { replayed: 0, failed: 0 };
  }

  isReplaying = true;
  let replayedCount = 0;
  let failedCount = 0;

  try {
    const pendingMutations = await localDb.offlineMutationQueue
      .where('status')
      .equals('pending')
      .sortBy('createdAt');

    if (!pendingMutations || pendingMutations.length === 0) {
      return { replayed: 0, failed: 0 };
    }

    console.log(`[Offline Sync Worker] Replaying ${pendingMutations.length} queued offline mutations...`);

    for (const item of pendingMutations) {
      if (!navigator.onLine) {
        console.warn('[Offline Sync Worker] Device went offline during replay. Pausing.');
        break;
      }

      try {
        await localDb.offlineMutationQueue.update(item.id, { status: 'replaying' });

        const idempotencyKey = item.idempotencyKey || item.clientTxnId || item.id;
        await api.request({
          url: item.endpoint,
          method: item.method || 'PUT',
          data: item.payload,
          headers: {
            'Idempotency-Key': String(idempotencyKey),
            'X-Idempotency-Key': String(idempotencyKey),
          },
        });

        await localDb.offlineMutationQueue.delete(item.id);
        replayedCount++;
        console.log(`[Offline Sync Worker] Successfully replayed mutation ${item.id} -> ${item.endpoint}`);
      } catch (err) {
        const status = err.response?.status;
        if (status === 401) {
          // Auth expired or invalid: pause replay immediately, preserve pending mutation, and await re-authentication
          console.warn('[Offline Sync Worker] Auth expired during replay. Pausing queue to preserve mutations.');
          await localDb.offlineMutationQueue.update(item.id, { status: 'pending' });
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('auth-expired', { detail: { action: 'offline_replay_paused' } }));
          }
          break;
        } else if (status === 409 || status === 404 || status === 400) {
          // Conflict / Already updated or non-recoverable client error
          console.warn(`[Offline Sync Worker] Mutation ${item.id} skipped with status ${status}:`, err.message);
          await localDb.offlineMutationQueue.delete(item.id);
          failedCount++;
        } else if (!navigator.onLine || err.code === 'ERR_NETWORK') {
          // Re-queue as pending to retry on next reconnect
          await localDb.offlineMutationQueue.update(item.id, { status: 'pending' });
          break;
        } else {
          // Server error 500: mark as error to avoid blocking whole queue
          await localDb.offlineMutationQueue.update(item.id, { status: 'failed', lastError: err.message });
          failedCount++;
        }
      }
    }
  } catch (queueErr) {
    console.warn('[Offline Sync Worker] Queue read error:', queueErr.message);
  } finally {
    isReplaying = false;
  }

  return { replayed: replayedCount, failed: failedCount };
}

export function initOfflineSyncWorker() {
  if (typeof window === 'undefined') return () => {};

  const handleOnline = () => {
    console.log('[Offline Sync Worker] Network online detected. Triggering queue replay...');
    replayOfflineMutationQueue();
  };

  window.addEventListener('online', handleOnline);

  // Trigger initial replay if already online
  if (navigator.onLine) {
    replayOfflineMutationQueue();
  }

  return () => {
    window.removeEventListener('online', handleOnline);
  };
}

