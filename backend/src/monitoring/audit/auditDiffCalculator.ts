import { IFieldChange } from '../models/AuditLog';

const IGNORED_DIFF_FIELDS = new Set(['__v', 'updatedAt', 'createdAt']);

export function calculateAuditDiff(
  before: Record<string, any> | null | undefined,
  after: Record<string, any> | null | undefined
): Record<string, IFieldChange> {
  const changes: Record<string, IFieldChange> = {};

  if (!before && !after) return changes;
  if (!before && after) {
    // All fields in after are newly added
    for (const [key, val] of Object.entries(after)) {
      if (IGNORED_DIFF_FIELDS.has(key)) continue;
      changes[key] = { from: null, to: val };
    }
    return changes;
  }
  if (before && !after) {
    // All fields in before were removed
    for (const [key, val] of Object.entries(before)) {
      if (IGNORED_DIFF_FIELDS.has(key)) continue;
      changes[key] = { from: val, to: null };
    }
    return changes;
  }

  const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);

  for (const key of allKeys) {
    if (IGNORED_DIFF_FIELDS.has(key)) continue;

    const valBefore = before ? before[key] : undefined;
    const valAfter = after ? after[key] : undefined;

    // Fast equality check
    if (valBefore === valAfter) continue;

    // Stringify comparison for deep objects/dates/ObjectIds
    const strBefore = JSON.stringify(valBefore);
    const strAfter = JSON.stringify(valAfter);

    if (strBefore !== strAfter) {
      changes[key] = {
        from: valBefore !== undefined ? valBefore : null,
        to: valAfter !== undefined ? valAfter : null,
      };
    }
  }

  return changes;
}
