const mongoose = require('mongoose');
const Lead = require('../src/models/Lead');
const User = require('../src/models/User');
const Payment = require('../src/models/Payment');
const { getOverviewMetrics, getAdminLeads } = require('../src/controllers/adminController');

describe('Admin Control Center Rebuild Test Suite', () => {
  let orgAdminUser;
  let testCompanyId;

  beforeAll(async () => {
    testCompanyId = new mongoose.Types.ObjectId();
    orgAdminUser = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Admin Test',
      email: 'admin.test@coresetu.com',
      role: 'admin',
      companyId: testCompanyId,
      workStatus: 'company_owner',
      companyRole: 'owner',
    };
  });

  describe('Multi-Tenant Metrics Aggregation Engine', () => {
    it('should return 0 conversion rate safely without zero-division error on zero leads', async () => {
      const req = { user: orgAdminUser };
      let responseData = null;
      const res = {
        json: (data) => {
          responseData = data;
        },
        status: () => res,
      };

      await getOverviewMetrics(req, res);

      expect(responseData).toBeDefined();
      expect(responseData.success).toBe(true);
      expect(responseData.data.conversionRate).toBe('0%');
      expect(responseData.data.totalLeads).toBe(0);
      expect(responseData.data.stageCounts).toEqual({
        new_lead: 0,
        contacted: 0,
        not_interested: 0,
        converted: 0,
        payment_done: 0,
      });
      expect(responseData.data.sourceBreakdown).toEqual({
        manual: 0,
        signup: 0,
        ads: 0,
      });
    });
  });
});
