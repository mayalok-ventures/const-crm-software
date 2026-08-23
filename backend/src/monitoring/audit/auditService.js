"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditService = void 0;
const AuditLog_1 = require("../models/AuditLog");
const auditSanitizer_1 = require("./auditSanitizer");
const auditDiffCalculator_1 = require("./auditDiffCalculator");
const logger_1 = require("../logging/logger");
class AuditServiceEngine {
    /**
     * Universal Audit Log recorder
     * Append-only, fully sanitized, field-level diffing enabled
     */
    async record(params) {
        try {
            const user = params.actor || params.req?.user || null;
            const actorId = user?._id || user?.id || null;
            const actorName = user?.name || (user?.isAdmin ? 'SuperAdmin' : 'System');
            const actorEmail = user?.email || null;
            const actorRole = user?.role || (user?.isAdmin ? 'superadmin' : 'system');
            const organizationId = params.organizationId || user?.companyId || null;
            const clientIp = params.ip ||
                params.req?.ip ||
                params.req?.socket?.remoteAddress ||
                '127.0.0.1';
            const userAgent = params.userAgent ||
                params.req?.headers['user-agent'] ||
                'internal';
            const requestId = params.requestId ||
                params.req?.headers['x-request-id'] ||
                params.req?.id ||
                null;
            // Sanitize snapshots before storing
            const sanitizedBefore = params.before ? (0, auditSanitizer_1.sanitizeAuditData)(params.before) : null;
            const sanitizedAfter = params.after ? (0, auditSanitizer_1.sanitizeAuditData)(params.after) : null;
            const sanitizedMetadata = (0, auditSanitizer_1.sanitizeAuditData)(params.metadata || {});
            // Calculate or sanitize field changes
            let fieldChanges = params.changes;
            if (!fieldChanges && (sanitizedBefore || sanitizedAfter)) {
                fieldChanges = (0, auditDiffCalculator_1.calculateAuditDiff)(sanitizedBefore, sanitizedAfter);
            }
            else if (fieldChanges) {
                fieldChanges = (0, auditSanitizer_1.sanitizeAuditData)(fieldChanges);
            }
            // Non-blocking asynchronous persistence
            AuditLog_1.AuditLog.create({
                actorId,
                actorName,
                actorEmail,
                actorRole,
                organizationId,
                action: params.action,
                resourceType: params.resourceType,
                resourceId: params.resourceId ? String(params.resourceId) : null,
                resourceName: params.resourceName || null,
                before: sanitizedBefore,
                after: sanitizedAfter,
                changes: fieldChanges || {},
                requestId,
                timestamp: new Date(),
                ip: clientIp,
                userAgent,
                metadata: sanitizedMetadata,
                retentionCategory: 'ACTIVE',
            }).catch((err) => {
                logger_1.logger.error(`Failed to persist AuditLog: ${err.message}`, { module: 'audit' });
            });
            // Output to structured audit logger
            logger_1.logger.audit(actorEmail || actorName || 'System', params.action, `${params.resourceType}:${params.resourceId || 'N/A'}`, {
                organizationId,
                requestId,
                changesCount: Object.keys(fieldChanges || {}).length,
            });
        }
        catch (err) {
            logger_1.logger.error(`Error in auditService.record: ${err.message}`, { module: 'audit' });
        }
    }
}
exports.auditService = new AuditServiceEngine();
