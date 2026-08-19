/**
 * Timezone-Safe Date and Time Utilities for Mobile CRM
 * Prevents UTC time-shift bugs between <input type="datetime-local"> and MongoDB ISO dates.
 */

/**
 * Converts a Date object or ISO string into a local 'YYYY-MM-DDTHH:mm' string
 * suitable for <input type="datetime-local"> without UTC displacement.
 */
export function toLocalDatetimeString(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  const pad = (n) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Converts a local 'YYYY-MM-DDTHH:mm' string into a standardized UTC ISO string for backend storage.
 */
export function fromLocalDatetimeStringToISO(localDatetimeStr) {
  if (!localDatetimeStr) return null;
  const d = new Date(localDatetimeStr);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Formats a Date object or ISO string into a human-readable local time display:
 * Example: '19 Aug 2026, 02:00 PM'
 */
export function formatDisplayDateTime(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Formats a date only: '19 Aug 2026'
 */
export function formatDisplayDate(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Formats time only: '02:00 PM'
 */
export function formatDisplayTime(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
