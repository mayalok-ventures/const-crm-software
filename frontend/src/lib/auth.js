'use client';

export const getUser = () => {
  if (typeof window === 'undefined') return null;
  try {
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  } catch {
    return null;
  }
};

export const getToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
};

export const setUser = (user) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('user', JSON.stringify(user));
    window.dispatchEvent(new CustomEvent('user-updated', { detail: user }));
  }
};

export const setAuth = (user, token) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('token', token);
    window.dispatchEvent(new CustomEvent('user-updated', { detail: user }));
  }
};

export const clearAuth = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.dispatchEvent(new CustomEvent('user-updated', { detail: null }));
    try {
      const { clearAllQueryCache } = require('@/components/Providers');
      if (clearAllQueryCache) clearAllQueryCache();
    } catch (_) {}
    try {
      const { clearCache } = require('@/lib/api');
      if (clearCache) clearCache();
    } catch (_) {}
  }
};

export const isLoggedIn = () => !!getToken();
export const isAuthenticated = () => !!getToken();

// ─────────────────────────────────────────────────────────────
// ROLE & PERMISSION HELPERS
// ─────────────────────────────────────────────────────────────
export const isSuperAdmin = (user) => {
  if (!user) return false;
  return Boolean(user.role === 'superadmin' || user.isAdmin);
};

export const isOwner = (user) => {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  const role = (user.workspaceRole || user.companyRole || '').toLowerCase();
  if (role === 'owner') return true;
  if (user.workStatus === 'company_owner' || user.workStatus === 'solo_consultant') return true;
  // If no explicit sub-role exists and user has no parent company, user operates as solo owner
  if (!user.companyRole && !user.workspaceRole && !user.companyId) return true;
  return false;
};

export const isManager = (user) => {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  const role = (user.workspaceRole || user.companyRole || '').toLowerCase();
  return role === 'manager';
};

export const isCounselor = (user) => {
  if (!user) return false;
  const role = (user.workspaceRole || user.companyRole || user.workStatus || user.role || '').toLowerCase();
  return role === 'counsellor' || role === 'counselor' || role === 'agent' || role === 'telecaller';
};

export const isCounsellor = isCounselor;
export const isAgent = (user) => isCounselor(user);

export const isRealEstateTenant = () => false;

export const getUserRole = (user) => {
  if (!user) return 'ANONYMOUS';
  if (isSuperAdmin(user)) return 'SUPERADMIN';
  if (isOwner(user)) return 'OWNER';
  if (isManager(user)) return 'MANAGER';
  if (isCounselor(user)) return 'COUNSELLOR';
  return 'USER';
};

/**
 * Background silent user state synchronization with backend API.
 * Ensures local plan, subscriptionLifecycle, and limits match live database state.
 */
export const syncUser = async () => {
  if (typeof window === 'undefined') return null;
  const token = getToken();
  if (!token) return null;

  try {
    const { cachedGet } = await import('@/lib/api');
    const res = await cachedGet('/auth/me', { ttl: 30000 });
    const data = res?.data;
    if (data) {
      setUser(data);
      return data;
    }
  } catch (err) {
    console.warn('[AuthSync] Background user sync notice:', err.message);
  }
  return getUser();
};

// Build WhatsApp deeplink
export const waLink = (phone, text = '') => {
  const clean = phone.replace(/\D/g, '');
  const num = clean.startsWith('91') ? clean : `91${clean}`;
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
};

// Merge template text with lead data
export const mergeTemplate = (text, lead) => {
  return text
    .replace(/\{name\}/gi, lead.name || '')
    .replace(/\{phone\}/gi, lead.phone || '')
    .replace(/\{company\}/gi, lead.company || '')
    .replace(/\{status\}/gi, lead.status || '');
};
