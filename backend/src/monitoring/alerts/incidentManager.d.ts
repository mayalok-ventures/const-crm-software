import { IIncident } from '../models/Incident';
import { IAlert } from '../models/Alert';
export declare class IncidentManager {
    private static instance;
    private constructor();
    static getInstance(): IncidentManager;
    /**
     * Correlates an alert into an existing active incident or spawns a new grouped incident
     */
    correlateAndUpsertIncident(alert: IAlert): Promise<IIncident>;
    /**
     * Acknowledge an active incident
     */
    acknowledgeIncident(incidentId: string, user?: string): Promise<IIncident | null>;
    /**
     * Resolve an incident
     */
    resolveIncident(incidentId: string, user?: string, resolutionNotes?: string, rootCause?: string): Promise<IIncident | null>;
    /**
     * Escalate an incident to next tier
     */
    escalateIncident(incidentId: string, reason?: string): Promise<IIncident | null>;
    /**
     * Evaluates SLAs for unacknowledged incidents and triggers automatic escalation
     */
    checkEscalationSLAs(): Promise<number>;
}
export declare const incidentManager: IncidentManager;
export default incidentManager;
