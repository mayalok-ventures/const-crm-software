/**
 * Secure File Magic-Byte & Format Verifier
 *
 * Validates actual binary signatures (magic bytes) to prevent extension spoofing,
 * polyglot payloads, and executable uploads masquerading as media or spreadsheets.
 */

const fs = require('fs');

/**
 * Validates audio file signatures (MP3, WAV, OGG, M4A, AAC, WEBM)
 * @param {string|Buffer} input - File path or memory Buffer
 * @returns {boolean}
 */
function validateAudioMagicBytes(input) {
  let buffer;
  if (typeof input === 'string') {
    if (!fs.existsSync(input)) return false;
    const fd = fs.openSync(input, 'r');
    buffer = Buffer.alloc(12);
    const bytesRead = fs.readSync(fd, buffer, 0, 12, 0);
    fs.closeSync(fd);
    if (bytesRead < 4) return false;
  } else if (Buffer.isBuffer(input)) {
    if (input.length < 4) return false;
    buffer = input.subarray(0, 12);
  } else {
    return false;
  }

  // 1. MP3 with ID3v2 container: 49 44 33 ('ID3')
  if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) return true;

  // 2. Raw MP3 sync frame: FF E0-FF (11 bits of frame sync)
  if (buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0) return true;

  // 3. RIFF WAV container: 'RIFF' .... 'WAVE'
  if (buffer.length >= 12 && buffer.toString('utf8', 0, 4) === 'RIFF' && buffer.toString('utf8', 8, 12) === 'WAVE') return true;

  // 4. Ogg Vorbis/Opus: 'OggS'
  if (buffer.toString('utf8', 0, 4) === 'OggS') return true;

  // 5. ISO Base Media / M4A / MP4 / AAC: 'ftyp' at offset 4
  if (buffer.length >= 8 && buffer.toString('utf8', 4, 8) === 'ftyp') return true;

  // 6. Matroska / WebM Audio: 1A 45 DF A3 (EBML)
  if (buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3) return true;

  return false;
}

/**
 * Validates that a CSV file is clean text and not a disguised binary executable (EXE, ELF, Mach-O, ZIP, etc.)
 * @param {string|Buffer} input - File path or memory Buffer
 * @returns {boolean}
 */
function validateCsvMagicBytes(input) {
  let buffer;
  if (typeof input === 'string') {
    if (!fs.existsSync(input)) return false;
    const fd = fs.openSync(input, 'r');
    buffer = Buffer.alloc(512);
    const bytesRead = fs.readSync(fd, buffer, 0, 512, 0);
    fs.closeSync(fd);
    if (bytesRead === 0) return true; // empty file is technically empty text
    buffer = buffer.subarray(0, bytesRead);
  } else if (Buffer.isBuffer(input)) {
    if (input.length === 0) return true;
    buffer = input.subarray(0, Math.min(input.length, 512));
  } else {
    return false;
  }

  // Reject DOS/Windows PE Executable ('MZ')
  if (buffer[0] === 0x4D && buffer[1] === 0x5A) return false;

  // Reject Linux ELF ('\x7fELF')
  if (buffer[0] === 0x7F && buffer[1] === 0x45 && buffer[2] === 0x4C && buffer[3] === 0x46) return false;

  // Reject Java / Mach-O class files ('\xCA\xFE\xBA\xBE')
  if (buffer[0] === 0xCA && buffer[1] === 0xFE && buffer[2] === 0xBA && buffer[3] === 0xBE) return false;

  // Reject ZIP / PK archives ('PK\x03\x04') masquerading as CSV
  if (buffer[0] === 0x50 && buffer[1] === 0x4B) return false;

  // CSV text must not contain embedded NULL bytes (0x00)
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] === 0x00) {
      return false;
    }
  }

  return true;
}

module.exports = {
  validateAudioMagicBytes,
  validateCsvMagicBytes,
};
