/**
 * HYBRID CATALOGUE ARCHITECTURE AUTOMATED TEST SUITE (Phase 2)
 * Tests:
 * 1. Global Master College & Course Repository Seeding & Search
 * 2. 1-Click Import & Auto-Mapping of Master Courses into Tenant Catalogue
 * 3. Tenant Custom Fee Structure, Package Pricing, and Commission Tie-up Customization
 * 4. Multi-Tenant Catalogue Isolation (Tenant A cannot mutate Tenant B's fees)
 * 5. Clean Deletion & Lifecycle Management
 */

const axios = require('axios');
const API_URL = 'http://localhost:5000/api';

async function runHybridCatalogueTests() {
  console.log('\n🏛️ ========================================================');
  console.log('   HYBRID CATALOGUE ARCHITECTURE (PHASE 2) TEST SUITE');
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
    // STEP 1: AUTHENTICATE ADMISSION CONSULTANT USER
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
    // STEP 2: MASTER REPOSITORY SEED & SEARCH
    // ─────────────────────────────────────────────────────────────
    console.log('\n▶️  Step 2: Testing Master College Repository...');

    // Seed master repository
    const seedRes = await axios.post(
      `${API_URL}/catalogue/seed-master`,
      { force: true },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    assert(seedRes.data.success, `Master repository seeded: ${seedRes.data.message}`);

    // Query Master Colleges
    const masterRes = await axios.get(`${API_URL}/catalogue/master-colleges`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const colleges = masterRes.data.colleges;
    assert(colleges.length >= 4, `Master repository contains ${colleges.length} verified colleges`);

    // Search specifically for VIT
    const vitSearchRes = await axios.get(`${API_URL}/catalogue/master-colleges?search=VIT`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const vitCollege = vitSearchRes.data.colleges[0];
    assert(vitCollege && vitCollege.name.includes('VIT'), `Search bar matched Master College: "${vitCollege?.name}"`);
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

    // Verify course specialization details
    const cseAiCourse = importedItem.courses.find(c => c.specialization.includes('Artificial Intelligence'));
    assert(Boolean(cseAiCourse), `Found auto-mapped specialization: "${cseAiCourse?.degreeName} - ${cseAiCourse?.specialization}"`);
    assert(cseAiCourse.customFeeStructure.annualTuitionFee > 0, `Preset annual tuition fee: ₹${cseAiCourse?.customFeeStructure?.annualTuitionFee}`);
    assert(cseAiCourse.customTieUpDetails.commissionRate === 15, `Preset tie-up commission rate: ${cseAiCourse?.customTieUpDetails?.commissionRate}%`);

    // Duplicate import protection test
    const duplicateRes = await axios.post(
      `${API_URL}/catalogue/import/${vitCollege._id}`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    assert(duplicateRes.data.alreadyImported, 'Duplicate import gracefully detected and returned existing draft');

    // ─────────────────────────────────────────────────────────────
    // STEP 4: TENANT CATALOGUE FETCH & CUSTOMIZATION
    // ─────────────────────────────────────────────────────────────
    console.log('\n▶️  Step 4: Testing Tenant Catalogue Custom Fee Updates...');

    const myCatRes = await axios.get(`${API_URL}/catalogue/my-catalogue`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert(myCatRes.data.count >= 1, `Tenant catalogue list contains ${myCatRes.data.count} items`);

    // Modify CSE AI Course Fees & Commission Tie-up
    const updatedCourses = [...importedItem.courses];
    const targetIdx = updatedCourses.findIndex(c => c.specialization.includes('Artificial Intelligence'));
    updatedCourses[targetIdx] = {
      ...updatedCourses[targetIdx],
      customFeeStructure: {
        annualTuitionFee: 275000,
        packageFee: 1100000,
        hostelFeePerYear: 120000,
        oneTimeAdmissionFee: 35000,
        currency: 'INR',
        feeNotes: 'Special counsellor package deal including AC hostel and books',
      },
      customTieUpDetails: {
        commissionType: 'percentage',
        commissionRate: 18.5,
        mouStatus: 'direct_tie_up',
        contactPersonName: 'Director Admissions (Dean Office)',
        contactPersonPhone: '9845012345',
      },
      admissionStatus: 'seats_fast_filling',
      quotaType: 'management_quota',
    };

    const updateRes = await axios.put(
      `${API_URL}/catalogue/my-catalogue/${importedItem._id}`,
      { courses: updatedCourses },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    assert(updateRes.data.success, 'Updated custom fee structure and commercial tie-up details');
    const savedCourse = updateRes.data.catalogueItem.courses[targetIdx];
    assert(savedCourse.customFeeStructure.packageFee === 1100000, `Package fee saved as ₹${savedCourse.customFeeStructure.packageFee}`);
    assert(savedCourse.customTieUpDetails.commissionRate === 18.5, `Commercial commission saved as ${savedCourse.customTieUpDetails.commissionRate}%`);
    assert(savedCourse.admissionStatus === 'seats_fast_filling', `Live admission status saved as "${savedCourse.admissionStatus}"`);

    // ─────────────────────────────────────────────────────────────
    // STEP 5: MULTI-TENANT ISOLATION CHECK
    // ─────────────────────────────────────────────────────────────
    console.log('\n▶️  Step 5: Testing Multi-Tenant Isolation for Catalogues...');

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

    // Bob tries to fetch my-catalogue (should be empty for Bob)
    const bobCatRes = await axios.get(`${API_URL}/catalogue/my-catalogue`, {
      headers: { Authorization: `Bearer ${tokenBob}` },
    });
    assert(bobCatRes.data.count === 0, `Tenant B has 0 items in their catalogue (Zero leak from Tenant A)`);

    // Bob tries to mutate Tenant A's catalogue item
    try {
      await axios.put(
        `${API_URL}/catalogue/my-catalogue/${importedItem._id}`,
        { customCollegeName: 'Hacked College Name' },
        { headers: { Authorization: `Bearer ${tokenBob}` } }
      );
      assert(false, 'Tenant B unauthorized mutation should have failed');
    } catch (unauthErr) {
      assert(unauthErr.response?.status === 404 || unauthErr.response?.status === 403, 'Cross-tenant catalogue mutation strictly blocked (HTTP 404/403)');
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 6: CLEAN REMOVAL
    // ─────────────────────────────────────────────────────────────
    console.log('\n▶️  Step 6: Testing Catalogue Deletion...');

    const deleteRes = await axios.delete(
      `${API_URL}/catalogue/my-catalogue/${importedItem._id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    assert(deleteRes.data.success, 'Successfully deleted college from tenant catalogue');

    const postDeleteRes = await axios.get(`${API_URL}/catalogue/my-catalogue`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert(postDeleteRes.data.count === 0, 'Tenant catalogue is now empty');

    // Global master college remains intact
    const masterCheckRes = await axios.get(`${API_URL}/catalogue/master-colleges/${vitCollege._id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert(masterCheckRes.data.college.name === vitCollege.name, 'Global MasterCollege remains completely intact after tenant deletion');

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
