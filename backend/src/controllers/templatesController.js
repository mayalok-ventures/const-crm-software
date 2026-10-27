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

// @desc  Get user & company templates (with optional channel and category filtering)
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

    if (req.query.channel) {
      query.channel = { $regex: new RegExp(`^${req.query.channel.trim()}$`, 'i') };
    }

    if (req.query.category) {
      query.category = req.query.category.trim();
    }

    const templates = await Template.find(query)
      .sort({ usageCount: -1, updatedAt: -1, createdAt: -1 })
      .limit(100)
      .lean();

    res.json(templates);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Create template with media attachments or rich email formatting
// @route POST /api/templates
// @access Private
exports.createTemplate = async (req, res) => {
  try {
    const { title, name, text, content, subject, bodyHtml, channel, tags, category, variables } = req.body;
    const templateTitle = (title || name || '').trim();
    if (!templateTitle) {
      return res.status(400).json({ message: 'Template title is required' });
    }

    const resolvedChannel = (channel || 'WHATSAPP').toUpperCase();
    let resolvedText = (text || content || '').trim();
    let resolvedHtml = (bodyHtml || '').trim();

    // If email template has bodyHtml but no text, generate plain text fallback
    if (!resolvedText && resolvedHtml) {
      resolvedText = resolvedHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    // If template has text but no HTML, wrap into basic HTML paragraph
    if (!resolvedHtml && resolvedText) {
      resolvedHtml = `<p>${resolvedText.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`;
    }

    if (!resolvedText && !resolvedHtml) {
      return res.status(400).json({ message: 'Template message or HTML body is required' });
    }

    let parsedTags = [];
    if (tags) {
      parsedTags = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()).filter(Boolean);
    }

    let parsedVariables = [];
    if (variables) {
      parsedVariables = Array.isArray(variables) ? variables : variables.split(',').map(v => v.trim()).filter(Boolean);
    } else {
      // Auto-extract {{variable}} patterns
      const combined = `${subject || ''} ${resolvedHtml} ${resolvedText}`;
      const matches = combined.match(/{{\s*([a-zA-Z0-9_]+)\s*}}/g);
      if (matches) {
        parsedVariables = Array.from(new Set(matches.map(m => m.replace(/[{}]/g, '').trim())));
      }
    }

    const imageFile = req.files?.image ? getFileObject(req.files.image[0], req) : null;
    const videoFile = req.files?.video ? getFileObject(req.files.video[0], req) : null;
    const docFile = req.files?.doc ? getFileObject(req.files.doc[0], req) : null;

    const template = await Template.create({
      userId: req.user._id,
      createdBy: req.user._id,
      workspaceId: req.user.workspaceId || req.user.activeWorkspaceId || null,
      title: templateTitle,
      name: templateTitle,
      channel: resolvedChannel,
      subject: (subject || '').trim(),
      text: resolvedText,
      content: resolvedText,
      bodyHtml: resolvedHtml,
      category: category || 'general',
      imageFile,
      videoFile,
      docFile,
      tags: parsedTags,
      variables: parsedVariables,
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

    const { title, name, text, content, subject, bodyHtml, channel, tags, category, variables, removeImage, removeVideo, removeDoc } = req.body;
    if (title || name) {
      const t = (title || name).trim();
      template.title = t;
      template.name = t;
    }
    if (channel) template.channel = channel.toUpperCase();
    if (subject !== undefined) template.subject = (subject || '').trim();
    if (bodyHtml !== undefined) template.bodyHtml = bodyHtml;
    if (text !== undefined || content !== undefined) {
      const val = (text || content || '').trim();
      template.text = val;
      template.content = val;
    }
    if (category) template.category = category;
    
    if (tags !== undefined) {
      template.tags = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()).filter(Boolean);
    }
    if (variables !== undefined) {
      template.variables = Array.isArray(variables) ? variables : variables.split(',').map(v => v.trim()).filter(Boolean);
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
