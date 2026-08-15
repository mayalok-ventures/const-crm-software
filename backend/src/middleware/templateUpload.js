const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const cloudinary = require('cloudinary').v2;

const hasCloudinary = Boolean(
  process.env.CLOUDINARY_URL ||
  (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
);

if (process.env.CLOUDINARY_URL) {
  // Cloudinary URL auto-configured
} else if (hasCloudinary) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

const tempDir = path.join(__dirname, '../../uploads/templates/temp');
const finalDir = path.join(__dirname, '../../uploads/templates');

// Ensure directories exist
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
if (!fs.existsSync(finalDir)) fs.mkdirSync(finalDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `temp-${unique}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`);
  },
});

// File filter with strict file type checks
const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'image') {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files (JPEG, PNG, WEBP, GIF) are allowed for the image field.'), false);
    }
  } else if (file.fieldname === 'video') {
    if (!file.mimetype.startsWith('video/')) {
      return cb(new Error('Only video files (MP4, WEBM, MOV) are allowed for the video field.'), false);
    }
  } else if (file.fieldname === 'doc') {
    const allowedDocs = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (!allowedDocs.includes(file.mimetype) && !file.originalname.match(/\.(pdf|doc|docx|txt|xls|xlsx)$/i)) {
      return cb(new Error('Only document files (PDF, DOC, DOCX, XLS, TXT) are allowed for the doc field.'), false);
    }
  }
  cb(null, true);
};

// Hard limit 15MB at multer level
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB max
  },
});

// Helper for Cloudinary upload with fallback
const uploadToCloudinarySafe = async (filePath, options) => {
  if (!hasCloudinary) return null;
  try {
    const result = await cloudinary.uploader.upload(filePath, options);
    return result;
  } catch (err) {
    console.warn(`[Cloudinary] Upload failed (${err.message}). Falling back to local storage.`);
    return null;
  }
};

/**
 * Middleware to process, validate strict limits, auto-compress images,
 * and clean up temporary files immediately to prevent storage leaks.
 */
const processTemplateUploads = async (req, res, next) => {
  if (!req.files) return next();

  // Helper to ensure all temp files in req.files are cleaned up
  const cleanupAllTemp = () => {
    Object.values(req.files).forEach(fileArray => {
      fileArray.forEach(file => {
        if (file.path && fs.existsSync(file.path) && file.path.includes('temp')) {
          try { fs.unlinkSync(file.path); } catch (e) {}
        }
      });
    });
  };

  try {
    // 1. Process Image Upload (Strict max 5MB, Auto-compressed with sharp)
    if (req.files.image && req.files.image[0]) {
      const imgFile = req.files.image[0];
      const maxImageSize = 5 * 1024 * 1024; // 5MB

      if (imgFile.size > maxImageSize) {
        cleanupAllTemp();
        return res.status(400).json({ message: 'Image exceeds maximum 5MB size limit. Please upload a smaller image.' });
      }

      const uniqueName = `image-${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
      const outPath = path.join(finalDir, uniqueName);

      try {
        // Auto-compress and convert to high-efficiency WebP
        await sharp(imgFile.path)
          .resize({ width: 1920, withoutEnlargement: true }) // Max 1080p/1440p resolution
          .webp({ quality: 80, effort: 4 })
          .toFile(outPath);
      } finally {
        // Guarantee immediate cleanup of original uncompressed temp file
        if (fs.existsSync(imgFile.path)) {
          try { fs.unlinkSync(imgFile.path); } catch (e) {}
        }
      }

      // Upload compressed asset to Cloudinary or serve locally
      const cloudResult = await uploadToCloudinarySafe(outPath, {
        folder: 'crm_templates',
        resource_type: 'image'
      });

      if (cloudResult) {
        if (fs.existsSync(outPath)) {
          try { fs.unlinkSync(outPath); } catch (e) {}
        }
        imgFile.filename = cloudResult.public_id;
        imgFile.url = cloudResult.secure_url;
        imgFile.mimetype = 'image/webp';
        imgFile.size = cloudResult.bytes || imgFile.size;
      } else {
        imgFile.filename = uniqueName;
        imgFile.url = `/uploads/templates/${uniqueName}`;
        imgFile.mimetype = 'image/webp';
        imgFile.size = fs.statSync(outPath).size;
      }
    }

    // 2. Process Video Upload (Strict max 15MB)
    if (req.files.video && req.files.video[0]) {
      const vidFile = req.files.video[0];
      const maxVideoSize = 15 * 1024 * 1024; // 15MB

      if (vidFile.size > maxVideoSize) {
        cleanupAllTemp();
        return res.status(400).json({ message: 'Video exceeds maximum 15MB size limit. Please upload a shorter or compressed clip.' });
      }

      const uniqueName = `video-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(vidFile.originalname) || '.mp4'}`;
      const outPath = path.join(finalDir, uniqueName);

      try {
        fs.copyFileSync(vidFile.path, outPath);
      } finally {
        if (fs.existsSync(vidFile.path)) {
          try { fs.unlinkSync(vidFile.path); } catch (e) {}
        }
      }

      const cloudResult = await uploadToCloudinarySafe(outPath, {
        folder: 'crm_templates',
        resource_type: 'video'
      });

      if (cloudResult) {
        if (fs.existsSync(outPath)) {
          try { fs.unlinkSync(outPath); } catch (e) {}
        }
        vidFile.filename = cloudResult.public_id;
        vidFile.url = cloudResult.secure_url;
        vidFile.size = cloudResult.bytes || vidFile.size;
      } else {
        vidFile.filename = uniqueName;
        vidFile.url = `/uploads/templates/${uniqueName}`;
        vidFile.size = fs.statSync(outPath).size;
      }
    }

    // 3. Process Document Upload (Strict max 15MB)
    if (req.files.doc && req.files.doc[0]) {
      const docFile = req.files.doc[0];
      const maxDocSize = 15 * 1024 * 1024; // 15MB

      if (docFile.size > maxDocSize) {
        cleanupAllTemp();
        return res.status(400).json({ message: 'Document exceeds maximum 15MB size limit.' });
      }

      const uniqueName = `doc-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(docFile.originalname) || '.pdf'}`;
      const outPath = path.join(finalDir, uniqueName);

      try {
        fs.copyFileSync(docFile.path, outPath);
      } finally {
        if (fs.existsSync(docFile.path)) {
          try { fs.unlinkSync(docFile.path); } catch (e) {}
        }
      }

      const cloudResult = await uploadToCloudinarySafe(outPath, {
        folder: 'crm_templates',
        resource_type: 'raw'
      });

      if (cloudResult) {
        if (fs.existsSync(outPath)) {
          try { fs.unlinkSync(outPath); } catch (e) {}
        }
        docFile.filename = cloudResult.public_id;
        docFile.url = cloudResult.secure_url;
        docFile.size = cloudResult.bytes || docFile.size;
      } else {
        docFile.filename = uniqueName;
        docFile.url = `/uploads/templates/${uniqueName}`;
        docFile.size = fs.statSync(outPath).size;
      }
    }

    next();
  } catch (err) {
    cleanupAllTemp();
    return res.status(400).json({ message: 'Error processing media uploads: ' + err.message });
  }
};

module.exports = {
  templateUpload: upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'video', maxCount: 1 },
    { name: 'doc', maxCount: 1 },
  ]),
  processTemplateUploads,
};
