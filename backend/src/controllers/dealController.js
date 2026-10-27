const mongoose = require('mongoose');
const AdmissionDeal = require('../models/AdmissionDeal');
const Lead = require('../models/Lead');

/**
 * List deals for workspace with filtering and pagination
 */
exports.getDeals = async (req, res) => {
  try {
    const workspaceId = req.workspaceId;
    const {
      page = 1,
      limit = 50,
      admissionStatus,
      invoiceStatus,
      payoutStatus,
      search,
    } = req.query;

    const query = { workspaceId };

    if (admissionStatus) {
      query.admissionStatus = admissionStatus;
    }
    if (invoiceStatus) {
      query['commission.invoiceStatus'] = invoiceStatus;
    }
    if (payoutStatus) {
      query['commission.payoutStatus'] = payoutStatus;
    }
    if (search && search.trim()) {
      const s = search.trim();
      query.$or = [
        { studentName: { $regex: s, $options: 'i' } },
        { studentPhone: { $regex: s, $options: 'i' } },
        { collegeName: { $regex: s, $options: 'i' } },
        { courseName: { $regex: s, $options: 'i' } },
        { 'commission.invoiceNumber': { $regex: s, $options: 'i' } },
      ];
    }

    const userRole = req.membership?.role || req.user.workspaceRole || req.user.role;
    const isOwnerOrManager = userRole === 'owner' || userRole === 'manager' || userRole === 'auditor' || req.user.role === 'admin' || req.user.role === 'superadmin';
    if (!isOwnerOrManager) {
      query.$or = [{ assignedTo: req.user._id }, { createdBy: req.user._id }];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [deals, total] = await Promise.all([
      AdmissionDeal.find(query)
        .populate('assignedTo', 'name email')
        .populate('createdBy', 'name email')
        .sort({ confirmedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      AdmissionDeal.countDocuments(query),
    ]);

    const canViewCommission = req.membership && req.membership.hasPermission
      ? await req.membership.hasPermission('commission.view')
      : (req.membership?.role === 'owner' || req.user.role === 'admin' || req.user.role === 'superadmin' || req.user.companyRole === 'owner');

    const sanitizedDeals = canViewCommission
      ? deals
      : deals.map(d => {
          const { commission, ...safe } = d;
          return safe;
        });

    res.json({
      success: true,
      data: sanitizedDeals,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('getDeals error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch deals' });
  }
};

/**
 * Get single deal
 */
exports.getDealById = async (req, res) => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspaceId;

    const dealDoc = await AdmissionDeal.findOne({ _id: id, workspaceId })
      .populate('leadId')
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .lean();

    if (!dealDoc) {
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }

    const userRole = req.membership?.role || req.user.workspaceRole || req.user.role;
    const isOwnerOrManager = userRole === 'owner' || userRole === 'manager' || userRole === 'auditor' || req.user.role === 'admin' || req.user.role === 'superadmin';
    if (!isOwnerOrManager) {
      const assignedId = dealDoc.assignedTo?._id ? dealDoc.assignedTo._id.toString() : dealDoc.assignedTo?.toString();
      const createdId = dealDoc.createdBy?._id ? dealDoc.createdBy._id.toString() : dealDoc.createdBy?.toString();
      const currentUid = req.user._id.toString();
      if (assignedId !== currentUid && createdId !== currentUid) {
        return res.status(403).json({ success: false, message: 'Access denied to this deal' });
      }
    }

    const canViewCommission = req.membership && req.membership.hasPermission
      ? await req.membership.hasPermission('commission.view')
      : (req.membership?.role === 'owner' || req.user.role === 'admin' || req.user.role === 'superadmin' || req.user.companyRole === 'owner');

    if (!canViewCommission && dealDoc.commission) {
      delete dealDoc.commission;
    }

    res.json({
      success: true,
      data: dealDoc,
    });
  } catch (error) {
    console.error('getDealById error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch deal' });
  }
};

/**
 * Create an admission deal (usually upon student confirmation)
 */
exports.createDeal = async (req, res) => {
  try {
    const workspaceId = req.workspaceId;
    const {
      leadId,
      studentName,
      studentPhone,
      studentEmail,
      collegeName,
      courseName,
      academicYear,
      quota,
      tuitionValue,
      tokenFeePaid,
      currency,
      admissionStatus,
      commission,
      assignedTo,
    } = req.body;

    if (!studentName || !collegeName || !courseName) {
      return res.status(400).json({
        success: false,
        message: 'Student name, college name, and course name are required',
      });
    }

    // Idempotency check: prevent duplicate deal creation on repeated requests / network retries
    if (leadId) {
      const existingDeal = await AdmissionDeal.findOne({
        leadId,
        workspaceId,
        admissionStatus: { $ne: 'cancelled' },
      });
      if (existingDeal) {
        return res.status(409).json({
          success: false,
          code: 'DEAL_ALREADY_EXISTS',
          message: 'An active admission deal already exists for this lead.',
          data: existingDeal,
        });
      }
    }

    const canEditCommission = req.membership && req.membership.hasPermission
      ? await req.membership.hasPermission('commission.edit')
      : (req.membership?.role === 'owner' || req.user.role === 'admin' || req.user.role === 'superadmin' || req.user.companyRole === 'owner');

    // Auto-calculate expected commission
    const tuition = Number(tuitionValue) || 0;
    const rate = canEditCommission ? (Number(commission?.ratePercent) || 0) : 0;
    const expectedAmount = canEditCommission ? (Number(commission?.expectedAmount) || (tuition * rate / 100)) : 0;

    const deal = await AdmissionDeal.create({
      workspaceId,
      leadId: leadId || null,
      studentName: studentName.trim(),
      studentPhone: studentPhone ? studentPhone.trim() : '',
      studentEmail: studentEmail ? studentEmail.trim() : '',
      collegeName: collegeName.trim(),
      courseName: courseName.trim(),
      academicYear: academicYear || '2026-2027',
      quota: quota || 'Merit',
      tuitionValue: tuition,
      tokenFeePaid: Number(tokenFeePaid) || 0,
      currency: currency || 'INR',
      admissionStatus: admissionStatus || 'confirmed',
      commission: {
        ratePercent: rate,
        expectedAmount,
        invoiceNumber: canEditCommission && commission?.invoiceNumber ? commission.invoiceNumber.trim() : '',
        invoiceStatus: canEditCommission ? (commission?.invoiceStatus || 'unbilled') : 'unbilled',
        invoicedAt: canEditCommission && commission?.invoicedAt ? new Date(commission.invoicedAt) : null,
        receivedAmount: canEditCommission ? (Number(commission?.receivedAmount) || 0) : 0,
        payoutStatus: canEditCommission ? (commission?.payoutStatus || 'pending') : 'pending',
        settledAt: canEditCommission && commission?.settledAt ? new Date(commission.settledAt) : null,
      },
      assignedTo: assignedTo || req.user._id,
      createdBy: req.user._id,
    });

    // Mark lead status to converted/admitted and record audit activity
    if (leadId) {
      const leadFilter = {
        _id: leadId,
        $or: [
          { workspaceId },
          { companyId: req.user.companyId || req.user._id },
          { userId: req.user._id },
        ],
      };

      await Lead.findOneAndUpdate(
        leadFilter,
        {
          $set: {
            status: 'converted',
            pipeline_stage: 'converted',
            'admissionDetails.college': collegeName.trim(),
            'admissionDetails.course': courseName.trim(),
            'admissionDetails.admissionDate': new Date(),
            'admissionDetails.feeAmount': tuition,
          },
          $push: {
            leadActivities: {
              action: 'admission_confirmed',
              performedBy: req.user._id,
              performerName: req.user.name || 'Counselor',
              details: `Admission confirmed at ${collegeName.trim()} (${courseName.trim()}) - Tuition: ₹${tuition.toLocaleString('en-IN')}`,
              timestamp: new Date(),
            },
          },
        }
      );
    }

    res.status(201).json({
      success: true,
      message: 'Admission deal recorded successfully',
      data: deal,
    });
  } catch (error) {
    console.error('createDeal error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create deal' });
  }
};

