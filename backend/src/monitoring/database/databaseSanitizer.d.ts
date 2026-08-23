/**
 * Database Sanitizer
 * Deeply sanitizes MongoDB connection strings, credentials, and query filters
 * to prevent any secret or sensitive business parameter leakage in telemetry.
 */
/**
 * Sanitizes MongoDB connection URIs by redacting the credentials segment.
 * Example: mongodb+srv://admin:pass123@cluster.mongodb.net/crm -> mongodb+srv://admin:***@cluster.mongodb.net/crm
 */
export declare function sanitizeMongoUri(uri: string): string;
/**
 * Recursively redacts sensitive keys and values from query filter objects.
 */
export declare function sanitizeQueryFilter(obj: any, depth?: number): any;
/**
 * Sanitizes error messages by masking connection strings or password patterns.
 */
export declare function sanitizeErrorMessage(message: string): string;
declare const _default: {
    sanitizeMongoUri: typeof sanitizeMongoUri;
    sanitizeQueryFilter: typeof sanitizeQueryFilter;
    sanitizeErrorMessage: typeof sanitizeErrorMessage;
};
export default _default;
