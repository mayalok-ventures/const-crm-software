const assert = require('assert');
const { formatEmailHtml, generatePlainText, buildMimeMessage } = require('../src/services/email/emailProviderAdapters');

console.log('🧪 Testing Email Formatting & MIME Alternative Engine...');

// Test 1: Plain text with newlines, bolding, and lists
const plain = `Hello Rahul,

This is a **crucial** admission update with *important* details.

Please verify the following:
- 10th & 12th Marksheets
- Transfer Certificate
- Valid Photo ID

Best regards,
Advising Team`;

const formatted = formatEmailHtml(plain);
assert(formatted.includes('<p style="margin: 0 0 16px 0;'), 'Must have paragraph margins');
assert(formatted.includes('<strong>crucial</strong>'), 'Must convert double asterisks to strong');
assert(formatted.includes('<strong>important</strong>'), 'Must convert single asterisks to strong');
assert(formatted.includes('<ul'), 'Must convert bullet lines to ul');
assert(formatted.includes('<li'), 'Must convert list items to li');
assert(formatted.includes('<table role="presentation"'), 'Must wrap in responsive table');
assert(formatted.includes('max-width: 620px'), 'Must have 620px max width');

console.log('✔ Test 1: Plain text converted to responsive formatted HTML successfully');

// Test 2: generatePlainText
const text = generatePlainText(formatted);
assert(text.includes('Hello Rahul,'), 'Must contain hello');
assert(text.includes('10th & 12th Marksheets'), 'Must contain list item');
assert(!text.includes('<p>'), 'Must strip p tags');
assert(!text.includes('<table>'), 'Must strip table tags');

console.log('✔ Test 2: generatePlainText produced clean plaintext fallback successfully');

// Test 3: buildMimeMessage without attachments (multipart/alternative)
const mimeResult1 = buildMimeMessage({
  from: { name: 'Support', email: 'support@mayalokventures.com' },
  to: [{ email: 'student@example.com' }],
  subject: 'Admission Offer 2026',
  bodyText: plain,
});
assert(mimeResult1.rawMessage.includes('multipart/alternative'), 'Must be multipart/alternative');
assert(mimeResult1.rawMessage.includes('Content-Type: text/plain; charset="UTF-8"'), 'Must include text/plain part');
assert(mimeResult1.rawMessage.includes('Content-Type: text/html; charset="UTF-8"'), 'Must include text/html part');

console.log('✔ Test 3: buildMimeMessage without attachments constructed RFC 2046 multipart/alternative successfully');

// Test 4: buildMimeMessage with attachments (nested multipart/alternative inside multipart/mixed)
const mimeResult2 = buildMimeMessage({
  from: { name: 'Support', email: 'support@mayalokventures.com' },
  to: [{ email: 'student@example.com' }],
  subject: 'Admission Offer with Prospectus',
  bodyText: plain,
  attachments: [
    {
      filename: 'prospectus.pdf',
      contentType: 'application/pdf',
      content: Buffer.from('%PDF-1.4 test file'),
    },
  ],
});
assert(mimeResult2.rawMessage.includes('Content-Type: multipart/mixed;'), 'Must have outer multipart/mixed');
assert(mimeResult2.rawMessage.includes('Content-Type: multipart/alternative;'), 'Must have inner multipart/alternative');
assert(mimeResult2.rawMessage.includes('Content-Disposition: attachment; filename="prospectus.pdf"'), 'Must include attachment');

console.log('✔ Test 4: buildMimeMessage with attachments constructed nested multipart/mixed + alternative successfully');

// Test 5: Full custom HTML document preservation
const customHtml = `<!DOCTYPE html><html><head><title>Test</title></head><body style="background: red;"><h1>Custom Design</h1></body></html>`;
const formattedCustom = formatEmailHtml(customHtml);
assert(formattedCustom === customHtml, 'Must preserve custom HTML document as is without double wrapping');

console.log('✔ Test 5: Full custom HTML document preserved with 100% fidelity');

// Test 6: Template API controller integration
(async () => {
  const mongoose = require('mongoose');
  const Template = require('../src/models/Template');
  const templatesController = require('../src/controllers/templatesController');

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mobile-crm');
  }

  const mockUserId = new mongoose.Types.ObjectId();
  const reqCreate = {
    user: { _id: mockUserId },
    body: {
      title: 'MBA Scholarship Offer Letter',
      channel: 'EMAIL',
      subject: 'Congratulations {{name}}! Scholarship Approved for {{course}}',
      bodyHtml: '<h1>Scholarship Awarded</h1><p>Dear {{name}}, we are pleased to inform you that you have received a 25% grant for {{course}}.</p>',
      category: 'scholarship',
    },
  };

  let createdTemplate = null;
  const resCreate = {
    status: (code) => ({
      json: (data) => {
        createdTemplate = data;
        return data;
      },
    }),
    json: (data) => {
      createdTemplate = data;
      return data;
    },
  };

  await templatesController.createTemplate(reqCreate, resCreate);
  assert(createdTemplate && createdTemplate._id, 'Template must be created in DB');
  assert(createdTemplate.channel === 'EMAIL', 'Channel must be EMAIL');
  assert(createdTemplate.subject.includes('{{name}}'), 'Subject must retain merge variable');
  assert(createdTemplate.variables.includes('name'), 'Must auto-extract {{name}} variable');
  assert(createdTemplate.variables.includes('course'), 'Must auto-extract {{course}} variable');

  console.log('✔ Test 6: Email template created via controller with variables auto-extracted');

  // Test 7: Query filtering by channel=EMAIL
  let fetchedTemplates = null;
  const reqGet = {
    user: { _id: mockUserId },
    query: { channel: 'EMAIL' },
  };
  const resGet = {
    status: () => ({ json: (d) => { fetchedTemplates = d; } }),
    json: (d) => { fetchedTemplates = d; },
  };

  await templatesController.getTemplates(reqGet, resGet);
  assert(Array.isArray(fetchedTemplates), 'Fetched templates must be array');
  assert(fetchedTemplates.some(t => t._id.toString() === createdTemplate._id.toString()), 'Must find created email template');
  assert(fetchedTemplates.every(t => t.channel === 'EMAIL'), 'All returned templates must match EMAIL channel filter');

  console.log('✔ Test 7: Template query with ?channel=EMAIL successfully filtered email templates');

  // Cleanup
  await Template.findByIdAndDelete(createdTemplate._id);
  await mongoose.disconnect();

  console.log('🎉 ALL EMAIL FORMATTING, MIME & TEMPLATE TESTS PASSED! ✅');
  process.exit(0);
})().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
