import { IAlertRule } from '../models/AlertRule';
export interface DeduplicationCheckResult {
    fingerprint: string;
    isDuplicate: boolean;
    isInCooldown: boolean;
    cooldownRemainingSeconds: number;
}
export declare class AlertDeduplicator {
    private static instance;
    private lastDispatchedMap;
    private constructor();
    static getInstance(): AlertDeduplicator;
    /**
     * Generates a deterministic SHA-256 fingerprint for the alert
     */
    generateFingerprint(rule: Pick<IAlertRule, 'ruleId' | 'metric'>, targetResource: {
        type?: string;
        identifier?: string;
    }): string;
    /**
     * Checks if an alert is in active cooldown
     */
    checkDeduplication(fingerprint: string, cooldownMinutes?: number, activeAlertId?: string): DeduplicationCheckResult;
    /**
     * Marks fingerprint as notified now, resetting cooldown timer
     */
    recordNotification(fingerprint: string): void;
    /**
     * Clears fingerprint cooldown (e.g. on resolution)
     */
    clearCooldown(fingerprint: string): void;
    /**
     * Reset for testing
     */
    reset(): void;
}
export declare const alertDeduplicator: AlertDeduplicator;
export default alertDeduplicator;
