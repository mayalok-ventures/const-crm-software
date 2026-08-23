import { Request, Response, NextFunction } from 'express';
import { ApiKeyService } from '../monitoring/apikeys/apiKeyService';

export interface IApiKeyRequest extends Request {
  apiKey?: any;
  organizationId?: any;
  user?: any;
}

/**
 * Middleware that authenticates incoming requests using API Keys
 * Supports:
 * - Header `X-API-Key: crm_live_...`
 * - Header `Authorization: Bearer crm_live_...`
 * - Header `Authorization: ApiKey crm_live_...`
 */
export const authenticateApiKey = async (req: IApiKeyRequest, res: Response, next: NextFunction) => {
  try {
    let rawKey: string | undefined;

    const xApiKey = req.headers['x-api-key'] as string;
    const authHeader = req.headers['authorization'];

    if (xApiKey) {
      rawKey = xApiKey;
    } else if (authHeader) {
      if (authHeader.startsWith('Bearer ') && (authHeader.includes('crm_live_') || authHeader.includes('crm_test_'))) {
        rawKey = authHeader.split(' ')[1];
      } else if (authHeader.startsWith('ApiKey ')) {
        rawKey = authHeader.split(' ')[1];
      }
    }

    if (!rawKey) {
      return next(); // Let JWT protect middleware handle it if no API key present
    }

    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    const endpoint = req.originalUrl || req.path;
    const method = req.method;

    const validation = await ApiKeyService.validateApiKey(rawKey, {
      ip,
      userAgent,
      endpoint,
      method,
    });

    if (!validation.valid) {
      const statusCode =
        validation.code === 'RATE_LIMIT_EXCEEDED'
          ? 429
          : validation.code === 'KEY_REVOKED' ||
            validation.code === 'KEY_SUSPENDED' ||
            validation.code === 'KEY_EXPIRED' ||
            validation.code === 'IP_NOT_AUTHORIZED'
          ? 403
          : 401;

      return res.status(statusCode).json({
        code: validation.code,
        message: validation.message,
      });
    }

    // Attach API Key and Organization context
    req.apiKey = validation.apiKey;
    req.organizationId = validation.organizationId;
    req.user = {
      _id: validation.organizationId,
      companyId: validation.organizationId,
      name: validation.apiKey?.organizationName || 'API Key User',
      email: validation.apiKey?.createdByEmail || '',
      role: 'api_consumer',
      permissions: validation.permissions || [],
      isApiKey: true,
      apiKeyId: validation.apiKey?.keyId,
    };

    next();
  } catch (err: any) {
    console.error('[ApiKeyAuthMiddleware] Error validating key:', err.message);
    res.status(500).json({ message: 'Internal authentication error' });
  }
};

/**
 * Middleware that verifies that an authenticated API Key has the required permission scope
 */
export const requireApiKeyScope = (requiredScope: string) => {
  return (req: IApiKeyRequest, res: Response, next: NextFunction) => {
    // If request was authenticated via standard JWT session / Superadmin, allow
    if (req.user && (req.user.isAdmin || req.user.role === 'admin' || req.user.role === 'superadmin')) {
      return next();
    }

    // If authenticated via API Key, verify required scope
    if (req.apiKey) {
      const permissions: string[] = req.apiKey.permissions || [];
      const hasFullAccess = permissions.includes('full_access') || permissions.includes('*');
      const hasDirectScope = permissions.includes(requiredScope);

      // Support wildcard parent scope (e.g. leads:* matches leads:read)
      const parentScope = requiredScope.split(':')[0] + ':*';
      const hasWildcardScope = permissions.includes(parentScope);

      if (hasFullAccess || hasDirectScope || hasWildcardScope) {
        return next();
      }

      return res.status(403).json({
        code: 'INSUFFICIENT_SCOPE',
        message: `API Key lacks required permission scope: "${requiredScope}"`,
        requiredScope,
        assignedPermissions: permissions,
      });
    }

    // Standard session flow
    next();
  };
};

export default {
  authenticateApiKey,
  requireApiKeyScope,
};
