/**
 * Email Attachment Security Validator
 *
 * Enforces:
 * 1. Extension & MIME allowlist (documents, images, audio, spreadsheets, archives).
 * 2. Strict rejection of executable and script extensions (.exe, .sh, .bat, .php, etc.).
 * 3. Deep magic-byte verification rejecting PE (MZ), ELF, and Mach-O binary headers.
 * 4. Local File Inclusion (LFI) prevention blocking arbitrary filesystem path traversal.
 */

const path = require('path');
const fs = require('fs');

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif',
  '.csv', '.xlsx', '.xls', '.docx', '.doc', '.pptx', '.ppt',
  '.txt', '.rtf', '.zip', '.mp3', '.m4a', '.wav', '.webm'
]);

const PROHIBITED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.bash', '.vbs', '.js', '.mjs',
  '.cjs', '.ts', '.php', '.phtml', '.py', '.pl', '.rb', '.ps1',
  '.psm1', '.scr', '.msi', '.dll', '.so', '.dylib', '.com', '.hta',
  '.jar', '.vbe', '.wsf', '.wsh', '.reg', '.inf', '.cpl', '.html',
  '.htm', '.xhtml', '.svg'
]);

const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB per attachment

function validateEmailAttachments(attachments) {
  if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
    return true;
  }

  for (let i = 0; i < attachments.length; i++) {
    const att = attachments[i];
    if (!att || typeof att !== 'object') continue;

    const rawFilename = String(att.filename || 'attachment').trim();
    const ext = path.extname(rawFilename).toLowerCase();

    // 1. Prohibited Executable Extension Check
    if (PROHIBITED_EXTENSIONS.has(ext)) {
      throw new Error(`Prohibited attachment file extension "${ext}". Executables and scripts are blocked.`);
    }

    // Also check double extensions (e.g. invoice.pdf.exe)
    const lowerName = rawFilename.toLowerCase();
    for (const prohibited of PROHIBITED_EXTENSIONS) {
      if (lowerName.endsWith(prohibited)) {
        throw new Error(`Prohibited executable extension detected in filename "${rawFilename}".`);
      }
    }

    // 2. Allowlist Check (if extension present)
    if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
      throw new Error(`Prohibited or unsupported attachment file type "${ext}". Allowed types: documents, images, audio, spreadsheets, archives.`);
    }

    // 3. Local File Inclusion (LFI) & Path Traversal Guard
    const targetUrl = att.url || att.path;
    if (targetUrl && typeof targetUrl === 'string') {
      const cleanTarget = targetUrl.trim();

      // Check for path traversal characters
      if (cleanTarget.includes('..') || cleanTarget.includes('%2e%2e')) {
        throw new Error(`Invalid attachment path: Path traversal sequences prohibited in "${cleanTarget}".`);
      }

      // If not HTTP/HTTPS remote URL, check local path boundaries
      const isRemoteUrl = /^https?:\/\//i.test(cleanTarget);
      if (!isRemoteUrl) {
        // Must start with /uploads/ or uploads/
        const isUploadsPath = cleanTarget.startsWith('/uploads/') ||
                              cleanTarget.startsWith('uploads/') ||
                              cleanTarget.startsWith('/api/uploads/');

        if (!isUploadsPath) {
          throw new Error(`Invalid attachment path: Access to unauthorized local file path is prohibited.`);
        }
      }
    }

    // 4. Magic-Byte Inspection
    let buffer = null;
    if (Buffer.isBuffer(att.content)) {
      buffer = att.content;
    } else if (typeof att.content === 'string') {
      buffer = Buffer.from(att.content, 'utf8');
    } else if (att.path && typeof att.path === 'string' && fs.existsSync(att.path)) {
      try {
        const fd = fs.openSync(att.path, 'r');
        const header = Buffer.alloc(16);
        const bytesRead = fs.readSync(fd, header, 0, 16, 0);
        fs.closeSync(fd);
        if (bytesRead >= 4) buffer = header;
      } catch {}
    }

    if (buffer && buffer.length >= 4) {
      // Reject DOS/Windows PE Executable ('MZ')
      if (buffer[0] === 0x4D && buffer[1] === 0x5A) {
        throw new Error(`Prohibited attachment: File contains executable binary magic bytes (MZ header).`);
      }

      // Reject Linux ELF Executable ('\x7fELF')
      if (buffer[0] === 0x7F && buffer[1] === 0x45 && buffer[2] === 0x4C && buffer[3] === 0x46) {
        throw new Error(`Prohibited attachment: File contains executable binary magic bytes (ELF header).`);
      }

      // Reject Mach-O / Java Class Executable ('\xCA\xFE\xBA\xBE')
      if (buffer[0] === 0xCA && buffer[1] === 0xFE && buffer[2] === 0xBA && buffer[3] === 0xBE) {
        throw new Error(`Prohibited attachment: File contains executable binary magic bytes (Mach-O header).`);
      }
    }

    // 5. Size check
    if (att.size && Number(att.size) > MAX_ATTACHMENT_SIZE_BYTES) {
      throw new Error(`Attachment "${rawFilename}" exceeds maximum allowed size of 25MB.`);
    }
  }

  return true;
}

module.exports = {
  validateEmailAttachments,
  ALLOWED_EXTENSIONS,
  PROHIBITED_EXTENSIONS,
};
