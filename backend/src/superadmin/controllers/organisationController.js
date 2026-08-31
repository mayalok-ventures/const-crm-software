const {
  listOrganisations,
  getTenantDetails,
  updateTenantStatus,
  updateTenantPlan,
  transitionTenantState,
  getTenantLifecycleDetails,
} = require('../services/tenantService');
const { startImpersonationSession } = require('../services/impersonationService');

exports.getOrganisations = async (req, res) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;
    const result = await listOrganisations({ search, status, page, limit });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('SuperAdmin Get Orgs Error:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Failed to fetch organisations' });
  }
};

exports.getOrganisationById = async (req, res) => {
  try {
    const result = await getTenantDetails(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('SuperAdmin Get Org Details Error:', error);
    res.status(error.message === 'Organisation not found' ? 404 : (error.statusCode || 500)).json({
      success: false,
      message: error.message || 'Failed to fetch organisation details',
    });
  }
};

exports.getLifecycle = async (req, res) => {
  try {
    const details = await getTenantLifecycleDetails(req.params.id);
    res.json({ success: true, data: details });
  } catch (error) {
    console.error('SuperAdmin Get Lifecycle Error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to fetch tenant lifecycle details',
    });
  }
};

exports.transitionLifecycle = async (req, res) => {
  try {
    const targetState = req.body.targetState || req.body.state;
    if (!targetState) {
      return res.status(400).json({ success: false, message: 'targetState is required' });
    }
    const result = await transitionTenantState(req.params.id, targetState, req.user, req.body);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('SuperAdmin Transition Lifecycle Error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      code: error.code || 'LIFECYCLE_ERROR',
      message: error.message || 'Failed to transition tenant lifecycle',
    });
  }
};

exports.activateTenant = async (req, res) => {
  try {
    const result = await transitionTenantState(req.params.id, 'ACTIVE', req.user, req.body);
    res.json({ success: true, message: 'Tenant successfully activated', ...result });
  } catch (error) {
    console.error('SuperAdmin Activate Tenant Error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      code: error.code || 'ACTIVATION_ERROR',
      message: error.message || 'Failed to activate tenant',
    });
  }
};

exports.suspendTenant = async (req, res) => {
  try {
    const result = await transitionTenantState(req.params.id, 'SUSPENDED', req.user, req.body);
    res.json({ success: true, message: 'Tenant successfully suspended', ...result });
  } catch (error) {
    console.error('SuperAdmin Suspend Tenant Error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      code: error.code || 'SUSPENSION_ERROR',
      message: error.message || 'Failed to suspend tenant',
    });
  }
};

exports.cancelTenant = async (req, res) => {
  try {
    const result = await transitionTenantState(req.params.id, 'CANCELLED', req.user, req.body);
    res.json({ success: true, message: 'Tenant successfully cancelled', ...result });
  } catch (error) {
    console.error('SuperAdmin Cancel Tenant Error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      code: error.code || 'CANCELLATION_ERROR',
      message: error.message || 'Failed to cancel tenant',
    });
  }
};

exports.archiveTenant = async (req, res) => {
  try {
    const result = await transitionTenantState(req.params.id, 'ARCHIVED', req.user, req.body);
    res.json({ success: true, message: 'Tenant successfully archived', ...result });
  } catch (error) {
    console.error('SuperAdmin Archive Tenant Error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      code: error.code || 'ARCHIVAL_ERROR',
      message: error.message || 'Failed to archive tenant',
    });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { status, reason } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }
    const updated = await updateTenantStatus(req.params.id, { status, reason }, req.user);
    res.json({ success: true, message: `Organisation status updated to ${status}`, organisation: updated });
  } catch (error) {
    console.error('SuperAdmin Update Status Error:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Failed to update organisation status' });
  }
};

exports.updatePlan = async (req, res) => {
  try {
    const { planCode, billingCycle, durationDays, planEndDate, isCustomPlan, reason } = req.body;
    if (!planCode) {
      return res.status(400).json({ success: false, message: 'planCode is required' });
    }
    const updated = await updateTenantPlan(
      req.params.id,
      { planCode, billingCycle, durationDays, planEndDate, isCustomPlan, reason },
      req.user
    );
    res.json({
      success: true,
      message: `Organisation plan successfully updated to ${planCode}`,
      organisation: updated,
    });
  } catch (error) {
    console.error('SuperAdmin Update Plan Error:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Failed to update organisation plan' });
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
