/**
 * Realtime Event Dispatcher
 * Dispatches notifications and chat events to connected web clients.
 */

const broadcastNotification = (userId, payload) => {
  // In-memory / SSE / Socket.IO bridge
  try {
    if (global.io && userId) {
      global.io.to(`user_${userId.toString()}`).emit('notification', payload);
    }
  } catch (err) {
    console.warn('[Realtime] Broadcast notification notice:', err.message);
  }
};

const broadcastChatMessage = (userId, payload) => {
  try {
    if (global.io && userId) {
      global.io.to(`user_${userId.toString()}`).emit('chat_message', payload);
    }
  } catch (err) {
    console.warn('[Realtime] Broadcast chat message notice:', err.message);
  }
};

module.exports = {
  broadcastNotification,
  broadcastChatMessage,
};
