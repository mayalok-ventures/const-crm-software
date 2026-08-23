const {
  listOrganisations,
  getTenantDetails,
  updateTenantStatus,
  updateTenantPlan,
} = require('../services/tenantService');
const { startImpersonationSession } = require('../services/impersonationService');

exports.getOrganisations = async (req, res) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;
    const result = await listOrganisations({ search, status, page, limit });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('SuperAdmin Get Orgs Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch organisations' });
  }
};

exports.getOrganisationById = async (req, res) => {
  try {
    const result = await getTenantDetails(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('SuperAdmin Get Org Details Error:', error);
    res.status(error.message === 'Organisation not found' ? 404 : 500).json({
      success: false,
      message: error.message || 'Failed to fetch organisation details',
    });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { status, reason } = req.body;
    if (!['ACTIVE', 'BLOCKED', 'SUSPENDED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }
    const updated = await updateTenantStatus(req.params.id, { status, reason }, req.user);
    res.json({ success: true, message: `Organisation status updated to ${status}`, organisation: updated });
  } catch (error) {
    console.error('SuperAdmin Update Status Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update organisation status' });
  }
};

exports.updatePlan = async (req, res) => {
  try {
    const { planCode, reason } = req.body;
    if (!planCode) {
      return res.status(400).json({ success: false, message: 'planCode is required' });
    }
    const updated = await updateTenantPlan(req.params.id, { planCode, reason }, req.user);
    res.json({ success: true, message: `Organisation plan updated to ${planCode}`, organisation: updated });
  } catch (error) {
    console.error('SuperAdmin Update Plan Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update organisation plan' });
  }
};

exports.impersonateUser = async (req, res) => {
  try {
    const { targetUserId, reason } = req.body;
    const session = await startImpersonationSession({ targetUserId, reason }, req.user);
    res.json({ success: true, ...session });
  } catch (error) {
    console.error('SuperAdmin Impersonation Error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to initiate support session' });
  }
};
