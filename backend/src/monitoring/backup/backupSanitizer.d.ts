/**
 * BACKUP SANITIZER & FORMATTER
 * Ensures zero credential leakage:
 * - Redacts AWS S3 Secret Keys, Access Key IDs, GCP Service Account JSONs, and SSH tokens.
 * - Formats byte sizes and durations safely.
 */
export declare function sanitizeBackupLocation(location: {
    target?: string;
    path?: string;
    bucket?: string;
    region?: string;
    isExternal?: boolean;
}): {
    target: string;
    path: string;
    bucket: string;
    region: string;
    isExternal: boolean;
};
export declare function formatBackupBytes(bytes: number): string;
export declare function formatDurationMs(ms: number): string;
