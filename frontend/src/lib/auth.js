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

export const isAuditor = (user) => {
  if (!user) return false;
  const role = (user.workspaceRole || user.companyRole || user.role || '').toLowerCase();
  return role === 'auditor';
};

export const getUserRole = (user) => {
  if (!user) return 'ANONYMOUS';
  if (isSuperAdmin(user)) return 'SUPERADMIN';
  if (isOwner(user)) return 'OWNER';
  if (isManager(user)) return 'MANAGER';
  if (isAuditor(user)) return 'AUDITOR';
  if (isCounselor(user)) return 'COUNSELLOR';
  return 'USER';
};

// ─────────────────────────────────────────────────────────────
// CANONICAL DEFAULT ROLE PERMISSIONS (Aligned with Backend)
// ─────────────────────────────────────────────────────────────
export const DEFAULT_ROLE_PERMISSIONS = {
  owner: [
    { key: 'leads.view', scope: 'workspace' },
    { key: 'leads.create', scope: 'workspace' },
    { key: 'leads.edit', scope: 'workspace' },
    { key: 'leads.delete', scope: 'workspace' },
    { key: 'leads.assign', scope: 'workspace' },
    { key: 'leads.transfer', scope: 'workspace' },
    { key: 'leads.export', scope: 'workspace' },
    { key: 'leads.view_sensitive', scope: 'workspace' },
    { key: 'leads.view_documents', scope: 'workspace' },
    { key: 'activities.view', scope: 'workspace' },
    { key: 'activities.create', scope: 'workspace' },
    { key: 'followups.create', scope: 'workspace' },
    { key: 'followups.reschedule', scope: 'workspace' },
    { key: 'followups.complete', scope: 'workspace' },
    { key: 'followups.delete', scope: 'workspace' },
    { key: 'pipelines.view', scope: 'workspace' },
    { key: 'pipelines.manage', scope: 'workspace' },
    { key: 'catalogue.view_master', scope: 'workspace' },
    { key: 'catalogue.manage_workspace', scope: 'workspace' },
    { key: 'catalogue.edit_fees', scope: 'workspace' },
    { key: 'catalogue.view_commission', scope: 'workspace' },
    { key: 'whatsapp.view', scope: 'workspace' },
    { key: 'whatsapp.send_one_to_one', scope: 'workspace' },
    { key: 'whatsapp.manage_templates', scope: 'workspace' },
    { key: 'whatsapp.manage_account', scope: 'workspace' },
    { key: 'whatsapp.manage_integrations', scope: 'workspace' },
    { key: 'campaigns.view', scope: 'workspace' },
    { key: 'campaigns.launch', scope: 'workspace' },
    { key: 'campaigns.manage', scope: 'workspace' },
    { key: 'campaigns.cancel', scope: 'workspace' },
    { key: 'integrations.view', scope: 'workspace' },
    { key: 'integrations.manage', scope: 'workspace' },
    { key: 'email.view', scope: 'workspace' },
    { key: 'email.send', scope: 'workspace' },
    { key: 'email.manage_accounts', scope: 'workspace' },
    { key: 'email.manage_templates', scope: 'workspace' },
    { key: 'email.campaigns', scope: 'workspace' },
    { key: 'deals.view', scope: 'workspace' },
    { key: 'deals.create', scope: 'workspace' },
    { key: 'deals.edit', scope: 'workspace' },
    { key: 'deals.delete', scope: 'workspace' },
    { key: 'commission.view', scope: 'workspace' },
    { key: 'commission.edit', scope: 'workspace' },
    { key: 'finance.export', scope: 'workspace' },
    { key: 'forms.view', scope: 'workspace' },
    { key: 'forms.manage', scope: 'workspace' },
    { key: 'reports.view', scope: 'workspace' },
    { key: 'reports.export', scope: 'workspace' },
    { key: 'members.view', scope: 'workspace' },
    { key: 'members.invite', scope: 'workspace' },
    { key: 'members.edit_role', scope: 'workspace' },
    { key: 'members.deactivate', scope: 'workspace' },
    { key: 'roles.manage', scope: 'workspace' },
    { key: 'workspace.settings.edit', scope: 'workspace' },
    { key: 'billing.manage', scope: 'workspace' },
    { key: 'audit.view', scope: 'workspace' },
    { key: 'automations.view', scope: 'workspace' },
    { key: 'automations.manage', scope: 'workspace' },
  ],
  manager: [
    { key: 'leads.view', scope: 'workspace' },
    { key: 'leads.create', scope: 'workspace' },
    { key: 'leads.edit', scope: 'workspace' },
    { key: 'leads.assign', scope: 'workspace' },
    { key: 'leads.transfer', scope: 'workspace' },
    { key: 'leads.export', scope: 'workspace' },
    { key: 'leads.view_sensitive', scope: 'workspace' },
    { key: 'leads.view_documents', scope: 'workspace' },
    { key: 'activities.view', scope: 'workspace' },
    { key: 'activities.create', scope: 'workspace' },
    { key: 'followups.create', scope: 'workspace' },
    { key: 'followups.reschedule', scope: 'workspace' },
    { key: 'followups.complete', scope: 'workspace' },
    { key: 'pipelines.view', scope: 'workspace' },
    { key: 'pipelines.manage', scope: 'workspace' },
    { key: 'catalogue.view_master', scope: 'workspace' },
    { key: 'catalogue.manage_workspace', scope: 'workspace' },
    { key: 'catalogue.edit_fees', scope: 'workspace' },
    { key: 'catalogue.view_commission', scope: 'workspace' },
    { key: 'whatsapp.view', scope: 'workspace' },
    { key: 'whatsapp.send_one_to_one', scope: 'workspace' },
    { key: 'whatsapp.manage_templates', scope: 'workspace' },
    { key: 'campaigns.view', scope: 'workspace' },
    { key: 'campaigns.launch', scope: 'workspace' },
    { key: 'campaigns.manage', scope: 'workspace' },
    { key: 'email.view', scope: 'workspace' },
    { key: 'email.send', scope: 'workspace' },
    { key: 'email.manage_accounts', scope: 'workspace' },
    { key: 'email.manage_templates', scope: 'workspace' },
    { key: 'email.campaigns', scope: 'workspace' },
    { key: 'deals.view', scope: 'workspace' },
    { key: 'deals.create', scope: 'workspace' },
    { key: 'deals.edit', scope: 'workspace' },
    { key: 'deals.delete', scope: 'workspace' },
    { key: 'commission.view', scope: 'workspace' },
    { key: 'forms.view', scope: 'workspace' },
    { key: 'forms.manage', scope: 'workspace' },
    { key: 'reports.view', scope: 'workspace' },
    { key: 'reports.export', scope: 'workspace' },
    { key: 'members.view', scope: 'workspace' },
    { key: 'members.invite', scope: 'workspace' },
    { key: 'audit.view', scope: 'workspace' },
    { key: 'automations.view', scope: 'workspace' },
    { key: 'automations.manage', scope: 'workspace' },
  ],
  counsellor: [
    { key: 'leads.view', scope: 'own' },
    { key: 'leads.create', scope: 'workspace' },
    { key: 'leads.edit', scope: 'own' },
    { key: 'leads.view_documents', scope: 'own' },
    { key: 'activities.view', scope: 'own' },
    { key: 'activities.create', scope: 'workspace' },
    { key: 'followups.create', scope: 'own' },
    { key: 'followups.reschedule', scope: 'own' },
    { key: 'followups.complete', scope: 'own' },
    { key: 'pipelines.view', scope: 'workspace' },
    { key: 'catalogue.view_master', scope: 'workspace' },
    { key: 'catalogue.manage_workspace', scope: 'workspace' },
    { key: 'whatsapp.view', scope: 'own' },
    { key: 'whatsapp.send_one_to_one', scope: 'own' },
    { key: 'email.view', scope: 'own' },
    { key: 'email.send', scope: 'own' },
    { key: 'deals.view', scope: 'own' },
    { key: 'deals.create', scope: 'own' },
    { key: 'forms.view', scope: 'workspace' },
    { key: 'automations.view', scope: 'workspace' },
    { key: 'campaigns.view', scope: 'workspace' },
  ],
  auditor: [
    { key: 'leads.view', scope: 'workspace' },
    { key: 'activities.view', scope: 'workspace' },
    { key: 'pipelines.view', scope: 'workspace' },
    { key: 'deals.view', scope: 'workspace' },
    { key: 'commission.view', scope: 'workspace' },
    { key: 'campaigns.view', scope: 'workspace' },
    { key: 'reports.view', scope: 'workspace' },
    { key: 'members.view', scope: 'workspace' },
    { key: 'audit.view', scope: 'workspace' },
    { key: 'automations.view', scope: 'workspace' },
  ],
};
DEFAULT_ROLE_PERMISSIONS.counselor = DEFAULT_ROLE_PERMISSIONS.counsellor;

