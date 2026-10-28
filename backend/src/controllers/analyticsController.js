const Lead = require('../models/Lead');
const Template = require('../models/Template');
const Recording = require('../models/Recording');
const xlsx = require('xlsx');
const PDFDocument = require('pdfkit');

const getScopedLeadFilter = (req) => {
  const wsId = req.workspaceId || req.tenantId || req.user?.workspaceId;
  const isManagerOrOwner = req.user?.role === 'superadmin' ||
    req.user?.isAdmin ||
    req.membership?.role === 'owner' ||
    req.membership?.role === 'manager' ||
    req.user?.companyRole === 'owner' ||
    req.user?.companyRole === 'manager';

  let baseFilter = {};
  if (wsId) {
    baseFilter = {
      $or: [
        { workspaceId: wsId },
        { companyId: req.user.companyId || req.user._id },
        { userId: req.user._id }
      ]
    };
  } else {
    baseFilter = { userId: req.user._id };
  }

  if (!isManagerOrOwner) {
    baseFilter = {
      ...baseFilter,
      $or: [
        { assignedTo: req.user._id },
        { userId: req.user._id },
        { currentOwnerId: req.user._id }
      ]
    };
  }
  return baseFilter;
// 60-second in-memory cache for getAnalytics per workspace/user
const analyticsCache = new Map();
const ANALYTICS_CACHE_TTL = 60 * 1000;

// @desc  Analytics summary
// @route GET /api/analytics
// @access Private
exports.getAnalytics = async (req, res) => {
  try {
    const userId = req.user._id;
    const wsId = req.workspaceId || req.tenantId || req.user?.workspaceId || 'personal';
    const cacheKey = `${wsId}:${userId}`;
    const cached = analyticsCache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.timestamp < ANALYTICS_CACHE_TTL) {
      return res.json(cached.data);
    }

    const leadFilter = getScopedLeadFilter(req);

    const [
      totalLeads,
      statusCounts,
      totalTemplates,
      totalRecordings,
      todayFollowUps,
      recentLeads,
      revenueAgg,
    ] = await Promise.all([
      // Total leads
      Lead.countDocuments(leadFilter),

      // Leads by status (aggregation)
      Lead.aggregate([
        { $match: leadFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      // Templates count
      Template.countDocuments({ $or: [{ userId }, ...(req.workspaceId ? [{ workspaceId: req.workspaceId }] : [])] }),

      // Recordings count
      Recording.countDocuments({ $or: [{ userId }, ...(req.workspaceId ? [{ workspaceId: req.workspaceId }] : [])] }),

      // Today's follow-ups
      Lead.countDocuments({
        ...leadFilter,
        followUpDate: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lte: new Date(new Date().setHours(23, 59, 59, 999)),
        },
        status: { $ne: 'closed' },
      }),

      // Last 7 days leads
      Lead.aggregate([
        {
          $match: {
            ...leadFilter,
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Total Closed Revenue Aggregation
      Lead.aggregate([
        {
          $match: {
            ...leadFilter,
            status: { $in: ['closed', 'Closed', 'Closed / Won', 'payment_done'] },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$closedDealAmount' },
          },
        },
      ]),
    ]);

    // Map status counts
    const byStatus = { new: 0, contacted: 0, follow_up: 0, closed: 0 };
    const allStatusMap = {};
    statusCounts.forEach((s) => {
      if (s._id) allStatusMap[s._id] = s.count;
      if (byStatus[s._id] !== undefined) byStatus[s._id] = s.count;
    });

    const closedCount = allStatusMap['closed'] || byStatus.closed || 0;
    const conversionRate =
      totalLeads > 0 ? Math.round((closedCount / totalLeads) * 100) : 0;
    const totalRevenue = revenueAgg[0]?.total || 0;

    const result = {
      totalLeads,
      byStatus,
      allStatusMap,
      conversionRate,
      totalRevenue,
      totalTemplates,
      totalRecordings,
      todayFollowUps,
      recentLeads, // last 7 days by day
    };

    if (analyticsCache.size > 500) analyticsCache.clear();
    analyticsCache.set(cacheKey, { data: result, timestamp: now });

    res.json(result);
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Export Analytics & Performance Report (Excel / PDF)
// @route GET /api/analytics/export
// @access Private
exports.exportAnalytics = async (req, res) => {
  try {
    const { format = 'xlsx' } = req.query;
    const userId = req.user._id;
    const leadFilter = getScopedLeadFilter(req);

    const [totalLeads, statusCounts, revenueAgg, todayFollowUps] = await Promise.all([
      Lead.countDocuments(leadFilter),
      Lead.aggregate([
        { $match: leadFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Lead.aggregate([
        {
          $match: {
            ...leadFilter,
            status: { $in: ['closed', 'Closed', 'Closed / Won', 'payment_done'] },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$closedDealAmount' },
          },
        },
      ]),
      Lead.countDocuments({
        ...leadFilter,
        followUpDate: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lte: new Date(new Date().setHours(23, 59, 59, 999)),
        },
        status: { $ne: 'closed' },
      }),
    ]);

    const totalRevenue = revenueAgg[0]?.total || 0;
    const statusMap = {};
    let closedCount = 0;
    statusCounts.forEach(s => {
      const st = s._id || 'unknown';
      statusMap[st] = s.count;
      if (st.toLowerCase().includes('closed') || st.toLowerCase().includes('won')) {
        closedCount += s.count;
      }
    });

    const conversionRate = totalLeads > 0 ? ((closedCount / totalLeads) * 100).toFixed(1) + '%' : '0%';
    const timestamp = new Date().toISOString().slice(0, 10);

    if (format.toLowerCase() === 'pdf') {
      const doc = new PDFDocument({ margin: 36, size: 'A4' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="performance_analytics_${timestamp}.pdf"`);
      doc.pipe(res);

      doc.fontSize(20).font('Helvetica-Bold').text('Executive Performance & Analytics Report', { align: 'center' });
      doc.moveDown(0.4);
      doc.fontSize(10).font('Helvetica').fillColor('#666666').text(`Account: ${req.user.name} | Generated: ${new Date().toLocaleString()}`, { align: 'center' });
      doc.moveDown(1);

      // KPI Summary Box
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#111827').text('High-Level Performance Metrics:');
      doc.moveDown(0.5);

      const kpis = [
        ['Total Opportunities in Pipeline', String(totalLeads)],
        ['Total Closed Deals Won', String(closedCount)],
        ['Pipeline Conversion Rate', conversionRate],
        ['Total Revenue Generated (INR)', `INR ${totalRevenue.toLocaleString('en-IN')}`],
        ['Today Scheduled Follow-ups', String(todayFollowUps)],
      ];

      kpis.forEach(([label, val]) => {
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#4f46e5').text(`• ${label}: `, { continued: true });
        doc.font('Helvetica').fillColor('#1f2937').text(val);
      });

      doc.moveDown(1);
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#111827').text('Pipeline Stage Distribution:');
      doc.moveDown(0.5);

      const tableTop = doc.y;
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#4f46e5');
      doc.text('Pipeline Stage', 40, tableTop);
      doc.text('Prospects Count', 260, tableTop);
      doc.text('Share of Pipeline', 420, tableTop);
      doc.moveTo(40, tableTop + 14).lineTo(540, tableTop + 14).strokeColor('#e5e7eb').stroke();

      let currentY = tableTop + 18;
      Object.entries(statusMap).forEach(([st, cnt]) => {
        const pct = totalLeads > 0 ? ((cnt / totalLeads) * 100).toFixed(1) + '%' : '0%';
        doc.fontSize(9).font('Helvetica').fillColor('#1f2937');
        doc.text(st.toUpperCase(), 40, currentY);
        doc.text(String(cnt), 260, currentY);
        doc.text(pct, 420, currentY);
        currentY += 16;
      });

      doc.end();
      return;
    }

    // Excel Export
    const summarySheet = xlsx.utils.json_to_sheet([
      { 'Metric': 'Total Opportunities in Pipeline', 'Value': totalLeads },
      { 'Metric': 'Total Closed Deals Won', 'Value': closedCount },
      { 'Metric': 'Pipeline Conversion Rate', 'Value': conversionRate },
      { 'Metric': 'Total Revenue Generated (₹)', 'Value': totalRevenue },
      { 'Metric': 'Today Scheduled Follow-ups', 'Value': todayFollowUps },
      { 'Metric': 'Report Generated At', 'Value': new Date().toLocaleString() },
    ]);

    const breakdownRows = Object.entries(statusMap).map(([status, count]) => ({
      'Pipeline Stage': status.toUpperCase(),
      'Prospects Count': count,
      'Share of Pipeline': totalLeads > 0 ? ((count / totalLeads) * 100).toFixed(1) + '%' : '0%',
    }));
    const breakdownSheet = xlsx.utils.json_to_sheet(breakdownRows);

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, summarySheet, 'Executive Summary');
    xlsx.utils.book_append_sheet(workbook, breakdownSheet, 'Pipeline Breakdown');

    const excelBuffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="performance_analytics_${timestamp}.xlsx"`);
    res.send(excelBuffer);
  } catch (error) {
    console.error('exportAnalytics error:', error);
    res.status(500).json({ message: 'Failed to export analytics report' });
  }
};
