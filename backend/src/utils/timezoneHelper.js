/**
 * Production Timezone & DST Resolution Utility
 * Ensures follow-up alarms, reminders, and schedules fire at the exact intended instant
 * across all worldwide timezones and daylight saving time (DST) transitions.
 */

/**
 * Resolves a date string or timestamp into a valid UTC Date instance in the specified timezone.
 * Handles:
 * 1. ISO strings with timezone offsets (e.g. '2026-11-12T14:00:00+05:30', '2026-11-12T08:30:00Z')
 * 2. Epoch milliseconds / number timestamps
 * 3. Naive local datetime strings (e.g. '2026-11-12 14:00', '2026-11-12T14:00:00')
 *
 * @param {string|number|Date} input - The input datetime
 * @param {string} [timeZone='Asia/Kolkata'] - IANA Timezone string
 * @returns {Date} UTC Date instance
 */
function parseDateInTimezone(input, timeZone = 'Asia/Kolkata') {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;

  const validTimeZone = isValidTimeZone(timeZone) ? timeZone : 'Asia/Kolkata';

  if (typeof input === 'number') {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }

  const str = String(input).trim();

  // If string contains explicit timezone indicator (Z or +HH:MM or -HH:MM at end), standard Date parser parses directly
  const hasExplicitOffset = /([zZ]|([+-]\d{2}:?\d{2}))$/.test(str);
  if (hasExplicitOffset) {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  // Parse components of naive string: YYYY-MM-DD[T or space]HH:mm(:ss)?
  const match = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (!match) {
    const fallback = new Date(str);
    return isNaN(fallback.getTime()) ? null : fallback;
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  const hour = match[4] !== undefined ? parseInt(match[4], 10) : 0;
  const minute = match[5] !== undefined ? parseInt(match[5], 10) : 0;
  const second = match[6] !== undefined ? parseInt(match[6], 10) : 0;

  // Compute UTC timestamp using IANA timezone offset for target date
  return resolveLocalComponentsToUTC(year, month, day, hour, minute, second, validTimeZone);
}

/**
 * Calculates exact UTC instant for local date-time components in an IANA timezone
 */
function resolveLocalComponentsToUTC(year, month, day, hour, minute, second, timeZone) {
  // Construct approximate UTC date
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);

  // Use Intl.DateTimeFormat to measure target timezone offset at utcGuess
  const offsetMs = getTimezoneOffsetMs(new Date(utcGuess), timeZone);

  // Target UTC instant = local representation - offset
  let targetUtc = new Date(utcGuess - offsetMs);

  // Refine for DST boundaries (boundary edge correction)
  const refinedOffsetMs = getTimezoneOffsetMs(targetUtc, timeZone);
  if (refinedOffsetMs !== offsetMs) {
    targetUtc = new Date(utcGuess - refinedOffsetMs);
  }

  return targetUtc;
}

/**
 * Gets the difference in milliseconds between UTC and local time in the specified timezone:
 * (localTime - utcTime) in ms
 */
function getTimezoneOffsetMs(date, timeZone) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const partMap = {};
    for (const p of parts) {
      if (p.type !== 'literal') partMap[p.type] = parseInt(p.value, 10);
    }

    let h = partMap.hour;
    if (h === 24) h = 0; // Fix 24-hour rollover in Intl

    const localEpoch = Date.UTC(
      partMap.year,
      partMap.month - 1,
      partMap.day,
      h,
      partMap.minute,
      partMap.second
    );

    return localEpoch - date.getTime();
  } catch (err) {
    return 0; // Fallback to UTC if timezone is invalid
  }
}

/**
 * Validates whether a timezone identifier is valid according to the Intl API
 */
function isValidTimeZone(tz) {
  if (!tz || typeof tz !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Formats a Date instance into human-readable string in target timezone
 */
function formatInTimezone(date, timeZone = 'Asia/Kolkata', options = {}) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const validTz = isValidTimeZone(timeZone) ? timeZone : 'Asia/Kolkata';

  const defaultOptions = {
    timeZone: validTz,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    ...options,
  };

  return new Intl.DateTimeFormat('en-US', defaultOptions).format(d);
}

module.exports = {
  parseDateInTimezone,
  formatInTimezone,
  isValidTimeZone,
  getTimezoneOffsetMs,
};