// Scope hierarchy: workspace > team > own
const SCOPE_LEVELS = { workspace: 3, team: 2, own: 1, restricted: 0 };

/**
 * Authoritative Central Permission Check
 * Evaluates effective permissions for a user against key and required scope.
 * Fails closed if user is null/undefined.
 */
export const hasPermission = (user, permissionKey, requiredScope = null) => {
  if (!user || !permissionKey) return false;

  // Unknown permission keys fail closed safely (cannot be granted even to owner/superadmin)
  const isKnownKey = DEFAULT_ROLE_PERMISSIONS.owner?.some((p) =>
    typeof p === 'string' ? p === permissionKey : p?.key === permissionKey
  );
  if (!isKnownKey) return false;

  if (isSuperAdmin(user)) return true;
  if (isOwner(user)) return true;

  // Retrieve effective permissions attached to user or fallback to role defaults
  let permissions = user.effectivePermissions || user.membership?.effectivePermissions;
  if (!Array.isArray(permissions) || permissions.length === 0) {
    const rawRole = (user.workspaceRole || user.companyRole || user.role || 'counsellor').toLowerCase();
    const mappedRole = rawRole === 'counselor' ? 'counsellor' : rawRole;
    permissions = DEFAULT_ROLE_PERMISSIONS[mappedRole] || DEFAULT_ROLE_PERMISSIONS.counsellor;
  }

  const match = permissions.find((p) => {
    if (typeof p === 'string') return p === permissionKey;
    return p?.key === permissionKey;
  });

  if (!match) return false;
  if (!requiredScope) return true;

  const matchScope = typeof match === 'object' && match.scope ? match.scope : 'workspace';
  const memberLevel = SCOPE_LEVELS[matchScope] || 0;
  const reqLevel = SCOPE_LEVELS[requiredScope] || 0;

  return memberLevel >= reqLevel;
};

