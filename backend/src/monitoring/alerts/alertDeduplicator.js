"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.alertDeduplicator = exports.AlertDeduplicator = void 0;
const crypto_1 = __importDefault(require("crypto"));
class AlertDeduplicator {
    static instance;
    // In-memory cache for recent notifications: fingerprint -> lastDispatchedTimestamp
    lastDispatchedMap = new Map();
    constructor() { }
    static getInstance() {
        if (!AlertDeduplicator.instance) {
            AlertDeduplicator.instance = new AlertDeduplicator();
        }
        return AlertDeduplicator.instance;
    }
    /**
     * Generates a deterministic SHA-256 fingerprint for the alert
     */
    generateFingerprint(rule, targetResource) {
        const raw = `${rule.ruleId}:${targetResource.type || 'ALL'}:${targetResource.identifier || '*'}:${rule.metric}`;
        return crypto_1.default.createHash('sha256').update(raw).digest('hex');
    }
    /**
     * Checks if an alert is in active cooldown
     */
    checkDeduplication(fingerprint, cooldownMinutes = 15, activeAlertId) {
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
    recordNotification(fingerprint) {
        this.lastDispatchedMap.set(fingerprint, Date.now());
    }
    /**
     * Clears fingerprint cooldown (e.g. on resolution)
     */
    clearCooldown(fingerprint) {
        this.lastDispatchedMap.delete(fingerprint);
    }
    /**
     * Reset for testing
     */
    reset() {
        this.lastDispatchedMap.clear();
    }
}
exports.AlertDeduplicator = AlertDeduplicator;
exports.alertDeduplicator = AlertDeduplicator.getInstance();
exports.default = exports.alertDeduplicator;
