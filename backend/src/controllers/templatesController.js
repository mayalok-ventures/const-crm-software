const Template = require('../models/Template');
const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;

const deleteFile = async (filename) => {
  if (!filename) return;
  if (filename.startsWith('crm_templates/') || filename.includes('/')) {
    try {
      let resourceType = 'image';
      if (filename.includes('video')) resourceType = 'video';
      else if (filename.includes('doc')) resourceType = 'raw';
      await cloudinary.uploader.destroy(filename, { resource_type: resourceType });
    } catch (e) {
      console.error(`Failed to delete Cloudinary asset ${filename}:`, e.message);
    }
  } else {
    const filePath = path.join(__dirname, '../../uploads/templates', filename);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        console.error(`Failed to delete local file ${filename}:`, e.message);
      }
    }
  }
};

const getFileObject = (file, req) => {
  if (!file) return null;
  return {
    filename: file.filename,
    originalName: file.originalname,
    size: file.size,
    mimetype: file.mimetype,
    url: file.url || `/uploads/templates/${file.filename}`
  };
};

// @desc  Get user & company templates
// @route GET /api/templates
// @access Private
exports.getTemplates = async (req, res) => {
  try {
    const companyId = req.user.companyId || (req.user.companyRole === 'owner' ? req.user._id : null);
    const query = {
      $or: [
        { userId: req.user._id },
        ...(companyId ? [{ userId: companyId }] : [])
      ]
    };

    const templates = await Template.find(query)
      .sort({ usageCount: -1, createdAt: -1 })
      .limit(60)
      .lean();

    res.json(templates);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Create template with media attachments
// @route POST /api/templates
// @access Private
exports.createTemplate = async (req, res) => {
  try {
    const { title, text, tags, category } = req.body;
    if (!title || !text) return res.status(400).json({ message: 'Title and message text are required' });

    let parsedTags = [];
    if (tags) {
      parsedTags = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()).filter(Boolean);
    }

    const imageFile = req.files?.image ? getFileObject(req.files.image[0], req) : null;
    const videoFile = req.files?.video ? getFileObject(req.files.video[0], req) : null;
    const docFile = req.files?.doc ? getFileObject(req.files.doc[0], req) : null;

    const template = await Template.create({
      userId: req.user._id,
      title: title.trim(),
      text: text.trim(),
      category: category || 'general',
      imageFile,
      videoFile,
      docFile,
      tags: parsedTags,
    });

    res.status(201).json(template);
  } catch (error) {
    console.error('createTemplate error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// @desc  Update template
// @route PUT /api/templates/:id
// @access Private
exports.updateTemplate = async (req, res) => {
  try {
    const template = await Template.findOne({ _id: req.params.id, userId: req.user._id });
    if (!template) return res.status(404).json({ message: 'Template not found' });

    const { title, text, tags, category, removeImage, removeVideo, removeDoc } = req.body;
    if (title) template.title = title.trim();
    if (text) template.text = text.trim();
    if (category) template.category = category;
    
    if (tags) {
      template.tags = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()).filter(Boolean);
    }

    // Removals
    if (removeImage === 'true' || removeImage === true) {
      if (template.imageFile) {
        deleteFile(template.imageFile.filename);
        template.imageFile = null;
      }
    }
    if (removeVideo === 'true' || removeVideo === true) {
      if (template.videoFile) {
        deleteFile(template.videoFile.filename);
        template.videoFile = null;
      }
    }
    if (removeDoc === 'true' || removeDoc === true) {
      if (template.docFile) {
        deleteFile(template.docFile.filename);
        template.docFile = null;
      }
    }

    // New uploads
    if (req.files?.image) {
      if (template.imageFile) deleteFile(template.imageFile.filename);
      template.imageFile = getFileObject(req.files.image[0], req);
    }
    if (req.files?.video) {
      if (template.videoFile) deleteFile(template.videoFile.filename);
      template.videoFile = getFileObject(req.files.video[0], req);
    }
    if (req.files?.doc) {
      if (template.docFile) deleteFile(template.docFile.filename);
      template.docFile = getFileObject(req.files.doc[0], req);
    }

    await template.save();
    res.json(template);
  } catch (error) {
    console.error('updateTemplate error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// @desc  Delete template
// @route DELETE /api/templates/:id
// @access Private
exports.deleteTemplate = async (req, res) => {
  try {
    const template = await Template.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!template) return res.status(404).json({ message: 'Template not found' });

    if (template.imageFile) deleteFile(template.imageFile.filename);
    if (template.videoFile) deleteFile(template.videoFile.filename);
    if (template.docFile) deleteFile(template.docFile.filename);

    res.json({ message: 'Template deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Track template use
// @route POST /api/templates/:id/use
// @access Private
exports.useTemplate = async (req, res) => {
  try {
    await Template.findByIdAndUpdate(req.params.id, { $inc: { usageCount: 1 } });
    res.json({ message: 'Template usage incremented' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};