/**
 * Route-Level Access Check
 * Determines if user can view/navigate to a given route.
 */
export const canAccessRoute = (user, routePath) => {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;

  const cleanPath = (routePath || '').split('?')[0].replace(/\/$/, '') || '/';

  switch (cleanPath) {
    case '':
    case '/':
    case '/dashboard':
    case '/profile':
    case '/notifications':
      return true;

    case '/leads':
      return hasPermission(user, 'leads.view');

    case '/pipeline':
      return hasPermission(user, 'pipelines.view');

    case '/follow-ups':
      return (
        hasPermission(user, 'activities.view') ||
        hasPermission(user, 'followups.create') ||
        hasPermission(user, 'followups.complete')
      );

    case '/catalogue':
    case '/colleges':
      return (
        hasPermission(user, 'catalogue.view_master') ||
        hasPermission(user, 'catalogue.manage_workspace')
      );

    case '/whatsapp':
      return hasPermission(user, 'whatsapp.view');

    case '/email':
      return hasPermission(user, 'email.view');

    case '/deals':
    case '/commission':
      return hasPermission(user, 'deals.view');

    case '/analytics':
      return hasPermission(user, 'reports.view');

    case '/campaigns':
    case '/groups':
      return (
        hasPermission(user, 'campaigns.view') ||
        isOwner(user) ||
        isManager(user) ||
        isSuperAdmin(user) ||
        isCounselor(user)
      );

    case '/templates':
      return (
        hasPermission(user, 'whatsapp.manage_templates') ||
        hasPermission(user, 'email.manage_templates')
      );

    case '/forms':
      return hasPermission(user, 'forms.view') || hasPermission(user, 'forms.manage');

    case '/automations':
      return isOwner(user) || hasPermission(user, 'automations.view') || hasPermission(user, 'automations.manage');

    case '/integrations':
      return isOwner(user) || hasPermission(user, 'integrations.manage') || hasPermission(user, 'integrations.view');

    case '/workspace':
      return (
        isOwner(user) ||
        hasPermission(user, 'members.view') ||
        hasPermission(user, 'workspace.settings.edit')
      );

    case '/workspace/team':
      return isOwner(user) || hasPermission(user, 'members.view');

    case '/workspace/roles':
      return isOwner(user) || hasPermission(user, 'roles.manage');

    case '/plans':
      return isOwner(user) || hasPermission(user, 'billing.manage');

    case '/admin':
    case '/superadmin-dashboard':
      return isSuperAdmin(user);

    default:
      return true;
  }
};

/**
 * Action-Level Access Check with Optional Resource Scope Evaluation
 */
export const canPerformAction = (user, permissionKey, resource = null) => {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  if (isOwner(user)) return true;

  if (!hasPermission(user, permissionKey)) return false;

  // If resource is provided and user only has 'own' scope for this permission
  if (resource && !hasPermission(user, permissionKey, 'workspace')) {
    const userId = String(user._id || user.id || '');
    const resOwnerId = String(
      resource.assignedTo?._id ||
      resource.assignedTo ||
      resource.userId?._id ||
      resource.userId ||
      resource.currentOwnerId ||
      resource.createdById ||
      ''
    );
    if (resOwnerId && resOwnerId !== userId) {
      return false;
    }
  }

  return true;
};

/**
 * Field-Level Sensitivity Check
 */
export const canViewField = (user, fieldKey) => {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  if (isOwner(user)) return true;

  switch (fieldKey) {
    case 'commission':
    case 'customTieUpDetails':
      return (
        hasPermission(user, 'commission.view') ||
        hasPermission(user, 'catalogue.view_commission')
      );

    case 'sensitiveNotes':
    case 'confidentialMarks':
      return hasPermission(user, 'leads.view_sensitive');

    case 'documents':
      return hasPermission(user, 'leads.view_documents');

    case 'fees':
    case 'edit_fees':
      return hasPermission(user, 'catalogue.edit_fees');

    default:
      return true;
  }
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
    const res = await cachedGet('/auth/me', { ttl: 30000, silentAuth: true, _isBackground: true });
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