/**
 * Update admission deal details
 */
exports.updateDeal = async (req, res) => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspaceId;
    const updates = req.body;

    const isOwnerOrManager =
      req.membership?.role === 'owner' ||
      req.membership?.role === 'manager' ||
      req.user.role === 'admin' ||
      req.user.role === 'superadmin' ||
      (req.user.companyRole === 'owner' && !req.user.companyId);

    const dealQuery = { _id: id, workspaceId };
    if (!isOwnerOrManager) {
      dealQuery.assignedTo = req.user._id;
    }

    const deal = await AdmissionDeal.findOne(dealQuery);
    if (!deal) {
      return res.status(404).json({ success: false, message: 'Deal not found or unauthorized' });
    }

    if (updates.studentName) deal.studentName = updates.studentName.trim();
    if (updates.studentPhone !== undefined) deal.studentPhone = updates.studentPhone.trim();
    if (updates.studentEmail !== undefined) deal.studentEmail = updates.studentEmail.trim();
    if (updates.collegeName) deal.collegeName = updates.collegeName.trim();
    if (updates.courseName) deal.courseName = updates.courseName.trim();
    if (updates.academicYear) deal.academicYear = updates.academicYear;
    if (updates.quota) deal.quota = updates.quota;
    if (updates.tuitionValue !== undefined) deal.tuitionValue = Number(updates.tuitionValue) || 0;
    if (updates.tokenFeePaid !== undefined) deal.tokenFeePaid = Number(updates.tokenFeePaid) || 0;
    if (updates.admissionStatus) deal.admissionStatus = updates.admissionStatus;

    if (updates.assignedTo && String(updates.assignedTo) !== String(deal.assignedTo)) {
      const canAssign = req.membership && req.membership.hasPermission
        ? await req.membership.hasPermission('leads.assign')
        : isOwnerOrManager;
      if (!canAssign) {
        return res.status(403).json({
          success: false,
          code: 'ASSIGNMENT_PERMISSION_DENIED',
          message: 'You do not have permission to reassign deals to another consultant',
        });
      }
      deal.assignedTo = updates.assignedTo;
    }

    const canEditCommission = req.membership && req.membership.hasPermission
      ? await req.membership.hasPermission('commission.edit')
      : (req.membership?.role === 'owner' || req.user.role === 'admin' || req.user.role === 'superadmin' || (req.user.companyRole === 'owner' && !req.user.companyId));

    // Recalculate commission if updated (strictly gated by commission.edit)
    if (updates.commission) {
      if (!canEditCommission) {
        return res.status(403).json({
          success: false,
          code: 'COMMISSION_EDIT_FORBIDDEN',
          message: 'You do not have permission to modify deal commission or financial payout terms.',
        });
      }

      if (updates.commission.ratePercent !== undefined) {
        deal.commission.ratePercent = Number(updates.commission.ratePercent) || 0;
        deal.commission.expectedAmount = deal.tuitionValue * (deal.commission.ratePercent / 100);
      }
      if (updates.commission.expectedAmount !== undefined) {
        deal.commission.expectedAmount = Number(updates.commission.expectedAmount) || 0;
      }
      if (updates.commission.invoiceNumber !== undefined) {
        deal.commission.invoiceNumber = updates.commission.invoiceNumber.trim();
      }
      if (updates.commission.invoiceStatus) {
        deal.commission.invoiceStatus = updates.commission.invoiceStatus;
        if (updates.commission.invoiceStatus === 'invoiced' && !deal.commission.invoicedAt) {
          deal.commission.invoicedAt = new Date();
        }
      }
      if (updates.commission.receivedAmount !== undefined) {
        deal.commission.receivedAmount = Number(updates.commission.receivedAmount) || 0;
        if (deal.commission.receivedAmount >= deal.commission.expectedAmount && deal.commission.expectedAmount > 0) {
          deal.commission.payoutStatus = 'paid';
          deal.commission.settledAt = deal.commission.settledAt || new Date();
        } else if (deal.commission.receivedAmount > 0) {
          deal.commission.payoutStatus = 'partial';
        }
      }
      if (updates.commission.payoutStatus) {
        deal.commission.payoutStatus = updates.commission.payoutStatus;
        if (updates.commission.payoutStatus === 'paid' && !deal.commission.settledAt) {
          deal.commission.settledAt = new Date();
        }
      }
    }

    await deal.save();

    const canViewCommission = req.membership && req.membership.hasPermission
      ? await req.membership.hasPermission('commission.view')
      : isOwnerOrManager;

    const safeDeal = deal.toObject();
    if (!canViewCommission) {
      delete safeDeal.commission;
    }

    res.json({
      success: true,
      message: 'Deal updated successfully',
      data: safeDeal,
    });
  } catch (error) {
    console.error('updateDeal error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update deal' });
  }
};

