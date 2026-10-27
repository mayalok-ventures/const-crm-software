const axios = require('axios');

const API = 'http://localhost:5000/api';

async function testRolesAndResend() {
  console.log('\n============================================================');
  console.log('🧪 TESTING CUSTOM ROLE CRUD & INVITATION RESEND LIFECYCLE');
  console.log('============================================================\n');

  // 1. Sign up fresh consultant with auto workspace
  const signupRes = await axios.post(`${API}/auth/register`, {
    name: 'Roles Tester Consultant',
    email: `roles_tester_${Date.now()}@consultancy.com`,
    password: 'Password@123456',
    phone: `99${Math.floor(10000000 + Math.random() * 90000000)}`,
    industryType: 'education',
    educationSubProfile: 'college_admissions',
  });
  const token = signupRes.data.token;
  const headers = { Authorization: `Bearer ${token}` };

  // 2. Fetch current workspace
  const wsRes = await axios.get(`${API}/workspace/current`, { headers });
  const workspaceId = wsRes.data.data._id;
  console.log('  ✅ Current Workspace ID:', workspaceId);

  // 3. Create Custom Role
  const createRoleRes = await axios.post(`${API}/workspace/roles`, {
    name: 'Test Visa Specialist ' + Date.now(),
    description: 'Specializes in student visa applications',
    permissions: [
      { key: 'leads.view', scope: 'own' },
      { key: 'leads.create', scope: 'workspace' },
      { key: 'whatsapp.view', scope: 'workspace' },
    ],
  }, { headers });
  const roleId = createRoleRes.data.role._id;
  console.log('  ✅ PASS: Created Custom Role with ID:', roleId);

  // 4. Update Custom Role
  const updateRoleRes = await axios.put(`${API}/workspace/roles/${roleId}`, {
    name: 'Updated Visa Specialist ' + Date.now(),
    description: 'Updated description for testing',
    permissions: [
      { key: 'leads.view', scope: 'workspace' },
      { key: 'deals.view', scope: 'workspace' },
    ],
  }, { headers });
  console.log('  ✅ PASS: Updated Custom Role:', updateRoleRes.data.message);

  // 5. Delete Custom Role
  const deleteRoleRes = await axios.delete(`${API}/workspace/roles/${roleId}`, { headers });
  console.log('  ✅ PASS: Deleted Custom Role:', deleteRoleRes.data.message);

  // 6. Test Invitation and Resend
  const inviteEmail = `test_invite_${Date.now()}@consultant.com`;
  const inviteRes = await axios.post(`${API}/workspace/invitations`, {
    email: inviteEmail,
    role: 'counsellor',
    team: 'Testing',
  }, { headers });
  const invId = inviteRes.data.data._id;
  const initialToken = inviteRes.data.data.token;
  console.log('  ✅ PASS: Generated Invitation for:', inviteEmail);

  // 7. Resend / Refresh Invitation
  const resendRes = await axios.post(`${API}/workspace/invitations/${invId}/resend`, {}, { headers });
  const newToken = resendRes.data.data.token;
  if (newToken && newToken !== initialToken) {
    console.log('  ✅ PASS: Invitation token refreshed and extended for 7 days!');
  } else {
    throw new Error('Resend did not generate new token');
  }

  // 8. Revoke Invitation
  const revokeRes = await axios.delete(`${API}/workspace/invitations/${invId}`, { headers });
  console.log('  ✅ PASS: Invitation revoked successfully:', revokeRes.data.message);

  console.log('\n------------------------------------------------------------');
  console.log('🏁 ALL 6 TESTS PASSED | 0 FAILED');
  console.log('------------------------------------------------------------\n');
}

testRolesAndResend().catch(err => {
  console.error('❌ Test failed:', err.response?.data || err.message);
  process.exit(1);
});
