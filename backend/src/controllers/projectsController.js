const Project = require('../models/Project');

// @desc  Get agency / agent projects
// @route GET /api/projects
// @access Private
exports.getProjects = async (req, res) => {
  try {
    const { search, city, status } = req.query;
    const companyId = req.user.companyId || (req.user.companyRole === 'owner' ? req.user._id : null);

    const basePermissionQuery = {
      $or: [
        { userId: req.user._id },
        ...(companyId ? [{ companyId }, { userId: companyId }] : [])
      ]
    };

    const query = {
      isActive: true,
      $and: [ basePermissionQuery ]
    };

    if (status) query.status = status;
    if (city && city.trim()) {
      const safeCity = city.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.city = new RegExp(safeCity, 'i');
    }
    if (search && search.trim()) {
      const safeSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$and.push({
        $or: [
          { name: new RegExp(safeSearch, 'i') },
          { location: new RegExp(safeSearch, 'i') },
          { vendorOrBrand: new RegExp(safeSearch, 'i') },
          { developer: new RegExp(safeSearch, 'i') },
        ]
      });
    }

    const projects = await Project.find(query)
      .sort({ createdAt: -1 })
      .lean();

    res.json(projects);
  } catch (error) {
    console.error('getProjects error:', error);
    res.status(500).json({ message: 'Failed to fetch catalog projects' });
  }
};

// @desc  Get single project (Tenant-isolated)
// @route GET /api/projects/:id
// @access Private
exports.getProjectById = async (req, res) => {
  try {
    const companyId = req.user.companyId || (req.user.companyRole === 'owner' ? req.user._id : null);

    const project = await Project.findOne({
      _id: req.params.id,
      isActive: true,
      $or: [
        { userId: req.user._id },
        ...(companyId ? [{ companyId }, { userId: companyId }] : [])
      ]
    }).lean();

    if (!project) {
      return res.status(404).json({ message: 'Catalog item not found or unauthorized' });
    }
    res.json(project);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch catalog item' });
  }
};

// @desc  Create new project / product catalog item
// @route POST /api/projects
// @access Private
exports.createProject = async (req, res) => {
  try {
    const {
      name,
      location,
      city,
      vendorOrBrand,
      developer,
      basePrice,
      productCategory,
      configuration,
      amenities,
      deliveryOrCompletionDate,
      possessionDate,
      description,
      brochureUrl,
      images,
      status,
      referenceId,
      reraNumber,
    } = req.body;

    if (!name || !location) {
      return res.status(400).json({ message: 'Name and Location/Market are required' });
    }

    // Dynamic Product/Package Form Schema Validation
    const { validateFormData, getDefaultProductFormSchema } = require('../utils/formValidator');
    const activeProductSchema = (req.user?.productFormSchema && Array.isArray(req.user.productFormSchema) && req.user.productFormSchema.length > 0)
      ? req.user.productFormSchema
      : getDefaultProductFormSchema();

    const validationResult = validateFormData(activeProductSchema, req.body);
    if (!validationResult.isValid) {
      const firstError = Object.values(validationResult.errors)[0] || 'Validation failed';
      return res.status(400).json({
        message: firstError,
        errors: validationResult.errors,
      });
    }

    const companyId = req.user.companyId || (req.user.companyRole === 'owner' ? req.user._id : null);
    const resolvedVendor = vendorOrBrand || developer || (req.user.companyInfo?.companyName || '');
    const resolvedRef = referenceId || reraNumber || '';
    const resolvedDate = deliveryOrCompletionDate || possessionDate || '';

    let categories = [];
    if (productCategory) {
      categories = Array.isArray(productCategory) ? productCategory : productCategory.split(',').map(c => c.trim()).filter(Boolean);
    } else if (configuration) {
      categories = Array.isArray(configuration) ? configuration : configuration.split(',').map(c => c.trim()).filter(Boolean);
    }

    const standardProjectKeys = new Set([
      'name', 'location', 'city', 'vendorOrBrand', 'developer', 'basePrice',
      'productCategory', 'configuration', 'amenities', 'deliveryOrCompletionDate',
      'possessionDate', 'description', 'brochureUrl', 'images', 'status',
      'referenceId', 'reraNumber', 'customData'
    ]);

    const extraCustomData = {};
    for (const key of Object.keys(req.body)) {
      if (!standardProjectKeys.has(key)) {
        extraCustomData[key] = req.body[key];
      }
    }
    const finalCustomData = {
      ...(typeof req.body.customData === 'object' ? req.body.customData : {}),
      ...extraCustomData,
    };

    const project = await Project.create({
      userId: req.user._id,
      companyId,
      name: name.trim(),
      location: location.trim(),
      city: city ? city.trim() : '',
      vendorOrBrand: resolvedVendor.trim(),
      developer: resolvedVendor.trim(),
      basePrice: basePrice || '',
      productCategory: categories,
      configuration: categories,
      amenities: Array.isArray(amenities) ? amenities : (amenities ? amenities.split(',').map(a => a.trim()).filter(Boolean) : []),
      deliveryOrCompletionDate: resolvedDate,
      possessionDate: resolvedDate,
      description: description || '',
      brochureUrl: brochureUrl || null,
      images: Array.isArray(images) ? images : [],
      status: status || 'available',
      referenceId: resolvedRef,
      reraNumber: resolvedRef,
      customData: finalCustomData,
    });

    res.status(201).json(project);
  } catch (error) {
    console.error('createProject error:', error);
    res.status(500).json({ message: error.message || 'Failed to create item' });
  }
};

