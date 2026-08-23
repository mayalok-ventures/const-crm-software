import { Request, Response } from 'express';
export declare class ApiKeyController {
    /**
     * GET /api/admin/apikeys/overview
     */
    static getOverview(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/admin/apikeys
     */
    static getKeys(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/admin/apikeys
     */
    static createKey(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/admin/apikeys/:id
     */
    static getKeyById(req: Request, res: Response): Promise<void>;
    /**
     * PUT /api/admin/apikeys/:id
     */
    static updateKey(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/admin/apikeys/:id/rotate
     */
    static rotateKey(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/admin/apikeys/:id/revoke
     */
    static revokeKey(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/admin/apikeys/:id/suspend
     */
    static suspendKey(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/admin/apikeys/:id/reactivate
     */
    static reactivateKey(req: Request, res: Response): Promise<void>;
    /**
     * DELETE /api/admin/apikeys/:id
     */
    static deleteKey(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/admin/apikeys/alerts
     */
    static getAlerts(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/admin/apikeys/alerts/:id/resolve
     */
    static resolveAlert(req: Request, res: Response): Promise<void>;
}
export declare const apiKeyController: typeof ApiKeyController;
export default ApiKeyController;
