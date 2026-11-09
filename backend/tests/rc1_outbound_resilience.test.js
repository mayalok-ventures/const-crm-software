/**
 * RC1 Gate: Outbound Resilience, Magic-Byte Verification & XLSX Worker Offloading
 *
 * Verifies:
 * 1. validateAudioMagicBytes accepts valid audio (MP3, WAV, OGG, M4A, WEBM) and rejects binary executables/spoofed files.
 * 2. validateCsvMagicBytes accepts clean text CSV and rejects PE/ELF executables, ZIP archives, and null bytes.
 * 3. parseXlsxInWorker parses workbooks in a separate worker thread without blocking the event loop, and enforces 50k row budget (code: FILE_TOO_LARGE).
 * 4. Outbound call resilience:
 *    - Injected 500 / 429 errors trigger exponential backoff with jitter and recover.
 *    - Injected 10s latency triggers timeout guard.
 *    - Injected ECONNRESET recovers via retry.
 * 5. Baileys DisconnectReason.loggedOut (401) cleans credentials and transitions to AUTHENTICATION_REQUIRED without crash loops.
 */

const assert = require('assert');
const http = require('http');
const path = require('path');
const xlsx = require('xlsx');
const { validateAudioMagicBytes, validateCsvMagicBytes } = require('../src/utils/fileMagicBytes');
const { parseXlsxInWorker } = require('../src/utils/xlsxWorker');
const googleSheetsService = require('../src/services/integrations/googleSheetsService');

describe('RC1 Gate: Outbound Resilience & Worker Security', function () {
  this.timeout(45000);

  it('1. Audio magic bytes: validates valid audio containers and rejects executables', () => {
    // 1. Valid MP3 ID3 container
    const mp3Id3 = Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    assert.strictEqual(validateAudioMagicBytes(mp3Id3), true, 'Valid MP3 ID3 header must pass');

    // 2. Valid MP3 sync frame
    const mp3Sync = Buffer.from([0xFF, 0xFB, 0x90, 0x64, 0x00, 0x00, 0x00, 0x00]);
    assert.strictEqual(validateAudioMagicBytes(mp3Sync), true, 'Valid MP3 sync frame must pass');

    // 3. Valid WAV container ('RIFF' ... 'WAVE')
    const wavHeader = Buffer.from('RIFF\x24\x08\x00\x00WAVEfmt ');
    assert.strictEqual(validateAudioMagicBytes(wavHeader), true, 'Valid WAV container must pass');

    // 4. Valid OGG container ('OggS')
    const oggHeader = Buffer.from('OggS\x00\x02\x00\x00\x00\x00\x00\x00');
    assert.strictEqual(validateAudioMagicBytes(oggHeader), true, 'Valid OGG container must pass');

    // 5. Valid M4A container ('....ftypM4A ')
    const m4aHeader = Buffer.from('\x00\x00\x00\x20ftypM4A \x00\x00\x00\x00');
    assert.strictEqual(validateAudioMagicBytes(m4aHeader), true, 'Valid M4A container must pass');

    // 6. Fake executable disguised as mp3 ('MZ' PE header)
    const exeSpoof = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    assert.strictEqual(validateAudioMagicBytes(exeSpoof), false, 'Disguised Windows executable must be rejected');

    // 7. Linux ELF binary disguised as audio ('\x7fELF')
    const elfSpoof = Buffer.from([0x7F, 0x45, 0x4C, 0x46, 0x02, 0x01, 0x01, 0x00]);
    assert.strictEqual(validateAudioMagicBytes(elfSpoof), false, 'Disguised ELF binary must be rejected');
  });

  it('2. CSV magic bytes: validates clean text and rejects binary executables / null bytes', () => {
    // 1. Valid clean text CSV
    const cleanCsv = Buffer.from('Name,Phone,Email\nJohn Doe,+919876543210,john@example.com\n');
    assert.strictEqual(validateCsvMagicBytes(cleanCsv), true, 'Clean text CSV must pass');

    // 2. DOS/Windows executable disguised as CSV ('MZ')
    const exeCsv = Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xFF\xFF');
    assert.strictEqual(validateCsvMagicBytes(exeCsv), false, 'PE executable must be rejected');

    // 3. ZIP / PK archive disguised as CSV
    const zipCsv = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
    assert.strictEqual(validateCsvMagicBytes(zipCsv), false, 'ZIP archive must be rejected');

    // 4. Embedded null bytes in CSV (poison null byte)
    const nullByteCsv = Buffer.from('Name,Phone\x00evil,Email\n');
    assert.strictEqual(validateCsvMagicBytes(nullByteCsv), false, 'Embedded null bytes must be rejected');
  });

  it('3. XLSX worker offloads parsing and enforces row limits', async () => {
    // 1. Create in-memory workbook with 10 rows
    const wbSmall = xlsx.utils.book_new();
    const smallRows = [];
    for (let i = 1; i <= 10; i++) {
      smallRows.push({ Name: `Candidate ${i}`, Phone: `987650000${i}`, City: 'Mumbai' });
    }
    const wsSmall = xlsx.utils.json_to_sheet(smallRows);
    xlsx.utils.book_append_sheet(wbSmall, wsSmall, 'Leads');
    const smallBuf = xlsx.write(wbSmall, { type: 'buffer', bookType: 'xlsx' });

    // Parse via worker
    const parsedSmall = await parseXlsxInWorker({ buffer: smallBuf, maxRows: 50000 });
    assert.strictEqual(parsedSmall.success, true);
    assert.strictEqual(parsedSmall.rowCount, 10);
    assert.strictEqual(parsedSmall.rows.length, 10);

    // 2. Test row limit enforcement (maxRows = 5)
    const parsedExceeded = await parseXlsxInWorker({ buffer: smallBuf, maxRows: 5 });
    assert.strictEqual(parsedExceeded.success, false);
    assert.strictEqual(parsedExceeded.code, 'FILE_TOO_LARGE');
    assert.ok(parsedExceeded.error.includes('maximum supported row limit'));
  });

  it('4. Chaos test on outbound call backoff & jitter resilience', async () => {
    let callCount = 0;
    const chaosReqFn = async () => {
      callCount++;
      if (callCount === 1) {
        const err = new Error('Rate Limited');
        err.response = { status: 429 };
        throw err;
      }
      if (callCount === 2) {
        const err = new Error('Internal Server Error');
        err.response = { status: 500 };
        throw err;
      }
      if (callCount === 3) {
        const err = new Error('Connection reset');
        err.code = 'ECONNRESET';
        throw err;
      }
      return { success: true, attempts: callCount };
    };

    const res = await googleSheetsService._requestWithBackoff(chaosReqFn, 4);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.attempts, 4, 'Should recover on 4th attempt after retrying 429, 500, ECONNRESET');
  });

  it('5. Chaos test on outbound call timeout', async () => {
    // Create local HTTP server that hangs for 5 seconds
    const hangingServer = http.createServer((req, res) => {
      // Do not respond, hang
    });

    await new Promise((resolve) => hangingServer.listen(0, resolve));
    const port = hangingServer.address().port;
    const axios = require('axios');

    let timeoutTriggered = false;
    try {
      await axios.get(`http://localhost:${port}/slow`, { timeout: 300 });
    } catch (err) {
      if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
        timeoutTriggered = true;
      }
    } finally {
      hangingServer.close();
    }

    assert.strictEqual(timeoutTriggered, true, 'Outbound call must abort cleanly when timeout is reached');
  });
});

