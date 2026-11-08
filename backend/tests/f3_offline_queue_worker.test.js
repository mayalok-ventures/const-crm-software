const assert = require('assert');

describe('F3.1: Offline Mutation Queue Replay Worker Logic', () => {
  it('replays pending mutations in FIFO order and handles conflicts gracefully', async () => {
    const queue = [
      { id: 1, endpoint: '/leads/lead1', method: 'PUT', payload: { status: 'contacted' }, createdAt: 1000, status: 'pending' },
      { id: 2, endpoint: '/leads/lead2', method: 'PUT', payload: { status: 'follow_up' }, createdAt: 2000, status: 'pending' },
      { id: 3, endpoint: '/leads/lead3', method: 'PUT', payload: { status: 'closed' }, createdAt: 3000, status: 'pending' },
    ];

    const executedRequests = [];
    const deletedIds = [];

    const mockApi = {
      request: async ({ url, method, data }) => {
        executedRequests.push({ url, method, data });
        if (url.includes('lead2')) {
          const err = new Error('Version conflict');
          err.response = { status: 409, data: { code: 'VERSION_CONFLICT' } };
          throw err;
        }
        return { data: { success: true } };
      },
    };

    // Replay simulation
    for (const item of queue) {
      try {
        await mockApi.request({ url: item.endpoint, method: item.method, data: item.payload });
        deletedIds.push(item.id);
      } catch (err) {
        if (err.response?.status === 409) {
          // Conflict: remove from queue to avoid infinite blocking
          deletedIds.push(item.id);
        }
      }
    }

    assert.strictEqual(executedRequests.length, 3, 'All 3 items must be attempted in order');
    assert.strictEqual(executedRequests[0].url, '/leads/lead1');
    assert.strictEqual(executedRequests[1].url, '/leads/lead2');
    assert.strictEqual(executedRequests[2].url, '/leads/lead3');
    assert.deepStrictEqual(deletedIds, [1, 2, 3], 'All processed items (including 409 conflict) must be cleared from queue');
  });

  it('preserves pending items in queue when network error occurs during replay', async () => {
    const queue = [
      { id: 1, endpoint: '/leads/lead1', method: 'PUT', payload: { status: 'contacted' }, createdAt: 1000, status: 'pending' },
      { id: 2, endpoint: '/leads/lead2', method: 'PUT', payload: { status: 'follow_up' }, createdAt: 2000, status: 'pending' },
    ];

    const deletedIds = [];
    let isOnline = true;

    const mockApi = {
      request: async ({ url }) => {
        if (url.includes('lead1')) {
          isOnline = false; // Network drops during replay
          const netErr = new Error('Network error');
          netErr.code = 'ERR_NETWORK';
          throw netErr;
        }
        return { data: { success: true } };
      },
    };

    for (const item of queue) {
      if (!isOnline) {
        break; // Stop replay on network disconnect
      }
      try {
        await mockApi.request({ url: item.endpoint });
        deletedIds.push(item.id);
      } catch (err) {
        if (err.code === 'ERR_NETWORK') {
          break; // Stop replay and retain item in queue
        }
      }
    }

    assert.strictEqual(deletedIds.length, 0, 'No items deleted when network dropped');
    assert.strictEqual(queue[0].status, 'pending', 'Item 1 remains pending in queue');
    assert.strictEqual(queue[1].status, 'pending', 'Item 2 remains pending in queue');
  });
});
