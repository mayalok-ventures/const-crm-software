/**
 * HYBRID CATALOGUE & CUSTOM INSTITUTION ARCHITECTURE TEST SUITE
 * Tests:
 * 1. Global Master College & Course Repository Seeding, Pagination & Search
 * 2. 1-Click Import & Auto-Mapping of Master Courses into Tenant Catalogue
 * 3. Phase 3: Custom Institution Creator (Manual partner colleges with pre-populated degrees)
 * 4. Phase 2: Drill-Down Hierarchy (Add Degree, Add Stream, Edit Fee/Tie-Up, Delete Stream, Delete Degree, Edit Info)
 * 5. Multi-Tenant Catalogue Isolation
 * 6. Clean Deletion & Lifecycle Management
 */

const axios = require('axios');
const API_URL = 'http://localhost:5000/api';

async function runHybridCatalogueTests() {
  console.log('\n🏛️ ========================================================');
  console.log('   HYBRID CATALOGUE & CUSTOM INSTITUTION TEST SUITE');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, message) => {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  };

  const timestamp = Date.now();

  try {
    // ─────────────────────────────────────────────────────────────
    // STEP 1: AUTHENTICATE ADMISSION CONSULTANT TENANT
    // ─────────────────────────────────────────────────────────────
    console.log('▶️  Step 1: Registering Admission Consultant Tenant...');

    const resUser = await axios.post(`${API_URL}/auth/register`, {
      name: `Apex Counsellors_${timestamp}`,
      email: `counsellor_${timestamp}@edcrm.com`,
      phone: `9300${String(timestamp).slice(-6)}1`,
      password: 'Password@123',
      workStatus: 'company_owner',
      companyName: `Apex Overseas & Domestic Admissions_${timestamp}`,
      industryType: 'Education',
      educationSubProfile: 'admission_consultants',
    });

    const token = resUser.data.token;
    const user = resUser.data;

    assert(token && user._id, 'Admission consultant authenticated successfully');
    assert(user.educationSubProfile === 'admission_consultants', 'User has sub-profile "admission_consultants"');

    // ─────────────────────────────────────────────────────────────
    // STEP 2: MASTER REPOSITORY SEED, PAGINATION & SEARCH
    // ─────────────────────────────────────────────────────────────
    console.log('\n▶️  Step 2: Testing Master College Repository (10,000+ Scalable Search)...');

    // Seed master repository
    const seedRes = await axios.post(
      `${API_URL}/catalogue/seed-master`,
      { force: true },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    assert(seedRes.data.success, `Master repository seeded: ${seedRes.data.message}`);

    // Query Master Colleges with pagination
    const masterRes = await axios.get(`${API_URL}/catalogue/master-colleges?page=1&limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert(masterRes.data.success, 'Master Colleges API returned success');
    assert(masterRes.data.colleges.length <= 5, 'Pagination limit respected');
    assert(masterRes.data.total >= 6, `Total master colleges in repository: ${masterRes.data.total}`);

    // Search specifically for VIT
    const vitSearchRes = await axios.get(`${API_URL}/catalogue/master-colleges?search=VIT`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const vitCollege = vitSearchRes.data.colleges[0];
    assert(vitCollege && vitCollege.name.includes('VIT'), `Search matched Master College: "${vitCollege?.name}"`);
    assert(vitCollege.coursesCount > 0, `VIT has ${vitCollege.coursesCount} degree programs in Master DB`);

    // ─────────────────────────────────────────────────────────────
    // STEP 3: 1-CLICK IMPORT & AUTO-MAPPING
    // ─────────────────────────────────────────────────────────────
    console.log('\n▶️  Step 3: Testing 1-Click Import & Auto-Mapping...');

    const importRes = await axios.post(
      `${API_URL}/catalogue/import/${vitCollege._id}`,
      {
        defaultCommissionRate: 15,
        defaultMouStatus: 'direct_tie_up',
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    assert(importRes.status === 201, '1-Click Import returned HTTP 201 Created');
    const importedItem = importRes.data.catalogueItem;
    assert(importedItem.customCollegeName === vitCollege.name, `Imported college name matches: "${importedItem.customCollegeName}"`);
    assert(importedItem.courses.length >= 6, `Auto-mapped ${importedItem.courses.length} course specializations into tenant draft`);

    // Duplicate import protection test
    const duplicateRes = await axios.post(
      `${API_URL}/catalogue/import/${vitCollege._id}`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    assert(duplicateRes.data.alreadyImported, 'Duplicate import gracefully detected and returned existing draft');

    // ─────────────────────────────────────────────────────────────
    // STEP 4: PHASE 3 - "ADD CUSTOM INSTITUTION" BUILDER
    // ─────────────────────────────────────────────────────────────
    console.log('\n▶️  Step 4: Testing "Add Custom Institution" Builder...');

    const customRes = await axios.post(
      `${API_URL}/catalogue/custom`,
      {
        customCollegeName: `St. Xavier's Institute of Tech_${timestamp}`,
        location: { city: 'Mumbai', state: 'Maharashtra', country: 'India' },
        collegeType: 'Autonomous College',
        accreditation: ['NAAC A++', 'AICTE Approved', 'NBA Accredited'],
        establishedYear: 1998,
        website: 'https://stxaviers.edu.in',
        notes: 'Direct institutional partner with exclusive quotas',
        selectedDegrees: [
          'B.Tech / B.E.',
          'MBA (Master of Business Administration)',
          'BCA (Bachelor of Computer Applications)',
        ],
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    assert(customRes.status === 201, 'Custom Institution created (HTTP 201)');
    const customCollege = customRes.data.catalogueItem;
    assert(customCollege.isCustomInstitution === true, 'Saved with isCustomInstitution: true');
    assert(customCollege.courses.length >= 10, `Pre-populated ${customCollege.courses.length} streams ready for fee configuration`);
    assert(customCollege.accreditation.includes('NAAC A++'), 'Accreditation tags saved cleanly on custom institution');

    // ─────────────────────────────────────────────────────────────
    // STEP 5: PHASE 2 - DRILL-DOWN DEGREE & SPECIALIZATION MANAGEMENT
    // ─────────────────────────────────────────────────────────────
    console.log('\n▶️  Step 5: Testing Drill-Down Degree & Specialization Management...');

    // 5.1 Add a New Degree Program (e.g. MBBS)
    const addDegreeRes = await axios.post(
      `${API_URL}/catalogue/my-catalogue/${customCollege._id}/degrees`,
      {
        degreeName: 'MBBS (Bachelor of Medicine)',
        level: 'Undergraduate',
        durationYears: 5.5,
        standardAnnualFee: 1250000,
        specializations: ['General Medicine & Clinical Surgery', 'Community Health Care'],
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    assert(addDegreeRes.status === 201, 'Added MBBS degree program to custom institution');
    const updatedCustom = addDegreeRes.data.catalogueItem;
    const mbbsCourses = updatedCustom.courses.filter(c => c.degreeName.includes('MBBS'));
    assert(mbbsCourses.length === 2, 'Found 2 specializations generated under MBBS');

    // 5.2 Add a Specialization Stream under B.Tech
    const addSpecRes = await axios.post(
      `${API_URL}/catalogue/my-catalogue/${customCollege._id}/specializations`,
      {
        degreeName: 'B.Tech / B.E.',
        specialization: 'Quantum Computing & Nanotechnology',
        annualTuitionFee: 320000,
        packageFee: 1280000,
        hostelFeePerYear: 95000,
        oneTimeAdmissionFee: 30000,
        currency: 'INR',
        commissionRate: 18,
        commissionType: 'percentage',
        mouStatus: 'direct_tie_up',
        contactPersonName: 'Prof. Ananya Sen',
        admissionStatus: 'seats_fast_filling',
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    assert(addSpecRes.status === 201, 'Added custom specialization stream "Quantum Computing"');
    const quantumStream = addSpecRes.data.catalogueItem.courses.find(c => c.specialization.includes('Quantum Computing'));
    assert(Boolean(quantumStream), 'Quantum Computing stream retrieved successfully');
    assert(quantumStream.customFeeStructure.annualTuitionFee === 320000, 'Custom annual tuition fee verified');
    assert(quantumStream.customTieUpDetails.commissionRate === 18, 'Commission rate 18% verified');

    // 5.3 Edit Specialization Fee Structure
    const updateCourseRes = await axios.put(
      `${API_URL}/catalogue/my-catalogue/${customCollege._id}/courses/${quantumStream._id}`,
      {
        customFeeStructure: {
          annualTuitionFee: 350000,
          packageFee: 1400000,
          hostelFeePerYear: 105000,
          feeNotes: 'Merit scholarship applicable on rank < 5000',
        },
        customTieUpDetails: {
          commissionRate: 20,
          contactPersonPhone: '9876543210',
        },
        admissionStatus: 'merit_closed_mgmt_open',
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    assert(updateCourseRes.data.success, 'Updated Quantum Computing fee structure & tie-up details');
    const updatedQuantum = updateCourseRes.data.catalogueItem.courses.find(c => c.specialization.includes('Quantum Computing'));
    assert(updatedQuantum.customFeeStructure.annualTuitionFee === 350000, 'Updated annual fee is ₹3,50,000');
    assert(updatedQuantum.customTieUpDetails.commissionRate === 20, 'Updated commission rate is 20%');
    assert(updatedQuantum.admissionStatus === 'merit_closed_mgmt_open', 'Status is merit_closed_mgmt_open');

    // 5.4 Update Institution Header Info
    const updateInfoRes = await axios.put(
      `${API_URL}/catalogue/my-catalogue/${customCollege._id}/info`,
      {
        customCollegeName: `St. Xavier's International University_${timestamp}`,
        collegeType: 'Deemed University',
        website: 'https://stxaviers-intl.edu',
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    assert(updateInfoRes.data.success, 'Updated institution header info');
    assert(updateInfoRes.data.catalogueItem.collegeType === 'Deemed University', 'College type changed to Deemed University');

    // 5.5 Delete Single Specialization Stream
    const deleteStreamRes = await axios.delete(
      `${API_URL}/catalogue/my-catalogue/${customCollege._id}/courses/${quantumStream._id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    assert(deleteStreamRes.data.success, 'Deleted single specialization stream');
    const streamCheck = deleteStreamRes.data.catalogueItem.courses.find(c => c.specialization.includes('Quantum Computing'));
    assert(!streamCheck, 'Quantum Computing stream confirmed removed');

    // 5.6 Delete Entire Degree Program (MBBS)
    const deleteDegreeRes = await axios.delete(
      `${API_URL}/catalogue/my-catalogue/${customCollege._id}/degrees/${encodeURIComponent('MBBS (Bachelor of Medicine)')}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    assert(deleteDegreeRes.data.success, 'Deleted entire MBBS degree program');
    const mbbsCheck = deleteDegreeRes.data.catalogueItem.courses.filter(c => c.degreeName.includes('MBBS'));
    assert(mbbsCheck.length === 0, 'Zero MBBS courses remain in institution');

    // ─────────────────────────────────────────────────────────────
    // STEP 6: MULTI-TENANT ISOLATION CHECK
    // ─────────────────────────────────────────────────────────────
    console.log('\n▶️  Step 6: Testing Multi-Tenant Isolation for Catalogues...');

    // Register User 2 (Bob)
    const resBob = await axios.post(`${API_URL}/auth/register`, {
      name: `Bob Admissions_${timestamp}`,
      email: `bob_edu_${timestamp}@edcrm.com`,
      phone: `9300${String(timestamp).slice(-6)}2`,
      password: 'Password@123',
      workStatus: 'independent_agent',
      industryType: 'Education',
      educationSubProfile: 'study_abroad',
    });
    const tokenBob = resBob.data.token;

    // Bob tries to fetch my-catalogue (should NOT see Apex's custom college)
    const bobCatRes = await axios.get(`${API_URL}/catalogue/my-catalogue`, {
      headers: { Authorization: `Bearer ${tokenBob}` },
    });
    const bobHasApexCustom = bobCatRes.data.catalogue.some(c => c._id === customCollege._id);
    assert(!bobHasApexCustom, 'Tenant B cannot see Tenant A custom institution (Zero data leak)');

    // Bob tries to mutate Tenant A's custom institution
    try {
      await axios.put(
        `${API_URL}/catalogue/my-catalogue/${customCollege._id}/info`,
        { customCollegeName: 'Hacked College Name' },
        { headers: { Authorization: `Bearer ${tokenBob}` } }
      );
      assert(false, 'Tenant B unauthorized mutation should have failed');
    } catch (unauthErr) {
      assert(unauthErr.response?.status === 404 || unauthErr.response?.status === 403, 'Cross-tenant mutation strictly blocked (HTTP 404/403)');
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 7: CLEAN REMOVAL
    // ─────────────────────────────────────────────────────────────
    console.log('\n▶️  Step 7: Testing Catalogue Deletion...');

    const deleteRes = await axios.delete(
      `${API_URL}/catalogue/my-catalogue/${importedItem._id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    assert(deleteRes.data.success, 'Successfully deleted imported college from tenant catalogue');

    console.log('\n========================================================');
    console.log(`🏁 HYBRID CATALOGUE SUITE: ${passed} PASSED | ${failed} FAILED`);
    console.log('========================================================\n');

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('Fatal test error in hybrid catalogue suite:', err.response?.data || err.message);
    process.exit(1);
  }
}

runHybridCatalogueTests();
