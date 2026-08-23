const { getPlatformAuditLogs } = require('../services/systemService');

exports.getAuditLogs = async (req, res) => {
  try {
    const { action, search, page = 1, limit = 50 } = req.query;
    const result = await getPlatformAuditLogs({ action, search, page, limit });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('SuperAdmin Audit Logs Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch platform audit logs' });
  }
};
