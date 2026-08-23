const Lead = require('../../models/Lead');

exports.getGlobalLeads = async (req, res) => {
  try {
    const { search, stage, source, page = 1, limit = 20 } = req.query;
    const query = {};

    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ name: regex }, { phone: regex }, { email: regex }, { company: regex }];
    }

    if (stage && stage !== 'all') {
      if (stage === 'payment_done') {
        query.status = { $in: ['payment_done', 'closed', 'won', 'closed / won', 'closed won', 'advance paid', 'Payment Done'] };
      } else if (stage === 'converted') {
        query.status = { $in: ['converted', 'qualified', 'documents uploaded', 'Converted'] };
      } else if (stage === 'not_interested') {
        query.status = { $in: ['not_interested', 'lost', 'not interested', 'Not Interested'] };
      } else if (stage === 'contacted') {
        query.status = { $in: ['contacted', 'connected', 'attempted', 'inquiry', 'demo class', 'floor plan shared', 'Contacted'] };
      } else if (stage === 'new_lead') {
        query.status = { $in: ['new_lead', 'new', 'New Lead', ''] };
      }
    }

    if (source && source !== 'all') {
      query.source = source.toUpperCase();
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [total, leads] = await Promise.all([
      Lead.countDocuments(query),
      Lead.find(query)
        .populate('companyId', 'name companyInfo')
        .populate('assignedTo', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
    ]);

    res.json({
      success: true,
      leads,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)) || 1,
      },
    });
  } catch (error) {
    console.error('SuperAdmin Get Global Leads Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch global leads' });
  }
};
