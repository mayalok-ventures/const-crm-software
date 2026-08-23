const { getSystemHealth, getPlatformErrorLogs } = require('../services/systemService');

exports.getHealth = async (req, res) => {
  try {
    const health = await getSystemHealth();
    res.json({ success: true, ...health });
  } catch (error) {
    console.error('SuperAdmin System Health Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch system health' });
  }
};

exports.getErrorLogs = async (req, res) => {
  try {
    const { severity, page = 1, limit = 50 } = req.query;
    const result = await getPlatformErrorLogs({ severity, page, limit });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('SuperAdmin Error Logs Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch error logs' });
  }
};
