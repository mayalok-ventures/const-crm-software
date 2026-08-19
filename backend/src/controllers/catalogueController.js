const MasterCollege = require('../models/MasterCollege');
const MasterCourse = require('../models/MasterCourse');
const TenantCatalogue = require('../models/TenantCatalogue');

/**
 * Seed initial comprehensive master repository of Colleges & Courses
 */
const SEED_MASTER_COLLEGES = [
  {
    name: 'Vellore Institute of Technology (VIT)',
    shortCode: 'VIT',
    location: { city: 'Vellore', state: 'Tamil Nadu', country: 'India' },
    type: 'Deemed University',
    accreditation: ['NAAC A++', 'NIRF Top 10 Engineering', 'AICTE'],
    establishedYear: 1984,
    website: 'https://vit.ac.in',
    isFeatured: true,
    courses: [
      {
        degreeName: 'B.Tech',
        level: 'Undergraduate',
        durationYears: 4,
        standardAnnualFee: 200000,
        specializations: ['Computer Science & Engineering', 'Artificial Intelligence & Machine Learning', 'Cyber Security', 'Data Analytics', 'Electronics & Communication (ECE)', 'Mechanical Engineering'],
      },
      {
        degreeName: 'MBA',
        level: 'Postgraduate',
        durationYears: 2,
        standardAnnualFee: 350000,
        specializations: ['Business Analytics', 'Finance & Banking', 'Digital Marketing', 'Operations & Supply Chain'],
      },
      {
        degreeName: 'MCA',
        level: 'Postgraduate',
        durationYears: 2,
        standardAnnualFee: 140000,
        specializations: ['Cloud Computing', 'Enterprise Application Development'],
      },
    ],
  },
  {
    name: 'Manipal Academy of Higher Education (MAHE)',
    shortCode: 'MAHE',
    location: { city: 'Manipal', state: 'Karnataka', country: 'India' },
    type: 'Deemed University',
    accreditation: ['Institute of Eminence (IoE)', 'NAAC A++', 'NIRF Ranked'],
    establishedYear: 1953,
    website: 'https://manipal.edu',
    isFeatured: true,
    courses: [
      {
        degreeName: 'B.Tech',
        level: 'Undergraduate',
        durationYears: 4,
        standardAnnualFee: 335000,
        specializations: ['Computer Science', 'Information Technology', 'Biomedical Engineering', 'Mechatronics', 'Aeronautical Engineering'],
      },
      {
        degreeName: 'MBBS',
        level: 'Undergraduate',
        durationYears: 5.5,
        standardAnnualFee: 1780000,
        specializations: ['Medicine & Surgery (KMC Manipal)'],
      },
      {
        degreeName: 'BBA',
        level: 'Undergraduate',
        durationYears: 3,
        standardAnnualFee: 250000,
        specializations: ['FinTech', 'Marketing & E-Commerce', 'Human Resource Management'],
      },
    ],
  },
  {
    name: 'Symbiosis International University (SIU)',
    shortCode: 'SIU',
    location: { city: 'Pune', state: 'Maharashtra', country: 'India' },
    type: 'Deemed University',
    accreditation: ['NAAC A++', 'UGC Approved', 'AACSB Member'],
    establishedYear: 1971,
    website: 'https://siu.edu.in',
    isFeatured: true,
    courses: [
      {
        degreeName: 'MBA (SIBM Pune)',
        level: 'Postgraduate',
        durationYears: 2,
        standardAnnualFee: 1100000,
        specializations: ['Marketing', 'Finance', 'Human Resources', 'Operations Strategy'],
      },
      {
        degreeName: 'BA LLB (Hons) / BBA LLB',
        level: 'Undergraduate',
        durationYears: 5,
        standardAnnualFee: 420000,
        specializations: ['Corporate Law', 'Intellectual Property Law', 'Constitutional Law'],
      },
      {
        degreeName: 'BBA',
        level: 'Undergraduate',
        durationYears: 3,
        standardAnnualFee: 360000,
        specializations: ['Global Business Operations', 'Entrepreneurship'],
      },
    ],
  },
  {
    name: 'Amity University',
    shortCode: 'AMITY',
    location: { city: 'Noida', state: 'Uttar Pradesh', country: 'India' },
    type: 'Private University',
    accreditation: ['NAAC A+', 'WASC USA Accredited', 'AICTE'],
    establishedYear: 2005,
    website: 'https://amity.edu',
    isFeatured: true,
    courses: [
      {
        degreeName: 'B.Tech',
        level: 'Undergraduate',
        durationYears: 4,
        standardAnnualFee: 260000,
        specializations: ['Computer Science & Engg', 'Aerospace Engineering', 'Biotechnology', 'Internet of Things (IoT)'],
      },
      {
        degreeName: 'MBA',
        level: 'Postgraduate',
        durationYears: 2,
        standardAnnualFee: 680000,
        specializations: ['International Business', 'Retail Management', 'Media Management'],
      },
      {
        degreeName: 'B.Des / Fashion Design',
        level: 'Undergraduate',
        durationYears: 4,
        standardAnnualFee: 210000,
        specializations: ['Fashion Communication', 'Product & Interior Design'],
      },
    ],
  },
  {
    name: 'Northeastern University',
    shortCode: 'NEU',
    location: { city: 'Boston', state: 'Massachusetts', country: 'USA' },
    type: 'Overseas University',
    accreditation: ['NECHE', 'Top Tier R1 Research', 'Global Co-op Ranked #1'],
    establishedYear: 1898,
    website: 'https://northeastern.edu',
    isFeatured: true,
    courses: [
      {
        degreeName: 'MS in Computer Science',
        level: 'Postgraduate',
        durationYears: 2,
        standardAnnualFee: 2800000,
        specializations: ['Artificial Intelligence', 'Software Engineering', 'Human-Computer Interaction'],
      },
      {
        degreeName: 'MS in Data Analytics & Engineering',
        level: 'Postgraduate',
        durationYears: 2,
        standardAnnualFee: 2600000,
        specializations: ['Big Data Architecture', 'Predictive Modeling'],
      },
      {
        degreeName: 'Full-Time MBA',
        level: 'Postgraduate',
        durationYears: 2,
        standardAnnualFee: 4200000,
        specializations: ['Corporate Innovation', 'Supply Chain Analytics', 'Global Finance'],
      },
    ],
  },
  {
    name: 'University of Manchester',
    shortCode: 'UoM',
    location: { city: 'Manchester', state: 'Greater Manchester', country: 'United Kingdom' },
    type: 'Overseas University',
    accreditation: ['Russell Group', 'QS World Top 35', 'Triple Crown Business School'],
    establishedYear: 1824,
    website: 'https://manchester.ac.uk',
    isFeatured: true,
    courses: [
      {
        degreeName: 'MSc in Advanced Computer Science',
        level: 'Postgraduate',
        durationYears: 1,
        standardAnnualFee: 3200000,
        specializations: ['Machine Learning', 'Computer Security', 'Data Management'],
      },
      {
        degreeName: 'MSc in Finance',
        level: 'Postgraduate',
        durationYears: 1,
        standardAnnualFee: 3500000,
        specializations: ['Quantitative Finance', 'Corporate Financial Strategy'],
      },
      {
        degreeName: 'BSc in Management / International Business',
        level: 'Undergraduate',
        durationYears: 3,
        standardAnnualFee: 2900000,
        specializations: ['International Marketing', 'Strategic Consulting'],
      },
    ],
  },
];

