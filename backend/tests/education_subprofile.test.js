/**
 * EDUCATION VERTICAL & SUB-PROFILE AUTOMATED TEST SUITE (Phase 1)
 * Tests dynamic pipeline stage & form schema configuration across all 6 Education sub-profiles:
 * 1. Higher Education (Colleges & Universities)
 * 2. EdTech Companies (Online Courses)
 * 3. Study Abroad & Overseas Education
 * 4. Test Prep & Coaching Institutes
 * 5. K-12 Schools
 * 6. Admission Consultants & Counsellors (Domestic)
 */

const axios = require('axios');
const API_URL = 'http://localhost:5000/api';

async function runEducationSubProfileTests() {
  console.log('\n🎓 ========================================================');
  console.log('   EDUCATION SUB-PROFILE DYNAMIC ONBOARDING TEST SUITE');
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

  const subProfiles = [
    {
      key: 'higher_education',
      name: 'Higher Ed Institute',
      expectedStage: 'Entrance / Merit Assessment',
      expectedField: 'courseApplied',
    },
    {
      key: 'edtech',
      name: 'NextGen EdTech',
      expectedStage: 'Trial / Masterclass Registered',
      expectedField: 'programName',
    },
    {
      key: 'study_abroad',
      name: 'Global Horizons Overseas',
      expectedStage: 'Visa Filing & Mock Interview',
      expectedField: 'targetCountries',
    },
    {
      key: 'test_prep',
      name: 'Apex IIT-JEE & Medical Academy',
      expectedStage: 'Diagnostic / Scholarship Test',
      expectedField: 'targetExam',
    },
    {
      key: 'k12',
      name: 'Oakridge World School',
      expectedStage: 'School Tour & Interaction Scheduled',
      expectedField: 'seekingGrade',
    },
    {
      key: 'admission_consultants',
      name: 'Direct Admission Counsellors',
      expectedStage: 'Management / Merit Quota Filing',
      expectedField: 'targetDomain',
    },
  ];

  try {
    for (let i = 0; i < subProfiles.length; i++) {
      const sp = subProfiles[i];
      console.log(`▶️  Testing Sub-Profile ${i + 1}/6: "${sp.key}" (${sp.name})...`);

      const email = `edu_${sp.key}_${timestamp}@crmtest.com`;
      const phone = `9200${String(timestamp).slice(-5)}${i + 1}`;

      const res = await axios.post(`${API_URL}/auth/register`, {
        name: `${sp.name} Lead_${timestamp}`,
        email,
        phone,
        password: 'Password@123',
        workStatus: 'company_owner',
        companyName: `${sp.name} Group`,
        industryType: 'Education',
        educationSubProfile: sp.key,
      });

      const token = res.data.token;
      const user = res.data;

      assert(user.educationSubProfile === sp.key, `User saved with educationSubProfile = "${sp.key}"`);
      assert(user.industryType === 'Education', `User saved with industryType = "Education"`);

      // Verify dynamic pipeline stages
      const stages = user.customPipelineStages || user.pipelineStages || [];
      assert(
        stages.includes(sp.expectedStage),
        `Custom pipeline stages include tailored stage: "${sp.expectedStage}" (Total stages: ${stages.length})`
      );

      // Verify dynamic lead form schema
      const schema = user.leadFormSchema || [];
      const hasCustomField = schema.some(f => f.fieldId === sp.expectedField);
      assert(
        hasCustomField,
        `Lead form schema dynamically tailored with custom field: "${sp.expectedField}" (Total fields: ${schema.length})`
      );

      // Verify GET /api/auth/me returns accurate subprofile & schema
      const meRes = await axios.get(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      assert(
        meRes.data.educationSubProfile === sp.key,
        `GET /api/auth/me retains and serves educationSubProfile = "${sp.key}"`
      );
    }

    console.log('\n========================================================');
    console.log(`🏁 EDUCATION SUB-PROFILE SUITE: ${passed} PASSED | ${failed} FAILED`);
    console.log('========================================================\n');

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('Fatal test error in education subprofile suite:', err.response?.data || err.message);
    process.exit(1);
  }
}

runEducationSubProfileTests();