/**
 * Financial and commission summary report
 */
exports.getCommissionSummary = async (req, res) => {
  try {
    const workspaceId = req.workspaceId;
    const wsObjectId = new mongoose.Types.ObjectId(String(workspaceId));

    const stats = await AdmissionDeal.aggregate([
      { $match: { workspaceId: wsObjectId } },
      {
        $group: {
          _id: null,
          totalDeals: { $sum: 1 },
          confirmedDeals: {
            $sum: { $cond: [{ $eq: ['$admissionStatus', 'confirmed'] }, 1, 0] },
          },
          cancelledDeals: {
            $sum: { $cond: [{ $eq: ['$admissionStatus', 'cancelled'] }, 1, 0] },
          },
          totalTuition: {
            $sum: { $cond: [{ $ne: ['$admissionStatus', 'cancelled'] }, '$tuitionValue', 0] },
          },
          totalExpectedCommission: {
            $sum: { $cond: [{ $ne: ['$admissionStatus', 'cancelled'] }, '$commission.expectedAmount', 0] },
          },
          totalReceivedCommission: { $sum: '$commission.receivedAmount' },
          unbilledCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$admissionStatus', 'cancelled'] },
                    { $eq: ['$commission.invoiceStatus', 'unbilled'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          invoicedCount: {
            $sum: { $cond: [{ $eq: ['$commission.invoiceStatus', 'invoiced'] }, 1, 0] },
          },
          paidCount: {
            $sum: { $cond: [{ $eq: ['$commission.payoutStatus', 'paid'] }, 1, 0] },
          },
        },
      },
    ]);

    const result = stats[0] || {
      totalDeals: 0,
      confirmedDeals: 0,
      cancelledDeals: 0,
      totalTuition: 0,
      totalExpectedCommission: 0,
      totalReceivedCommission: 0,
      unbilledCount: 0,
      invoicedCount: 0,
      paidCount: 0,
    };

    result.outstandingCommission = Math.max(0, result.totalExpectedCommission - result.totalReceivedCommission);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('getCommissionSummary error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to generate commission summary' });
  }
};

/**
 * Delete an unbilled, unpaid admission deal
 */
exports.deleteDeal = async (req, res) => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspaceId;

    const deal = await AdmissionDeal.findOne({ _id: id, workspaceId });
    if (!deal) {
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }

    // Financial integrity invariant: prevent deleting deals that are invoiced or have settled commission
    const isInvoicedOrPaid =
      deal.commission?.invoiceStatus === 'invoiced' ||
      deal.commission?.invoiceStatus === 'paid' ||
      deal.commission?.payoutStatus === 'paid' ||
      (deal.commission?.receivedAmount > 0) ||
      Boolean(deal.commission?.invoiceNumber);

    if (isInvoicedOrPaid) {
      return res.status(400).json({
        success: false,
        code: 'DEAL_FINANCIALLY_LOCKED',
        message: 'Cannot delete an admission deal that has been invoiced or has settled commission. Use the void/cancellation workflow instead to preserve the financial audit trail.',
      });
    }

    await AdmissionDeal.deleteOne({ _id: deal._id });

    res.json({
      success: true,
      message: 'Admission deal removed successfully',
    });
  } catch (error) {
    console.error('deleteDeal error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to delete deal' });
  }
};