// @desc  Seed master college & course database (Auto-runs if empty or via API)
// @route POST /api/catalogue/seed-master
// @access Private (Admin / System)
exports.seedMasterCatalogue = async (req, res) => {
  try {
    const existingCount = await MasterCollege.countDocuments();
    if (existingCount > 0 && (!req?.body?.force)) {
      return res.json({ success: true, message: `Master catalogue already populated (${existingCount} colleges).`, count: existingCount });
    }

    let seededColleges = 0;
    let seededCourses = 0;

    for (const item of SEED_MASTER_COLLEGES) {
      const { courses, ...collegeData } = item;
      const college = await MasterCollege.findOneAndUpdate(
        { name: collegeData.name },
        { ...collegeData },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      seededColleges++;

      if (Array.isArray(courses)) {
        for (const courseData of courses) {
          await MasterCourse.findOneAndUpdate(
            { collegeId: college._id, degreeName: courseData.degreeName },
            { ...courseData, collegeId: college._id },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
          seededCourses++;
        }
      }
    }

    const responsePayload = {
      success: true,
      message: `🎉 Master Catalogue initialized with ${seededColleges} Colleges and ${seededCourses} Degree Programs!`,
      collegesCount: seededColleges,
      coursesCount: seededCourses,
    };

    if (res) return res.status(201).json(responsePayload);
    return responsePayload;
  } catch (error) {
    console.error('seedMasterCatalogue error:', error);
    if (res) return res.status(500).json({ success: false, message: error.message || 'Failed to seed master catalogue' });
  }
};

// @desc  Search & browse Global Master Colleges
// @route GET /api/catalogue/master-colleges
// @access Private
exports.getMasterColleges = async (req, res) => {
  try {
    const { search, country, state, type, page = 1, limit = 50 } = req.query;
    const query = { isActive: true };

    if (country && country !== 'all') {
      query['location.country'] = new RegExp(`^${country}$`, 'i');
    }
    if (state && state !== 'all') {
      query['location.state'] = new RegExp(state, 'i');
    }
    if (type && type !== 'all') {
      query.type = type;
    }

    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(escaped, 'i');
      query.$or = [
        { name: rx },
        { shortCode: rx },
        { 'location.city': rx },
        { 'location.state': rx },
        { 'location.country': rx },
        { accreditation: rx },
      ];
    }

    // Auto-seed if empty
    const totalCount = await MasterCollege.countDocuments();
    if (totalCount === 0) {
      await exports.seedMasterCatalogue();
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [colleges, total] = await Promise.all([
      MasterCollege.find(query)
        .sort({ isFeatured: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      MasterCollege.countDocuments(query),
    ]);

    // Attach courses count and summary to each college
    const collegeIds = colleges.map(c => c._id);
    const courses = await MasterCourse.find({ collegeId: { $in: collegeIds }, isActive: true }).lean();

    const courseMap = {};
    courses.forEach(crs => {
      const cid = String(crs.collegeId);
      if (!courseMap[cid]) courseMap[cid] = [];
      courseMap[cid].push(crs);
    });

    // Check which colleges are already in this tenant's catalogue
    const tenantCompanyId = req.user.companyId || (req.user.workStatus === 'company_owner' ? req.user._id : null);
    const tenantQuery = tenantCompanyId
      ? { $or: [{ companyId: tenantCompanyId }, { tenantId: req.user._id }] }
      : { tenantId: req.user._id };

    const importedColleges = await TenantCatalogue.find(tenantQuery).select('masterCollegeId').lean();
    const importedSet = new Set(importedColleges.map(ic => String(ic.masterCollegeId)));

    const enriched = colleges.map(col => {
      const colCourses = courseMap[String(col._id)] || [];
      return {
        ...col,
        coursesCount: colCourses.length,
        availableDegrees: colCourses.map(c => c.degreeName),
        courses: colCourses,
        isImported: importedSet.has(String(col._id)),
      };
    });

    res.json({
      success: true,
      colleges: enriched,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error('getMasterColleges error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc  Get Master College Details with all degree courses
// @route GET /api/catalogue/master-colleges/:id
// @access Private
exports.getMasterCollegeById = async (req, res) => {
  try {
    const college = await MasterCollege.findById(req.params.id).lean();
    if (!college) return res.status(404).json({ success: false, message: 'College not found' });

    const courses = await MasterCourse.find({ collegeId: college._id, isActive: true }).lean();
    res.json({ success: true, college: { ...college, courses } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc  1-CLICK IMPORT: Imports Master College & Auto-Maps all courses into TenantCatalogue
// @route POST /api/catalogue/import/:collegeId
// @access Private
exports.importCollegeToCatalogue = async (req, res) => {
  try {
    const { collegeId } = req.params;
    const { defaultCommissionRate = 10, defaultMouStatus = 'direct_tie_up' } = req.body;

    const masterCollege = await MasterCollege.findById(collegeId).lean();
    if (!masterCollege) {
      return res.status(404).json({ success: false, message: 'Master College not found' });
    }

    const tenantCompanyId = req.user.companyId || (req.user.workStatus === 'company_owner' ? req.user._id : null);

    // Check if already in tenant's catalogue
    let existing = await TenantCatalogue.findOne({
      tenantId: req.user._id,
      masterCollegeId: masterCollege._id,
    });

    if (existing) {
      return res.status(200).json({
        success: true,
        message: `${masterCollege.name} is already in your catalogue.`,
        catalogueItem: existing,
        alreadyImported: true,
      });
    }

    // Auto-fetch all MasterCourses for this college
    const masterCourses = await MasterCourse.find({ collegeId: masterCollege._id, isActive: true }).lean();

    // Flatten & auto-map courses into TenantCatalogue draft
    const mappedCourses = [];
    if (masterCourses.length > 0) {
      for (const mc of masterCourses) {
        if (Array.isArray(mc.specializations) && mc.specializations.length > 0) {
          for (const spec of mc.specializations) {
            mappedCourses.push({
              degreeName: mc.degreeName,
              specialization: spec,
              customFeeStructure: {
                annualTuitionFee: mc.standardAnnualFee || 0,
                packageFee: (mc.standardAnnualFee || 0) * (mc.durationYears || 1),
                hostelFeePerYear: 90000,
                oneTimeAdmissionFee: 25000,
                currency: masterCollege.location?.country === 'USA' ? 'USD' : (masterCollege.location?.country === 'United Kingdom' ? 'GBP' : 'INR'),
                feeNotes: 'Standard Master fee preset. Customize as per MOU.',
              },
              customTieUpDetails: {
                commissionType: 'percentage',
                commissionRate: defaultCommissionRate,
                mouStatus: defaultMouStatus,
                contactPersonName: '',
                contactPersonPhone: '',
                contactPersonEmail: '',
                notes: 'Imported from Master Repository',
              },
              admissionStatus: 'admissions_open',
              quotaType: 'management_quota',
              isActive: true,
            });
          }
        } else {
          mappedCourses.push({
            degreeName: mc.degreeName,
            specialization: 'General',
            customFeeStructure: {
              annualTuitionFee: mc.standardAnnualFee || 0,
              packageFee: (mc.standardAnnualFee || 0) * (mc.durationYears || 1),
              hostelFeePerYear: 90000,
              oneTimeAdmissionFee: 25000,
              currency: 'INR',
              feeNotes: '',
            },
            customTieUpDetails: {
              commissionType: 'percentage',
              commissionRate: defaultCommissionRate,
              mouStatus: defaultMouStatus,
              contactPersonName: '',
              notes: '',
            },
            admissionStatus: 'admissions_open',
            quotaType: 'management_quota',
            isActive: true,
          });
        }
      }
    }

    const catalogueItem = await TenantCatalogue.create({
      tenantId: req.user._id,
      companyId: tenantCompanyId,
      masterCollegeId: masterCollege._id,
      customCollegeName: masterCollege.name,
      collegeType: masterCollege.type,
      location: masterCollege.location,
      logoUrl: masterCollege.logoUrl,
      website: masterCollege.website,
      courses: mappedCourses,
      tags: ['Imported', masterCollege.type, masterCollege.location?.country || 'India'],
      notes: `Imported from master repository by ${req.user.name}`,
    });

    res.status(201).json({
      success: true,
      message: `🎉 Successfully imported ${masterCollege.name} with ${mappedCourses.length} course streams!`,
      catalogueItem,
    });
  } catch (error) {
    console.error('importCollegeToCatalogue error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to import college' });
  }
};

// @desc  Get Tenant's Customized Catalogue
// @route GET /api/catalogue/my-catalogue
// @access Private
exports.getMyCatalogue = async (req, res) => {
  try {
    const { search, country, status } = req.query;

    const isOwner = req.user.workStatus === 'company_owner' || req.user.companyRole === 'owner';
    const companyId = req.user.companyId || (isOwner ? req.user._id : null);

    // Enforce multi-tenant access: Org Owner & sub-agents see org catalogue; Solo users see their own
    const query = companyId
      ? { $or: [{ companyId }, { tenantId: companyId }, { tenantId: req.user._id }] }
      : { tenantId: req.user._id };

    if (country && country !== 'all') {
      query['location.country'] = new RegExp(`^${country}$`, 'i');
    }

    if (search && search.trim()) {
      const rx = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { customCollegeName: rx },
        { 'location.city': rx },
        { 'location.state': rx },
        { 'courses.degreeName': rx },
        { 'courses.specialization': rx },
      ];
    }

    const items = await TenantCatalogue.find(query)
      .populate('masterCollegeId', 'name accreditation establishedYear shortCode')
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    res.json({
      success: true,
      count: items.length,
      catalogue: items,
    });
  } catch (error) {
    console.error('getMyCatalogue error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc  Get Single Tenant Catalogue College Details
// @route GET /api/catalogue/my-catalogue/:id
// @access Private
exports.getTenantCatalogueItem = async (req, res) => {
  try {
    const isOwner = req.user.workStatus === 'company_owner' || req.user.companyRole === 'owner';
    const companyId = req.user.companyId || (isOwner ? req.user._id : null);

    const query = {
      _id: req.params.id,
      ...(companyId
        ? { $or: [{ companyId }, { tenantId: companyId }, { tenantId: req.user._id }] }
        : { tenantId: req.user._id }),
    };

    const item = await TenantCatalogue.findOne(query)
      .populate('masterCollegeId')
      .lean();

    if (!item) return res.status(404).json({ success: false, message: 'Catalogue item not found' });

    res.json({ success: true, catalogueItem: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc  Update Fee Structure, Tie-Up Details & Courses on a Tenant Catalogue item
// @route PUT /api/catalogue/my-catalogue/:id
// @access Private
exports.updateTenantCatalogueItem = async (req, res) => {
  try {
    const isOwner = req.user.workStatus === 'company_owner' || req.user.companyRole === 'owner';
    const companyId = req.user.companyId || (isOwner ? req.user._id : null);

    const query = {
      _id: req.params.id,
      ...(companyId
        ? { $or: [{ companyId }, { tenantId: companyId }, { tenantId: req.user._id }] }
        : { tenantId: req.user._id }),
    };

    const item = await TenantCatalogue.findOne(query);
    if (!item) return res.status(404).json({ success: false, message: 'Catalogue item not found' });

    const {
      customCollegeName,
      courses,
      notes,
      tags,
      priorityRank,
      location,
    } = req.body;

    if (customCollegeName) item.customCollegeName = customCollegeName.trim();
    if (notes !== undefined) item.notes = notes;
    if (tags !== undefined) item.tags = tags;
    if (priorityRank !== undefined) item.priorityRank = Number(priorityRank);
    if (location) item.location = { ...item.location, ...location };

    if (Array.isArray(courses)) {
      item.courses = courses;
    }

    await item.save();

    res.json({
      success: true,
      message: 'Catalogue item & fee structure updated successfully ✅',
      catalogueItem: item,
    });
  } catch (error) {
    console.error('updateTenantCatalogueItem error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update catalogue item' });
  }
};

// @desc  Remove a College from Tenant's Catalogue
// @route DELETE /api/catalogue/my-catalogue/:id
// @access Private
exports.deleteTenantCatalogueItem = async (req, res) => {
  try {
    const isOwner = req.user.workStatus === 'company_owner' || req.user.companyRole === 'owner';
    const companyId = req.user.companyId || (isOwner ? req.user._id : null);

    const query = {
      _id: req.params.id,
      ...(companyId
        ? { $or: [{ companyId }, { tenantId: companyId }, { tenantId: req.user._id }] }
        : { tenantId: req.user._id }),
    };

    const item = await TenantCatalogue.findOneAndDelete(query);
    if (!item) return res.status(404).json({ success: false, message: 'Catalogue item not found' });

    res.json({ success: true, message: `${item.customCollegeName} removed from your catalogue ✅` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};
