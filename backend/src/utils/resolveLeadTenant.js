const mongoose = require('mongoose');

// Shared in-memory memo cache with bounded 10-second TTL to avoid cross-tenant staleness
const memoCache = new Map();
const MEMO_TTL_MS = 10 * 1000;

function getCached(key) {
  const entry = memoCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > MEMO_TTL_MS) {
    memoCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCached(key, value) {
  if (memoCache.size > 2000) {
    const oldestKey = memoCache.keys().next().value;
    memoCache.delete(oldestKey);
  }
  memoCache.set(key, { value, timestamp: Date.now() });
}

/**
 * Resolves verified workspaceId and companyId before creating/saving a lead.
 * Eliminates sequential N+1 database queries in the pre-save hook.
 */
async function resolveLeadTenant({ userId, companyId, workspaceId }, customCache = null) {
  // If workspaceId and valid companyId are already provided, return immediately (zero DB queries)
  if (workspaceId && companyId && String(companyId) !== String(userId)) {
    return { workspaceId, companyId };
  }

  const cacheKey = `${userId || ''}_${companyId || ''}_${workspaceId || ''}`;
  if (customCache && customCache.has(cacheKey)) {
    return customCache.get(cacheKey);
  }
  const cached = getCached(cacheKey);
  if (cached) {
    if (customCache) customCache.set(cacheKey, cached);
    return cached;
  }

  let resolvedWsId = workspaceId || null;
  let resolvedCompId = companyId || null;

  const Workspace = mongoose.models.Workspace || require('../models/Workspace');
  const User = mongoose.models.User || require('../models/User');

  if (userId) {
    const creator = await User.findById(userId).select('companyId companyRole').lean();
    if (creator && creator.companyId && String(creator.companyId) !== String(userId)) {
      resolvedCompId = creator.companyId;
    }
  }

  let ws = null;
  if (!resolvedWsId && userId) {
    ws = await Workspace.findOne({ ownerId: userId, deletedAt: null }).select('_id ownerId').lean();
  }
  if (!ws && resolvedCompId) {
    ws = await Workspace.findOne({ ownerId: resolvedCompId, deletedAt: null }).select('_id ownerId').lean();
  }
  if (!ws && userId) {
    const WorkspaceMembership = mongoose.models.WorkspaceMembership || require('../models/WorkspaceMembership');
    const mem = await WorkspaceMembership.findOne({ userId, status: 'active' }).select('workspaceId').lean();
    if (mem && mem.workspaceId) {
      ws = await Workspace.findById(mem.workspaceId).select('_id ownerId').lean();
    }
  }

  if (ws) {
    if (!resolvedWsId) resolvedWsId = ws._id;
    if ((!resolvedCompId || String(resolvedCompId) === String(userId)) && ws.ownerId) {
      resolvedCompId = ws.ownerId;
    }
  }

  const result = {
    workspaceId: resolvedWsId,
    companyId: resolvedCompId,
  };

  setCached(cacheKey, result);
  if (customCache) customCache.set(cacheKey, result);

  return result;
}

module.exports = { resolveLeadTenant, memoCache };