/**
 * Cancel / Void an admission deal with audit trail
 */
exports.cancelDeal = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const workspaceId = req.workspaceId;

    const isOwnerOrManager =
      req.membership?.role === 'owner' ||
      req.membership?.role === 'manager' ||
      req.user.role === 'admin' ||
      req.user.role === 'superadmin' ||
      (req.user.companyRole === 'owner' && !req.user.companyId);

    const dealQuery = { _id: id, workspaceId };
    if (!isOwnerOrManager) {
      dealQuery.assignedTo = req.user._id;
    }

    const deal = await AdmissionDeal.findOne(dealQuery);
    if (!deal) {
      return res.status(404).json({ success: false, message: 'Deal not found or unauthorized' });
    }

    if (deal.admissionStatus === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Deal is already cancelled',
      });
    }

    deal.admissionStatus = 'cancelled';
    deal.cancelledAt = new Date();
    deal.cancelledBy = req.user._id;
    deal.cancellationReason = (reason || '').trim() || 'Admission cancelled by consultant';

    // If commission was not already received, mark invoiceStatus as voided/unbilled
    if (deal.commission.payoutStatus !== 'paid') {
      deal.commission.invoiceStatus = 'unbilled';
    }

    await deal.save();

    res.json({
      success: true,
      message: 'Admission deal cancelled successfully with audit history preserved',
      data: deal,
    });
  } catch (error) {
    console.error('cancelDeal error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to cancel deal' });
  }
};
