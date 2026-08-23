import { IFieldChange } from '../models/AuditLog';
export declare function calculateAuditDiff(before: Record<string, any> | null | undefined, after: Record<string, any> | null | undefined): Record<string, IFieldChange>;
