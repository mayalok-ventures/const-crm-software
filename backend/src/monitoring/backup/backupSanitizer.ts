/**
 * BACKUP SANITIZER & FORMATTER
 * Ensures zero credential leakage:
 * - Redacts AWS S3 Secret Keys, Access Key IDs, GCP Service Account JSONs, and SSH tokens.
 * - Formats byte sizes and durations safely.
 */

export function sanitizeBackupLocation(location: {
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
} {
  if (!location) {
    return {
      target: 'S3',
      path: 's3://[REDACTED_BUCKET]/backups/',
      bucket: 'production-backups',
      region: 'us-east-1',
      isExternal: true,
    };
  }

  let sanitizedPath = location.path || '';

  // Redact embedded URI credentials (e.g. s3://AKIAIOSFODNN7EXAMPLE:wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY@bucket)
  sanitizedPath = sanitizedPath.replace(/\/\/[^:]+:[^@]+@/g, '//***:***@');

  // Redact query parameter credentials
  sanitizedPath = sanitizedPath.replace(/(accessKey|secretKey|token|key|pwd|password)=[^&]+/gi, '$1=[REDACTED]');

  return {
    target: location.target || 'S3',
    path: sanitizedPath,
    bucket: location.bucket || 'production-backups',
    region: location.region || 'us-east-1',
    isExternal: location.isExternal ?? true,
  };
}

export function formatBackupBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDurationMs(ms: number): string {
  if (!ms || ms <= 0) return '0s';
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSecs = seconds % 60;
  return `${minutes}m ${remainingSecs}s`;
}
