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
