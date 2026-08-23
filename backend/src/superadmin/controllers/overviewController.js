const { getPlatformOverview } = require('../services/overviewService');

exports.getOverview = async (req, res) => {
  try {
    const { timeframe = 30 } = req.query;
    const overview = await getPlatformOverview({ timeframe: Number(timeframe) });
    res.json({ success: true, ...overview });
  } catch (error) {
    console.error('SuperAdmin Overview Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch platform overview' });
  }
};
