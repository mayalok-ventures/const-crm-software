import { Request, Response, NextFunction } from 'express';
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
export declare const authenticateApiKey: (req: IApiKeyRequest, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
/**
 * Middleware that verifies that an authenticated API Key has the required permission scope
 */
export declare const requireApiKeyScope: (requiredScope: string) => (req: IApiKeyRequest, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
declare const _default: {
    authenticateApiKey: (req: IApiKeyRequest, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
    requireApiKeyScope: (requiredScope: string) => (req: IApiKeyRequest, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
};
export default _default;
