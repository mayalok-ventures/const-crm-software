import { IHealthWeightConfig } from '../models/HealthWeightConfig';
import { IPlatformHealthSnapshot } from '../models/PlatformHealthSnapshot';
export declare class HealthScoreEngine {
    private static instance;
    private cachedConfig;
    private configLastFetched;
    static getInstance(): HealthScoreEngine;
    /**
     * Retrieves active configuration from MongoDB or default fallback with a 60s in-memory cache.
     */
    getConfig(): Promise<IHealthWeightConfig>;
    /**
     * Evaluates the full platform health score across all 12 components.
     */
    evaluatePlatformHealth(): Promise<IPlatformHealthSnapshot>;
    /**
     * Evaluates and persists a snapshot to MongoDB.
     */
    evaluateAndPersistSnapshot(): Promise<IPlatformHealthSnapshot>;
    private evaluateInfrastructure;
    private evaluateAvailability;
    private evaluateApiPerformance;
    private evaluateApiReliability;
    private evaluateDatabase;
    private evaluateSecurity;
    private evaluateStorage;
    private evaluateBackup;
    private evaluateIntegrations;
    private evaluateApplicationErrors;
    private evaluateDeployment;
    private evaluateTenantResources;
}
export declare const healthScoreEngine: HealthScoreEngine;
export default healthScoreEngine;
