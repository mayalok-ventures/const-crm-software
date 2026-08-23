import { IExternalIntegration, IntegrationStatus } from '../models/ExternalIntegration';
export declare class IntegrationTelemetryService {
    private static instance;
    static getInstance(): IntegrationTelemetryService;
    /**
     * Sanitizes error messages to strictly prevent credentials or sensitive tokens leaking into DB
     */
    sanitizeError(errorText?: string): string;
    /**
     * Calculates health score (0 - 100) and operational status
     */
    calculateHealthScore(data: {
        errorRate: number;
        latency: number;
        consecutiveFailures: number;
        isConfigured: boolean;
        totalRequests: number;
    }): {
        score: number;
        status: IntegrationStatus;
    };
    /**
     * Ingests real application traffic telemetry or safe test probe results
     */
    recordCall(provider: string, service: string, options: {
        success: boolean;
        latencyMs: number;
        error?: string;
        statusCode?: number;
        isRealTraffic?: boolean;
    }): Promise<IExternalIntegration | null>;
    /**
     * Performs safe, non-metered reachability / status check for a provider
     */
    performSafeProbe(provider: string): Promise<{
        ok: boolean;
        latencyMs: number;
        message: string;
        statusCode?: number;
    }>;
    private pingHttp;
    private getDefaultName;
    private getDefaultService;
    private getDefaultCategory;
}
export declare const integrationTelemetryService: IntegrationTelemetryService;
