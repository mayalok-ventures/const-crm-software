const assert = require('assert');
const path = require('path');
const { SmtpAdapter } = require('../src/services/email/emailProviderAdapters');
const { validateEmailAttachments } = require('../src/utils/attachmentValidator');

describe('RC-2 Email Attachment Security and Transport Timeouts', () => {
  describe('Attachment Extension and MIME Validation', () => {
    it('should reject dangerous executable file extensions (.exe, .sh, .bat, .php, .vbs, .js)', () => {
      const dangerousFiles = [
        { filename: 'invoice.pdf.exe', contentType: 'application/octet-stream' },
        { filename: 'script.sh', contentType: 'text/x-shellscript' },
        { filename: 'setup.bat', contentType: 'application/x-bat' },
        { filename: 'backdoor.php', contentType: 'application/x-php' },
        { filename: 'exploit.vbs', contentType: 'text/vbscript' },
        { filename: 'payload.js', contentType: 'application/javascript' },
      ];

      for (const att of dangerousFiles) {
        assert.throws(
          () => validateEmailAttachments([att]),
          /(prohibited|executable|blocked|dangerous)/i,
          `File ${att.filename} must be rejected as prohibited attachment`
        );
      }
    });

    it('should reject Local File Inclusion (LFI) path traversal attempts', () => {
      const lfiAttempts = [
        { filename: 'passwd.txt', url: '../../../../etc/passwd' },
        { filename: 'win.ini', url: 'C:\\Windows\\win.ini' },
        { filename: 'private.key', url: '/var/secrets/id_rsa' },
        { filename: 'env.txt', path: '../../../.env' },
      ];

      for (const att of lfiAttempts) {
        assert.throws(
          () => validateEmailAttachments([att]),
          /(path|traversal|unauthorized|prohibited)/i,
          `LFI attempt ${att.url || att.path} must be rejected`
        );
      }
    });

    it('should reject binary executable magic bytes even if filename is disguised as .pdf or .png', () => {
      // DOS / Windows PE Executable magic bytes: 0x4D 0x5A ('MZ')
      const disguisedExe = {
        filename: 'statement.pdf',
        contentType: 'application/pdf',
        content: Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]),
      };

      assert.throws(
        () => validateEmailAttachments([disguisedExe]),
        /(executable|magic|disguised|invalid)/i,
        'File with MZ executable magic bytes must be rejected even with .pdf extension'
      );

      // Linux ELF magic bytes: 0x7F 0x45 0x4C 0x46 ('\x7fELF')
      const disguisedElf = {
        filename: 'photo.png',
        contentType: 'image/png',
        content: Buffer.from([0x7F, 0x45, 0x4C, 0x46, 0x02, 0x01, 0x01, 0x00]),
      };

      assert.throws(
        () => validateEmailAttachments([disguisedElf]),
        /(executable|magic|disguised|invalid)/i,
        'File with ELF magic bytes must be rejected even with .png extension'
      );
    });

    it('should allow valid benign attachments with safe URLs or uploads', () => {
      const benign = [
        { filename: 'brochure.pdf', contentType: 'application/pdf', url: 'https://cdn.example.com/brochure.pdf' },
        { filename: 'screenshot.png', contentType: 'image/png', url: '/uploads/templates/screenshot.png' },
        { filename: 'leads.csv', contentType: 'text/csv', content: Buffer.from('name,phone\nAlice,9876543210') },
      ];

      assert.doesNotThrow(() => validateEmailAttachments(benign));
    });
  });

  describe('Transport Connection & Socket Timeouts', () => {
    it('should configure explicit connection, greeting, and socket timeouts on SmtpAdapter transporter', () => {
      const dummyAccount = {
        smtpHost: 'smtp.mailtrap.io',
        smtpPort: 2525,
        smtpSecure: false,
        smtpUser: 'testuser',
        email: 'advisor@crm.com',
        getDecryptedSmtpPassword: () => 'dummypass',
      };

      const transporter = SmtpAdapter.createTransporter(dummyAccount);
      assert.ok(transporter.options, 'Transporter options must exist');
      assert.ok(transporter.options.connectionTimeout <= 15000, 'connectionTimeout must be <= 15000ms');
      assert.ok(transporter.options.greetingTimeout <= 10000, 'greetingTimeout must be <= 10000ms');
      assert.ok(transporter.options.socketTimeout <= 30000, 'socketTimeout must be <= 30000ms');
    });
  });
});