// @desc  Update project / item (Tenant-isolated)
// @route PUT /api/projects/:id
// @access Private
exports.updateProject = async (req, res) => {
  try {
    const companyId = req.user.companyId || (req.user.companyRole === 'owner' ? req.user._id : null);

    const project = await Project.findOne({
      _id: req.params.id,
      $or: [
        { userId: req.user._id },
        ...(companyId ? [{ companyId }, { userId: companyId }] : [])
      ]
    });

    if (!project) {
      return res.status(404).json({ message: 'Item not found or unauthorized' });
    }

    const allowedFields = [
      'name', 'location', 'city', 'vendorOrBrand', 'developer', 'basePrice',
      'productCategory', 'configuration', 'amenities', 'deliveryOrCompletionDate',
      'possessionDate', 'description', 'brochureUrl', 'images', 'status',
      'referenceId', 'reraNumber'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'productCategory' || field === 'configuration' || field === 'amenities') {
          project[field] = Array.isArray(req.body[field])
            ? req.body[field]
            : (req.body[field] ? req.body[field].split(',').map(x => x.trim()).filter(Boolean) : []);
        } else {
          project[field] = req.body[field];
        }
      }
    });

    // Keep aliases synced
    if (req.body.vendorOrBrand) project.developer = req.body.vendorOrBrand;
    if (req.body.developer) project.vendorOrBrand = req.body.developer;
    if (req.body.referenceId) project.reraNumber = req.body.referenceId;
    if (req.body.reraNumber) project.referenceId = req.body.reraNumber;
    if (req.body.deliveryOrCompletionDate) project.possessionDate = req.body.deliveryOrCompletionDate;
    if (req.body.possessionDate) project.deliveryOrCompletionDate = req.body.possessionDate;
    if (req.body.productCategory) project.configuration = project.productCategory;
    if (req.body.configuration) project.productCategory = project.configuration;

    await project.save();
    res.json(project);
  } catch (error) {
    console.error('updateProject error:', error);
    res.status(500).json({ message: error.message || 'Failed to update item' });
  }
};

// @desc  Delete project / item (Tenant-isolated)
// @route DELETE /api/projects/:id
// @access Private
exports.deleteProject = async (req, res) => {
  try {
    const companyId = req.user.companyId || (req.user.companyRole === 'owner' ? req.user._id : null);

    const project = await Project.findOneAndDelete({
      _id: req.params.id,
      $or: [
        { userId: req.user._id },
        ...(companyId ? [{ companyId }, { userId: companyId }] : [])
      ]
    });

    if (!project) {
      return res.status(404).json({ message: 'Item not found or unauthorized' });
    }

    res.json({ message: 'Item removed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};
