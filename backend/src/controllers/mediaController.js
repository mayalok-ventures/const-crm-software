const cloudinary = require('cloudinary').v2;

// Configure Cloudinary from environment
if (process.env.CLOUDINARY_URL) {
  // auto-configured
} else if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const ALLOWED_FOLDERS = {
  recordings: 'crm_recordings',
  templates: 'crm_templates',
  avatars: 'crm_avatars',
  payments: 'crm_payments',
  brochures: 'crm_brochures',
  documents: 'crm_documents',
};

/**
 * Generates an HMAC-SHA256 direct upload signature for Cloudinary.
 * Client uploads binary data directly to Cloudinary CDN with f_auto,q_auto optimization,
 * bypassing Node.js process memory entirely.
 */
async function signDirectUpload(req, res) {
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || (cloudinary.config().cloud_name);
    const apiKey = process.env.CLOUDINARY_API_KEY || (cloudinary.config().api_key);
    const apiSecret = process.env.CLOUDINARY_API_SECRET || (cloudinary.config().api_secret);

    if (!cloudName || !apiKey || !apiSecret) {
      return res.status(503).json({
        success: false,
        error: 'Cloudinary credentials are not configured on this server.',
      });
    }

    const { folderType = 'documents', tags = 'crm_upload' } = req.body || {};
    const targetFolder = ALLOWED_FOLDERS[folderType] || 'crm_documents';
    const timestamp = Math.round(new Date().getTime() / 1000);

    // Upload parameters to sign
    const paramsToSign = {
      folder: targetFolder,
      timestamp,
      tags: String(tags),
    };

    // Generate cryptographic signature
    const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

    res.json({
      success: true,
      data: {
        signature,
        timestamp,
        apiKey,
        cloudName,
        folder: targetFolder,
        tags,
        uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
        transformation: 'f_auto,q_auto',
      },
    });
  } catch (err) {
    console.error('[Cloudinary Sign Error]:', err);
    res.status(500).json({ success: false, error: 'Failed to generate upload signature' });
  }
}

module.exports = {
  signDirectUpload,
};
