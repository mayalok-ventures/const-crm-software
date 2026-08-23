import crypto from 'crypto';
import { IAlertRule } from '../models/AlertRule';

export interface DeduplicationCheckResult {
  fingerprint: string;
  isDuplicate: boolean;
  isInCooldown: boolean;
  cooldownRemainingSeconds: number;
}

export class AlertDeduplicator {
  private static instance: AlertDeduplicator;
  // In-memory cache for recent notifications: fingerprint -> lastDispatchedTimestamp
  private lastDispatchedMap: Map<string, number> = new Map();

  private constructor() {}

  public static getInstance(): AlertDeduplicator {
    if (!AlertDeduplicator.instance) {
      AlertDeduplicator.instance = new AlertDeduplicator();
    }
    return AlertDeduplicator.instance;
  }

  /**
   * Generates a deterministic SHA-256 fingerprint for the alert
   */
  public generateFingerprint(
    rule: Pick<IAlertRule, 'ruleId' | 'metric'>,
    targetResource: { type?: string; identifier?: string }
  ): string {
    const raw = `${rule.ruleId}:${targetResource.type || 'ALL'}:${targetResource.identifier || '*'}:${rule.metric}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Checks if an alert is in active cooldown
   */
  public checkDeduplication(
    fingerprint: string,
    cooldownMinutes: number = 15,
    activeAlertId?: string
  ): DeduplicationCheckResult {
    const now = Date.now();
    const lastDispatched = this.lastDispatchedMap.get(fingerprint);
    const cooldownMs = cooldownMinutes * 60 * 1000;

    let isInCooldown = false;
    let cooldownRemainingSeconds = 0;

    if (lastDispatched) {
      const elapsed = now - lastDispatched;
      if (elapsed < cooldownMs) {
        isInCooldown = true;
        cooldownRemainingSeconds = Math.max(0, Math.ceil((cooldownMs - elapsed) / 1000));
      }
    }

    return {
      fingerprint,
      isDuplicate: Boolean(activeAlertId),
      isInCooldown,
      cooldownRemainingSeconds,
    };
  }

  /**
   * Marks fingerprint as notified now, resetting cooldown timer
   */
  public recordNotification(fingerprint: string): void {
    this.lastDispatchedMap.set(fingerprint, Date.now());
  }

  /**
   * Clears fingerprint cooldown (e.g. on resolution)
   */
  public clearCooldown(fingerprint: string): void {
    this.lastDispatchedMap.delete(fingerprint);
  }

  /**
   * Reset for testing
   */
  public reset(): void {
    this.lastDispatchedMap.clear();
  }
}

export const alertDeduplicator = AlertDeduplicator.getInstance();
export default alertDeduplicator;
