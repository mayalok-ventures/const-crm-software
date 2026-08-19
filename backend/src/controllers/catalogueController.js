const MasterCollege = require('../models/MasterCollege');
const MasterCourse = require('../models/MasterCourse');
const TenantCatalogue = require('../models/TenantCatalogue');
const { COMMON_DEGREES } = require('../utils/commonDegrees');

// Comprehensive Pre-seeded Master Universities Database
const SEED_MASTER_COLLEGES = [
  {
    name: 'Vellore Institute of Technology (VIT)',
    shortCode: 'VIT',
    location: { city: 'Vellore', state: 'Tamil Nadu', country: 'India' },
    type: 'Deemed University',
    accreditation: ['NAAC A++', 'NIRF Top 10', 'AICTE Approved', 'ABET Accredited'],
    establishedYear: 1984,
    website: 'https://vit.ac.in',
    isFeatured: true,
    courses: [
      {
        degreeName: 'B.Tech / B.E.',
        level: 'Undergraduate',
        durationYears: 4,
        standardAnnualFee: 245000,
        specializations: [
          'Computer Science & Engineering (CSE)',
          'Artificial Intelligence & Machine Learning',
          'Data Science',
          'Cyber Security',
          'Mechanical Engineering',
          'Civil Engineering',
          'Electronics & Communication (ECE)',
          'Electrical & Electronics (EEE)',
          'Biotechnology',
        ],
      },
      {
        degreeName: 'M.Tech / M.E.',
        level: 'Postgraduate',
        durationYears: 2,
        standardAnnualFee: 180000,
        specializations: ['Computer Science', 'VLSI Design', 'Software Engineering', 'Automotive Engineering'],
      },
      {
        degreeName: 'BCA (Bachelor of Computer Applications)',
        level: 'Undergraduate',
        durationYears: 3,
        standardAnnualFee: 120000,
        specializations: ['Full Stack Web Development', 'Data Analytics', 'General'],
      },
      {
        degreeName: 'MCA (Master of Computer Applications)',
        level: 'Postgraduate',
        durationYears: 2,
        standardAnnualFee: 140000,
        specializations: ['Cloud Computing', 'Enterprise Applications'],
      },
      {
        degreeName: 'MBA (Master of Business Administration)',
        level: 'Postgraduate',
        durationYears: 2,
        standardAnnualFee: 350000,
        specializations: ['Finance', 'Marketing', 'Business Analytics', 'Human Resources', 'Operations'],
      },
    ],
  },
  {
    name: 'Manipal Academy of Higher Education (MAHE)',
    shortCode: 'MAHE',
    location: { city: 'Manipal', state: 'Karnataka', country: 'India' },
    type: 'Deemed University',
    accreditation: ['NAAC A++', 'Institution of Eminence', 'NIRF Top 10', 'MCI / NMC Approved'],
    establishedYear: 1953,
    website: 'https://manipal.edu',
    isFeatured: true,
    courses: [
      {
        degreeName: 'B.Tech / B.E.',
        level: 'Undergraduate',
        durationYears: 4,
        standardAnnualFee: 335000,
        specializations: [
          'Computer Science & Engineering (CSE)',
          'Information Technology',
          'Aeronautical Engineering',
          'Mechanical Engineering',
          'Biomedical Engineering',
        ],
      },
      {
        degreeName: 'MBBS (Bachelor of Medicine & Bachelor of Surgery)',
        level: 'Undergraduate',
        durationYears: 5.5,
        standardAnnualFee: 1450000,
        specializations: ['General Medicine & Surgery'],
      },
      {
        degreeName: 'BBA (Bachelor of Business Administration)',
        level: 'Undergraduate',
        durationYears: 3,
        standardAnnualFee: 175000,
        specializations: ['Marketing', 'Banking & Finance', 'Hospitality & Tourism'],
      },
      {
        degreeName: 'B.Pharm (Bachelor of Pharmacy)',
        level: 'Undergraduate',
        durationYears: 4,
        standardAnnualFee: 210000,
        specializations: ['Pharmaceutical Sciences', 'Pharmacology'],
      },
    ],
  },
  {
    name: 'BITS Pilani (Birla Institute of Technology and Science)',
    shortCode: 'BITS',
    location: { city: 'Pilani', state: 'Rajasthan', country: 'India' },
    type: 'Deemed University',
    accreditation: ['NAAC A', 'Institution of Eminence', 'NIRF Top 20'],
    establishedYear: 1964,
    website: 'https://bits-pilani.ac.in',
    isFeatured: true,
    courses: [
      {
        degreeName: 'B.Tech / B.E.',
        level: 'Undergraduate',
        durationYears: 4,
        standardAnnualFee: 495000,
        specializations: ['Computer Science & Engineering', 'Electrical & Electronics', 'Mechanical', 'Chemical Engineering', 'Civil'],
      },
      {
        degreeName: 'M.Tech / M.E.',
        level: 'Postgraduate',
        durationYears: 2,
        standardAnnualFee: 320000,
        specializations: ['Software Systems', 'Microelectronics', 'Biotechnology'],
      },
    ],
  },
  {
    name: 'Amity University',
    shortCode: 'AMITY',
    location: { city: 'Noida', state: 'Uttar Pradesh', country: 'India' },
    type: 'Private University',
    accreditation: ['NAAC A+', 'UGC Approved', 'AICTE Approved', 'WASC Accredited'],
    establishedYear: 2005,
    website: 'https://amity.edu',
    isFeatured: true,
    courses: [
      {
        degreeName: 'B.Tech / B.E.',
        level: 'Undergraduate',
        durationYears: 4,
        standardAnnualFee: 280000,
        specializations: ['Computer Science & Engineering', 'AI & ML', 'Data Science', 'Civil Engineering'],
      },
      {
        degreeName: 'MBA (Master of Business Administration)',
        level: 'Postgraduate',
        durationYears: 2,
        standardAnnualFee: 420000,
        specializations: ['Marketing & Sales', 'International Business', 'Finance', 'HR', 'Retail Management'],
      },
      {
        degreeName: 'BA LLB / BBA LLB / LLB',
        level: 'Undergraduate',
        durationYears: 5,
        standardAnnualFee: 210000,
        specializations: ['Corporate Law', 'Criminal Law', 'Cyber Law'],
      },
      {
        degreeName: 'B.Sc (Bachelor of Science)',
        level: 'Undergraduate',
        durationYears: 3,
        standardAnnualFee: 110000,
        specializations: ['Biotechnology', 'Microbiology', 'Forensic Science', 'Physics'],
      },
    ],
  },
  {
    name: 'SRM Institute of Science and Technology',
    shortCode: 'SRM',
    location: { city: 'Chennai', state: 'Tamil Nadu', country: 'India' },
    type: 'Deemed University',
    accreditation: ['NAAC A++', 'NIRF Top 25', 'UGC Approved'],
    establishedYear: 1985,
    website: 'https://srmist.edu.in',
    isFeatured: true,
    courses: [
      {
        degreeName: 'B.Tech / B.E.',
        level: 'Undergraduate',
        durationYears: 4,
        standardAnnualFee: 260000,
        specializations: ['Computer Science', 'Cloud Computing', 'Automobile Engineering', 'Aerospace', 'ECE', 'Mechanical'],
      },
      {
        degreeName: 'BBA (Bachelor of Business Administration)',
        level: 'Undergraduate',
        durationYears: 3,
        standardAnnualFee: 115000,
        specializations: ['General', 'Digital Marketing', 'Data Analytics'],
      },
      {
        degreeName: 'MBBS (Bachelor of Medicine & Bachelor of Surgery)',
        level: 'Undergraduate',
        durationYears: 5.5,
        standardAnnualFee: 1350000,
        specializations: ['General Medicine'],
      },
    ],
  },
  {
    name: 'Christ University',
    shortCode: 'CHRIST',
    location: { city: 'Bengaluru', state: 'Karnataka', country: 'India' },
    type: 'Deemed University',
    accreditation: ['NAAC A+', 'UGC Approved', 'QS Ranked'],
    establishedYear: 1969,
    website: 'https://christuniversity.in',
    isFeatured: true,
    courses: [
      {
        degreeName: 'BBA (Bachelor of Business Administration)',
        level: 'Undergraduate',
        durationYears: 3,
        standardAnnualFee: 240000,
        specializations: ['Finance & International Business', 'Marketing', 'Tourism & Travel Management'],
      },
      {
        degreeName: 'B.Com / B.Com (Hons)',
        level: 'Undergraduate',
        durationYears: 3,
        standardAnnualFee: 180000,
        specializations: ['Applied Finance', 'Accounting & Taxation', 'Strategic Finance'],
      },
      {
        degreeName: 'BA LLB / BBA LLB / LLB',
        level: 'Undergraduate',
        durationYears: 5,
        standardAnnualFee: 220000,
        specializations: ['Corporate Law', 'Constitutional Law'],
      },
      {
        degreeName: 'BCA (Bachelor of Computer Applications)',
        level: 'Undergraduate',
        durationYears: 3,
        standardAnnualFee: 145000,
        specializations: ['General Computer Applications', 'Data Science'],
      },
    ],
  },
  {
    name: 'Chandigarh University',
    shortCode: 'CU',
    location: { city: 'Mohali', state: 'Punjab', country: 'India' },
    type: 'Private University',
    accreditation: ['NAAC A+', 'NIRF Top 30', 'ABET Accredited', 'QS Asia Ranked'],
    establishedYear: 2012,
    website: 'https://cuchd.in',
    isFeatured: true,
    courses: [
      {
        degreeName: 'B.Tech / B.E.',
        level: 'Undergraduate',
        durationYears: 4,
        standardAnnualFee: 190000,
        specializations: ['CSE - IBM Cloud Computing', 'CSE - AI & ML', 'Aerospace Engineering', 'Mechatronics', 'Civil'],
      },
      {
        degreeName: 'MBA (Master of Business Administration)',
        level: 'Postgraduate',
        durationYears: 2,
        standardAnnualFee: 250000,
        specializations: ['Business Analytics', 'Digital Marketing', 'Fintech', 'HR'],
      },
      {
        degreeName: 'B.Pharm (Bachelor of Pharmacy)',
        level: 'Undergraduate',
        durationYears: 4,
        standardAnnualFee: 140000,
        specializations: ['General Pharmacy'],
      },
    ],
  },
  {
    name: 'Symbiosis International University (SIU)',
    shortCode: 'SIU',
    location: { city: 'Pune', state: 'Maharashtra', country: 'India' },
    type: 'Deemed University',
    accreditation: ['NAAC A++', 'NIRF Top 35', 'UGC Approved'],
    establishedYear: 2002,
    website: 'https://siu.edu.in',
    isFeatured: true,
    courses: [
      {
        degreeName: 'MBA (Master of Business Administration)',
        level: 'Postgraduate',
        durationYears: 2,
        standardAnnualFee: 650000,
        specializations: ['Marketing Management', 'Finance & Banking', 'Human Resource Management', 'International Business'],
      },
      {
        degreeName: 'BBA (Bachelor of Business Administration)',
        level: 'Undergraduate',
        durationYears: 3,
        standardAnnualFee: 320000,
        specializations: ['Global Business Management', 'Entrepreneurship', 'Marketing'],
      },
      {
        degreeName: 'BA LLB / BBA LLB / LLB',
        level: 'Undergraduate',
        durationYears: 5,
        standardAnnualFee: 380000,
        specializations: ['Business Law', 'Criminal Law', 'IPR Law'],
      },
    ],
  },
  {
    name: 'University of Oxford',
    shortCode: 'OXF',
    location: { city: 'Oxford', state: 'England', country: 'United Kingdom' },
    type: 'Overseas University',
    accreditation: ['QS World #2', 'THE World Top 3'],
    establishedYear: 1096,
    website: 'https://ox.ac.uk',
    isFeatured: true,
    courses: [
      {
        degreeName: 'M.Sc (Master of Science)',
        level: 'Postgraduate',
        durationYears: 1,
        standardAnnualFee: 3800000,
        specializations: ['Advanced Computer Science', 'Statistical Science', 'Financial Economics'],
      },
      {
        degreeName: 'MBA (Master of Business Administration)',
        level: 'Postgraduate',
        durationYears: 1,
        standardAnnualFee: 6500000,
        specializations: ['Global Business Strategy', 'Social Innovation & Finance'],
      },
    ],
  },
];

