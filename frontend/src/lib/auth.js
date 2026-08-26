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
  }
};

export const isLoggedIn = () => !!getToken();

// ─────────────────────────────────────────────────────────────
// ROLE & PERMISSION HIERARCHY HELPERS (RBAC)
// ─────────────────────────────────────────────────────────────
export const isSuperAdmin = (user) => {
  if (!user) return false;
  return Boolean(user.role === 'superadmin' || user.isAdmin);
};

export const isOwner = (user) => {
  if (!user) return false;
  if (isSuperAdmin(user)) return false;
  return Boolean(
    user.workStatus === 'company_owner' ||
    user.companyRole === 'owner' ||
    user.role === 'admin' ||
    user.roleId?.roleType === 'OWNER'
  );
};

export const isManager = (user) => {
  if (!user) return false;
  if (isSuperAdmin(user) || isOwner(user)) return false;
  return Boolean(
    user.companyRole === 'manager' ||
    user.role === 'manager' ||
    user.roleId?.roleType === 'MANAGER'
  );
};

export const isAgent = (user) => {
  if (!user) return false;
  if (isSuperAdmin(user) || isOwner(user) || isManager(user)) return false;
  return Boolean(
    user.companyRole === 'agent' ||
    user.companyRole === 'sales_rep' ||
    user.companyRole === 'telecaller' ||
    user.role === 'agent' ||
    user.workStatus === 'agent' ||
    user.workStatus === 'employee' ||
    user.roleId?.roleType === 'AGENT'
  );
};

export const getUserRole = (user) => {
  if (isSuperAdmin(user)) return 'SUPERADMIN';
  if (isOwner(user)) return 'OWNER';
  if (isManager(user)) return 'MANAGER';
  if (isAgent(user)) return 'AGENT';
  return 'AGENT';
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
    const { default: api } = await import('@/lib/api');
    const { data } = await api.get('/auth/me');
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