// @desc  Seed master college & course database (Auto-runs if empty or via API)
// @route POST /api/catalogue/seed-master
// @access Private
exports.seedMasterCatalogue = async (req, res) => {
  try {
    const existingCount = await MasterCollege.countDocuments();
    if (existingCount > 0 && (!req?.body?.force)) {
      const resp = { success: true, message: `Master catalogue already populated (${existingCount} colleges).`, count: existingCount };
      if (res) return res.json(resp);
      return resp;
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

// @desc  Search & browse Global Master Colleges (Supports pagination & dynamic search for 10,000+ records)
// @route GET /api/catalogue/master-colleges
// @access Private
exports.getMasterColleges = async (req, res) => {
  try {
    const { search, country, state, type, accreditation, page = 1, limit = 50 } = req.query;
    const query = { isActive: true };

    if (country && country !== 'all') {
      query['location.country'] = new RegExp(`^${country.trim()}$`, 'i');
    }
    if (state && state !== 'all') {
      query['location.state'] = new RegExp(state.trim(), 'i');
    }
    if (type && type !== 'all') {
      query.type = type;
    }
    if (accreditation && accreditation !== 'all') {
      query.accreditation = new RegExp(accreditation.trim(), 'i');
    }

    if (search && search.trim()) {
      const rawTokens = search.split(',').map(s => s.trim()).filter(Boolean);
      if (rawTokens.length === 1) {
        const escaped = rawTokens[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const rx = new RegExp(escaped, 'i');
        const matchingCourseCollegeIds = await MasterCourse.distinct('collegeId', {
          $or: [
            { degreeName: rx },
            { specializations: rx },
            { level: rx },
          ],
          isActive: true,
        });

        query.$or = [
          { name: rx },
          { shortCode: rx },
          { 'location.city': rx },
          { 'location.state': rx },
          { 'location.country': rx },
          { accreditation: rx },
          { type: rx },
          { _id: { $in: matchingCourseCollegeIds } },
        ];
      } else if (rawTokens.length > 1) {
        const tokenConditions = await Promise.all(rawTokens.map(async (tok) => {
          const escaped = tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const rx = new RegExp(escaped, 'i');
          const matchingCourseCollegeIds = await MasterCourse.distinct('collegeId', {
            $or: [
              { degreeName: rx },
              { specializations: rx },
              { level: rx },
            ],
            isActive: true,
          });
          return {
            $or: [
              { name: rx },
              { shortCode: rx },
              { 'location.city': rx },
              { 'location.state': rx },
              { 'location.country': rx },
              { accreditation: rx },
              { type: rx },
              { _id: { $in: matchingCourseCollegeIds } },
            ],
          };
        }));
        query.$and = tokenConditions;
      }
    }

    // Auto-seed if empty
    const totalCount = await MasterCollege.countDocuments();
    if (totalCount === 0) {
      await exports.seedMasterCatalogue();
    }

    const parsedPage = Math.max(1, parseInt(page) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const skip = (parsedPage - 1) * parsedLimit;

    const [colleges, total] = await Promise.all([
      MasterCollege.find(query)
        .sort({ isFeatured: -1, createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
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

    // Check which colleges are already imported in this tenant's catalogue
    const tenantCompanyId = req.user.companyId || (req.user.workStatus === 'company_owner' ? req.user._id : null);
    const tenantQuery = tenantCompanyId
      ? { $or: [{ companyId: tenantCompanyId }, { tenantId: req.user._id }] }
      : { tenantId: req.user._id };

    const importedColleges = await TenantCatalogue.find(tenantQuery).select('masterCollegeId _id').lean();
    const importedMap = {};
    importedColleges.forEach(ic => {
      if (ic.masterCollegeId) importedMap[String(ic.masterCollegeId)] = String(ic._id);
    });

    const enriched = colleges.map(col => {
      const colCourses = courseMap[String(col._id)] || [];
      const isImported = Boolean(importedMap[String(col._id)]);
      return {
        ...col,
        coursesCount: colCourses.length,
        availableDegrees: colCourses.map(c => c.degreeName),
        courses: colCourses,
        isImported,
        tenantCatalogueId: importedMap[String(col._id)] || null,
      };
    });

    res.json({
      success: true,
      colleges: enriched,
      total,
      page: parsedPage,
      pages: Math.ceil(total / parsedLimit),
      hasMore: parsedPage * parsedLimit < total,
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
              level: mc.level || 'Undergraduate',
              durationYears: mc.durationYears || 4,
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
            level: mc.level || 'Undergraduate',
            durationYears: mc.durationYears || 4,
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
      isCustomInstitution: false,
      customCollegeName: masterCollege.name,
      collegeType: masterCollege.type,
      location: masterCollege.location,
      accreditation: masterCollege.accreditation || [],
      establishedYear: masterCollege.establishedYear || null,
      affiliatedUniversity: masterCollege.affiliatedUniversity || '',
      logoUrl: masterCollege.logoUrl,
      website: masterCollege.website,
      brochureUrl: masterCollege.brochureUrl || '',
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

// @desc  PHASE 3: Add Custom Institution (Create manual college not found in master repository)
// @route POST /api/catalogue/custom
// @access Private
exports.createCustomInstitution = async (req, res) => {
  try {
    const {
      customCollegeName,
      location = {},
      collegeType = 'Private University',
      accreditation = [],
      website = '',
      establishedYear = null,
      affiliatedUniversity = '',
      brochureUrl = '',
      notes = '',
      selectedDegrees = [], // Array of degreeName strings to auto-populate from dictionary
    } = req.body;

    if (!customCollegeName || !customCollegeName.trim()) {
      return res.status(400).json({ success: false, message: 'Institution name is required' });
    }

    const tenantCompanyId = req.user.companyId || (req.user.workStatus === 'company_owner' ? req.user._id : null);

    // Auto-populate courses from selected degrees or top standard degrees (B.Tech, MBA, BCA)
    const degreesToSeed = (Array.isArray(selectedDegrees) && selectedDegrees.length > 0)
      ? selectedDegrees
      : ['B.Tech / B.E.', 'MBA (Master of Business Administration)', 'BCA (Bachelor of Computer Applications)', 'BBA (Bachelor of Business Administration)'];

    const mappedCourses = [];
    degreesToSeed.forEach(dName => {
      const foundDef = COMMON_DEGREES.find(d => d.degreeName === dName || d.shortName === dName);
      if (foundDef) {
        foundDef.specializations.forEach(spec => {
          mappedCourses.push({
            degreeName: foundDef.degreeName,
            specialization: spec,
            level: foundDef.level,
            durationYears: foundDef.durationYears,
            customFeeStructure: {
              annualTuitionFee: foundDef.standardAnnualFee,
              packageFee: foundDef.standardAnnualFee * foundDef.durationYears,
              hostelFeePerYear: 80000,
              oneTimeAdmissionFee: 20000,
              currency: 'INR',
              feeNotes: 'Default preset. Modify as per your institutional MOU.',
            },
            customTieUpDetails: {
              commissionType: 'percentage',
              commissionRate: 10,
              mouStatus: 'direct_tie_up',
              contactPersonName: '',
              contactPersonPhone: '',
              notes: '',
            },
            admissionStatus: 'admissions_open',
            quotaType: 'management_quota',
            isActive: true,
          });
        });
      } else {
        // Custom degree name provided by user
        mappedCourses.push({
          degreeName: dName,
          specialization: 'General',
          level: 'Undergraduate',
          durationYears: 3,
          customFeeStructure: {
            annualTuitionFee: 100000,
            packageFee: 300000,
            hostelFeePerYear: 80000,
            oneTimeAdmissionFee: 15000,
            currency: 'INR',
            feeNotes: '',
          },
          customTieUpDetails: {
            commissionType: 'percentage',
            commissionRate: 10,
            mouStatus: 'direct_tie_up',
            contactPersonName: '',
          },
          admissionStatus: 'admissions_open',
          quotaType: 'management_quota',
          isActive: true,
        });
      }
    });

    const newInstitution = await TenantCatalogue.create({
      tenantId: req.user._id,
      companyId: tenantCompanyId,
      masterCollegeId: null,
      isCustomInstitution: true,
      customCollegeName: customCollegeName.trim(),
      collegeType,
      location: {
        city: location.city?.trim() || '',
        state: location.state?.trim() || '',
        country: location.country?.trim() || 'India',
      },
      accreditation: Array.isArray(accreditation) ? accreditation : [],
      establishedYear: establishedYear ? Number(establishedYear) : null,
      affiliatedUniversity: affiliatedUniversity?.trim() || '',
      website: website?.trim() || '',
      brochureUrl: brochureUrl?.trim() || '',
      notes: notes?.trim() || 'Manually added custom institution',
      tags: ['Custom Institution', collegeType, location.state || location.country || 'India'],
      courses: mappedCourses,
    });

    res.status(201).json({
      success: true,
      message: `🎉 Custom Institution "${newInstitution.customCollegeName}" created with ${mappedCourses.length} standard streams ready for fee customization!`,
      catalogueItem: newInstitution,
    });
  } catch (error) {
    console.error('createCustomInstitution error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create custom institution' });
  }
};

// @desc  Get Tenant's Customized Active Catalogue
// @route GET /api/catalogue/my-catalogue
// @access Private
exports.getMyCatalogue = async (req, res) => {
  try {
    const { search, country, state, type } = req.query;

    const isOwner = req.user.workStatus === 'company_owner' || req.user.companyRole === 'owner';
    const companyId = req.user.companyId || (isOwner ? req.user._id : null);

    // Enforce multi-tenant access: Org Owner & sub-agents see org catalogue; Solo users see their own
    const query = companyId
      ? { $or: [{ companyId }, { tenantId: companyId }, { tenantId: req.user._id }] }
      : { tenantId: req.user._id };

    if (country && country !== 'all') {
      query['location.country'] = new RegExp(`^${country.trim()}$`, 'i');
    }
    if (state && state !== 'all') {
      query['location.state'] = new RegExp(state.trim(), 'i');
    }
    if (type && type !== 'all') {
      query.collegeType = type;
    }

    if (search && search.trim()) {
      const rx = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { customCollegeName: rx },
        { 'location.city': rx },
        { 'location.state': rx },
        { accreditation: rx },
        { 'courses.degreeName': rx },
        { 'courses.specialization': rx },
      ];
    }

    const items = await TenantCatalogue.find(query)
      .populate('masterCollegeId', 'name accreditation establishedYear shortCode logoUrl website')
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

// @desc  Update Header Info of a Tenant Catalogue Institution (Name, Location, Accreditation, Type, Website)
// @route PUT /api/catalogue/my-catalogue/:id/info
// @access Private
exports.updateTenantCatalogueInfo = async (req, res) => {
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
      location,
      collegeType,
      accreditation,
      website,
      establishedYear,
      affiliatedUniversity,
      brochureUrl,
      notes,
    } = req.body;

    if (customCollegeName) item.customCollegeName = customCollegeName.trim();
    if (location) item.location = { ...item.location, ...location };
    if (collegeType) item.collegeType = collegeType;
    if (Array.isArray(accreditation)) item.accreditation = accreditation;
    if (website !== undefined) item.website = website.trim();
    if (establishedYear !== undefined) item.establishedYear = establishedYear ? Number(establishedYear) : null;
    if (affiliatedUniversity !== undefined) item.affiliatedUniversity = affiliatedUniversity.trim();
    if (brochureUrl !== undefined) item.brochureUrl = brochureUrl.trim();
    if (notes !== undefined) item.notes = notes;

    await item.save();

    res.json({
      success: true,
      message: 'Institution profile updated successfully ✅',
      catalogueItem: item,
    });
  } catch (error) {
    console.error('updateTenantCatalogueInfo error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc  Add a Degree & its Specializations to a Tenant Catalogue Item
// @route POST /api/catalogue/my-catalogue/:id/degrees
// @access Private
exports.addDegreeToCatalogueItem = async (req, res) => {
  try {
    const { degreeName, level = 'Undergraduate', durationYears = 4, specializations = [], standardAnnualFee = 150000 } = req.body;
    if (!degreeName || !degreeName.trim()) {
      return res.status(400).json({ success: false, message: 'Degree name is required' });
    }

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

    const specsToAdd = (Array.isArray(specializations) && specializations.length > 0)
      ? specializations
      : ['General'];

    const newCourses = specsToAdd.map(spec => ({
      degreeName: degreeName.trim(),
      specialization: spec.trim(),
      level,
      durationYears: Number(durationYears) || 4,
      customFeeStructure: {
        annualTuitionFee: Number(standardAnnualFee) || 150000,
        packageFee: (Number(standardAnnualFee) || 150000) * (Number(durationYears) || 4),
        hostelFeePerYear: 80000,
        oneTimeAdmissionFee: 20000,
        currency: 'INR',
        feeNotes: '',
      },
      customTieUpDetails: {
        commissionType: 'percentage',
        commissionRate: 10,
        mouStatus: 'direct_tie_up',
        contactPersonName: '',
      },
      admissionStatus: 'admissions_open',
      quotaType: 'management_quota',
      isActive: true,
    }));

    item.courses.push(...newCourses);
    await item.save();

    res.status(201).json({
      success: true,
      message: `🎉 Added Degree "${degreeName}" with ${newCourses.length} specialization streams!`,
      catalogueItem: item,
    });
  } catch (error) {
    console.error('addDegreeToCatalogueItem error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc  Delete an Entire Degree and all its specializations
// @route DELETE /api/catalogue/my-catalogue/:id/degrees/:degreeName
// @access Private
exports.deleteDegreeFromCatalogueItem = async (req, res) => {
  try {
    const { id, degreeName } = req.params;

    const isOwner = req.user.workStatus === 'company_owner' || req.user.companyRole === 'owner';
    const companyId = req.user.companyId || (isOwner ? req.user._id : null);

    const query = {
      _id: id,
      ...(companyId
        ? { $or: [{ companyId }, { tenantId: companyId }, { tenantId: req.user._id }] }
        : { tenantId: req.user._id }),
    };

    const item = await TenantCatalogue.findOne(query);
    if (!item) return res.status(404).json({ success: false, message: 'Catalogue item not found' });

    const decodedDegree = decodeURIComponent(degreeName);
    const prevCount = item.courses.length;
    item.courses = item.courses.filter(c => c.degreeName !== decodedDegree);
    const removedCount = prevCount - item.courses.length;

    await item.save();

    res.json({
      success: true,
      message: `Removed Degree "${decodedDegree}" and its ${removedCount} streams ✅`,
      catalogueItem: item,
    });
  } catch (error) {
    console.error('deleteDegreeFromCatalogueItem error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc  Update / Rename a Degree Program across its streams in a Tenant Catalogue Item
// @route PUT /api/catalogue/my-catalogue/:id/degrees/:degreeName
// @access Private
exports.updateDegreeInCatalogueItem = async (req, res) => {
  try {
    const { id, degreeName } = req.params;
    const { newDegreeName, level, durationYears } = req.body;

    const isOwner = req.user.workStatus === 'company_owner' || req.user.companyRole === 'owner';
    const companyId = req.user.companyId || (isOwner ? req.user._id : null);

    const query = {
      _id: id,
      ...(companyId
        ? { $or: [{ companyId }, { tenantId: companyId }, { tenantId: req.user._id }] }
        : { tenantId: req.user._id }),
    };

    const item = await TenantCatalogue.findOne(query);
    if (!item) return res.status(404).json({ success: false, message: 'Catalogue item not found' });

    const decodedDegree = decodeURIComponent(degreeName);
    let updatedCount = 0;

    item.courses.forEach(course => {
      if (course.degreeName === decodedDegree) {
        if (newDegreeName && newDegreeName.trim()) {
          course.degreeName = newDegreeName.trim();
        }
        if (level) course.level = level;
        if (durationYears !== undefined && durationYears !== null) {
          course.durationYears = Number(durationYears) || course.durationYears;
        }
        updatedCount++;
      }
    });

    if (updatedCount === 0) {
      return res.status(404).json({ success: false, message: `Degree "${decodedDegree}" not found in catalogue item` });
    }

    await item.save();

    res.json({
      success: true,
      message: `Degree updated successfully across ${updatedCount} streams ✅`,
      catalogueItem: item,
    });
  } catch (error) {
    console.error('updateDegreeInCatalogueItem error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc  Add a Specialization Stream under a Degree
// @route POST /api/catalogue/my-catalogue/:id/specializations
// @access Private
exports.addSpecializationToCatalogueItem = async (req, res) => {
  try {
    const {
      degreeName,
      specialization,
      annualTuitionFee = 150000,
      packageFee = 600000,
      hostelFeePerYear = 80000,
      oneTimeAdmissionFee = 20000,
      currency = 'INR',
      commissionRate = 10,
      commissionType = 'percentage',
      mouStatus = 'direct_tie_up',
      contactPersonName = '',
      contactPersonPhone = '',
      admissionStatus = 'admissions_open',
      quotaType = 'management_quota',
      level = 'Undergraduate',
      durationYears = 4,
    } = req.body;

    if (!degreeName || !specialization) {
      return res.status(400).json({ success: false, message: 'Degree name and specialization are required' });
    }

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

    item.courses.push({
      degreeName: degreeName.trim(),
      specialization: specialization.trim(),
      level,
      durationYears: Number(durationYears) || 4,
      customFeeStructure: {
        annualTuitionFee: Number(annualTuitionFee) || 0,
        packageFee: Number(packageFee) || 0,
        hostelFeePerYear: Number(hostelFeePerYear) || 0,
        oneTimeAdmissionFee: Number(oneTimeAdmissionFee) || 0,
        currency,
        feeNotes: '',
      },
      customTieUpDetails: {
        commissionType,
        commissionRate: Number(commissionRate) || 10,
        mouStatus,
        contactPersonName,
        contactPersonPhone,
      },
      admissionStatus,
      quotaType,
      isActive: true,
    });

    await item.save();

    res.status(201).json({
      success: true,
      message: `🎉 Added Specialization "${specialization}" under ${degreeName}!`,
      catalogueItem: item,
    });
  } catch (error) {
    console.error('addSpecializationToCatalogueItem error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc  Update a Specific Specialization Course (Fee Structure & Tie-Up Details)
// @route PUT /api/catalogue/my-catalogue/:id/courses/:courseId
// @access Private
exports.updateCourseInCatalogueItem = async (req, res) => {
  try {
    const { id, courseId } = req.params;

    const isOwner = req.user.workStatus === 'company_owner' || req.user.companyRole === 'owner';
    const companyId = req.user.companyId || (isOwner ? req.user._id : null);

    const query = {
      _id: id,
      ...(companyId
        ? { $or: [{ companyId }, { tenantId: companyId }, { tenantId: req.user._id }] }
        : { tenantId: req.user._id }),
    };

    const item = await TenantCatalogue.findOne(query);
    if (!item) return res.status(404).json({ success: false, message: 'Catalogue item not found' });

    const course = item.courses.id(courseId);
    if (!course) return res.status(404).json({ success: false, message: 'Course stream not found' });

    const {
      degreeName,
      specialization,
      customFeeStructure,
      customTieUpDetails,
      admissionStatus,
      quotaType,
      isActive,
      level,
      durationYears,
    } = req.body;

    if (degreeName) course.degreeName = degreeName.trim();
    if (specialization) course.specialization = specialization.trim();
    if (level) course.level = level;
    if (durationYears !== undefined) course.durationYears = Number(durationYears);
    if (admissionStatus) course.admissionStatus = admissionStatus;
    if (quotaType) course.quotaType = quotaType;
    if (isActive !== undefined) course.isActive = Boolean(isActive);

    if (customFeeStructure) {
      course.customFeeStructure = {
        ...course.customFeeStructure,
        ...customFeeStructure,
      };
    }

    if (customTieUpDetails) {
      course.customTieUpDetails = {
        ...course.customTieUpDetails,
        ...customTieUpDetails,
      };
    }

    await item.save();

    res.json({
      success: true,
      message: `Fee structure & tie-up details for "${course.specialization}" updated successfully ✅`,
      catalogueItem: item,
    });
  } catch (error) {
    console.error('updateCourseInCatalogueItem error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc  Delete a Specific Specialization Course Stream
// @route DELETE /api/catalogue/my-catalogue/:id/courses/:courseId
// @access Private
exports.deleteCourseFromCatalogueItem = async (req, res) => {
  try {
    const { id, courseId } = req.params;

    const isOwner = req.user.workStatus === 'company_owner' || req.user.companyRole === 'owner';
    const companyId = req.user.companyId || (isOwner ? req.user._id : null);

    const query = {
      _id: id,
      ...(companyId
        ? { $or: [{ companyId }, { tenantId: companyId }, { tenantId: req.user._id }] }
        : { tenantId: req.user._id }),
    };

    const item = await TenantCatalogue.findOne(query);
    if (!item) return res.status(404).json({ success: false, message: 'Catalogue item not found' });

    const courseIndex = item.courses.findIndex(c => String(c._id) === String(courseId));
    if (courseIndex === -1) return res.status(404).json({ success: false, message: 'Course stream not found' });

    const removedCourseName = item.courses[courseIndex].specialization;
    item.courses.splice(courseIndex, 1);
    await item.save();

    res.json({
      success: true,
      message: `Stream "${removedCourseName}" removed successfully ✅`,
      catalogueItem: item,
    });
  } catch (error) {
    console.error('deleteCourseFromCatalogueItem error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc  Full Update on a Tenant Catalogue item (Backward compatibility)
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
      accreditation,
      website,
      establishedYear,
      affiliatedUniversity,
    } = req.body;

    if (customCollegeName) item.customCollegeName = customCollegeName.trim();
    if (notes !== undefined) item.notes = notes;
    if (tags !== undefined) item.tags = tags;
    if (priorityRank !== undefined) item.priorityRank = Number(priorityRank);
    if (location) item.location = { ...item.location, ...location };
    if (Array.isArray(accreditation)) item.accreditation = accreditation;
    if (website !== undefined) item.website = website;
    if (establishedYear !== undefined) item.establishedYear = establishedYear ? Number(establishedYear) : null;
    if (affiliatedUniversity !== undefined) item.affiliatedUniversity = affiliatedUniversity;

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

// @desc  Remove an Institution from Tenant's Active Catalogue
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

    res.json({ success: true, message: `"${item.customCollegeName}" removed from your active catalogue ✅` });
  } catch (error) {
    console.error('deleteTenantCatalogueItem error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};
