const mongoose = require('mongoose');
const FeeInstallment = require('../models/FeeInstallment');
const Lead = require('../models/Lead');
const Payment = require('../models/Payment');
const { buildLeadPermissionQuery } = require('./leadsController');
const { withTransaction } = require('../utils/withTransaction');

/**
 * Computes whether an installment is overdue in a UTC-safe manner.
 * Evaluates against the end of the due day in UTC (23:59:59.999 UTC) plus gracePeriodDays.
 */
function isInstallmentOverdue(dueDate, gracePeriodDays = 0, asOf = Date.now()) {
  if (!dueDate) return false;
  const d = new Date(dueDate);
  if (isNaN(d.getTime())) return false;
  const endOfDueDayUtc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999);
  const graceMs = (Math.max(0, Number(gracePeriodDays)) || 0) * 86400000;
  return asOf > (endOfDueDayUtc + graceMs);
}
exports.isInstallmentOverdue = isInstallmentOverdue;

/**
 * @desc  Get all fee installments for a lead with summary metrics and auto-overdue detection
 * @route GET /api/leads/:id/installments
 * @access Private
 */
exports.getLeadInstallments = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid lead ID format' });
    }

    const permissionQuery = await buildLeadPermissionQuery(req.user, false);
    const lead = await Lead.findOne({ _id: id, ...permissionQuery })
      .select('_id name workspaceId')
      .lean();

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found or unauthorized' });
    }

    const wsId = req.workspaceId || lead.workspaceId;
    const installments = await FeeInstallment.find({
      leadId: lead._id,
      ...(wsId ? { workspaceId: wsId } : {}),
    })
      .populate('paymentId', 'amount method transaction_id verified_by_agent createdAt')
      .populate('createdBy', 'name email')
      .sort({ installmentNumber: 1 });

    const now = Date.now();
    const updateOps = [];

    // Auto-detect overdue status based on dueDate and gracePeriodDays (UTC-safe)
    for (const inst of installments) {
      if (inst.status === 'pending' || inst.status === 'partially_paid') {
        if (isInstallmentOverdue(inst.dueDate, inst.gracePeriodDays, now)) {
          inst.status = 'overdue';
          updateOps.push(
            FeeInstallment.updateOne({ _id: inst._id }, { $set: { status: 'overdue' } })
          );
        }
      }
    }

    if (updateOps.length > 0) {
      await Promise.all(updateOps).catch((err) =>
        console.warn('[FeeInstallment] Failed batch overdue update:', err.message)
      );
    }

    // Compute financial summary
    let totalFee = 0;
    let totalPaid = 0;
    let totalOverdue = 0;

    for (const inst of installments) {
      const amt = Number(inst.amount) || 0;
      const paid = Number(inst.paidAmount) || 0;
      totalFee += amt;
      totalPaid += paid;
      if (inst.status === 'overdue') {
        totalOverdue += Math.max(0, amt - paid);
      }
    }

    const totalPending = Math.max(0, totalFee - totalPaid);

    res.json({
      success: true,
      leadId: lead._id,
      leadName: lead.name,
      installments,
      summary: {
        totalFee,
        totalPaid,
        totalPending,
        totalOverdue,
        count: installments.length,
      },
    });
  } catch (error) {
    console.error('getLeadInstallments error:', error);
    res.status(500).json({ message: 'Server error fetching installments' });
  }
};

/**
 * @desc  Create one or more fee installments for a lead schedule
 * @route POST /api/leads/:id/installments
 * @access Private
 */
exports.createLeadInstallments = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid lead ID format' });
    }

    const permissionQuery = await buildLeadPermissionQuery(req.user, false);
    const lead = await Lead.findOne({ _id: id, ...permissionQuery });

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found or unauthorized' });
    }

    const rawInstallments = Array.isArray(req.body.installments)
      ? req.body.installments
      : [req.body];

    if (rawInstallments.length === 0) {
      return res.status(400).json({ message: 'At least one installment is required' });
    }

    // Find highest current installment number for sequential ordering
    const existingCount = await FeeInstallment.countDocuments({ leadId: lead._id });
    let currentNumber = existingCount;

    const toInsert = [];
    let totalAmount = 0;

    for (const item of rawInstallments) {
      const amount = Number(item.amount);
      if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: 'Installment amount must be a positive number' });
      }

      if (!item.dueDate || isNaN(new Date(item.dueDate).getTime())) {
        return res.status(400).json({ message: 'A valid dueDate is mandatory for each installment' });
      }

      currentNumber += 1;
      totalAmount += amount;

      toInsert.push({
        workspaceId: req.workspaceId || lead.workspaceId,
        leadId: lead._id,
        installmentNumber: item.installmentNumber || currentNumber,
        title: item.title || `Installment #${currentNumber}`,
        amount,
        dueDate: new Date(item.dueDate),
        gracePeriodDays: Number(item.gracePeriodDays) || 0,
        notes: item.notes ? String(item.notes).trim() : '',
        createdBy: req.user._id,
        status: 'pending',
      });
    }

    const createdDocs = await FeeInstallment.insertMany(toInsert);

    // Record activity audit on lead
    lead.leadActivities.push({
      action: 'fee_installment_scheduled',
      performedBy: req.user._id,
      performerName: req.user.name || 'Agent',
      details: `Scheduled ${createdDocs.length} installment(s) totaling ₹${totalAmount.toLocaleString('en-IN')}`,
      timestamp: new Date(),
    });

    await lead.save();

    res.status(201).json({
      success: true,
      message: `Successfully scheduled ${createdDocs.length} installment(s)`,
      count: createdDocs.length,
      totalAmount,
      installments: createdDocs,
    });
  } catch (error) {
    console.error('createLeadInstallments error:', error);
    res.status(500).json({ message: 'Server error scheduling installments' });
  }
};

/**
 * @desc  Record a payment against a specific fee installment and link to Payment model
 * @route POST /api/leads/:id/installments/:installmentId/pay
 * @access Private
 */
exports.recordInstallmentPayment = async (req, res) => {
  try {
    const { id, installmentId } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id) || !installmentId || !mongoose.Types.ObjectId.isValid(installmentId)) {
      return res.status(400).json({ message: 'Invalid lead ID or installment ID format' });
    }

    const permissionQuery = await buildLeadPermissionQuery(req.user, false);
    const lead = await Lead.findOne({ _id: id, ...permissionQuery });

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found or unauthorized' });
    }

    const wsId = req.workspaceId || lead.workspaceId;
    const installment = await FeeInstallment.findOne({
      _id: installmentId,
      leadId: lead._id,
      ...(wsId ? { workspaceId: wsId } : {}),
    });

    if (!installment) {
      return res.status(404).json({ message: 'Installment not found for this lead' });
    }

    if (installment.status === 'paid') {
      return res.status(400).json({ message: 'Installment is already fully paid' });
    }

    const remainingDue = Math.max(0, installment.amount - (installment.paidAmount || 0));
    const payAmount = req.body.amount !== undefined ? Number(req.body.amount) : remainingDue;

    if (isNaN(payAmount) || payAmount <= 0) {
      return res.status(400).json({ message: 'Payment amount must be greater than zero' });
    }

    const idempotencyKey = req.body.idempotencyKey || req.headers?.['idempotency-key'];
    if (idempotencyKey) {
      const existingPayment = await Payment.findOne({
        lead_id: lead._id,
        idempotencyKey: String(idempotencyKey).trim(),
        ...(wsId ? { $or: [{ workspaceId: wsId }, { companyId: wsId }] } : {}),
      });
      if (existingPayment) {
        const currentInst = await FeeInstallment.findById(installmentId);
        return res.status(200).json({
          success: true,
          message: 'Payment recorded against installment (idempotent)',
          idempotent: true,
          installment: currentInst || installment,
          payment: existingPayment,
        });
      }
    }

    let result = null;

    await withTransaction(async (session) => {
      let paymentDoc = null;

      if (req.body.paymentId && mongoose.Types.ObjectId.isValid(req.body.paymentId)) {
        const query = {
          _id: req.body.paymentId,
          ...(wsId ? { $or: [{ workspaceId: wsId }, { companyId: wsId }] } : {}),
        };
        paymentDoc = session ? await Payment.findOne(query).session(session) : await Payment.findOne(query);
        if (!paymentDoc) {
          const err = new Error('Referenced payment document not found');
          err.status = 404;
          throw err;
        }
      } else {
        const paymentData = {
          lead_id: lead._id,
          leadId: lead._id,
          agent_id: req.user._id,
          agentId: req.user._id,
          workspaceId: wsId,
          companyId: wsId,
          amount: payAmount,
          method: req.body.paymentMethod || req.body.method || 'bank_transfer',
          transaction_id: req.body.transactionId || req.body.transaction_id || `INST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          transactionId: req.body.transactionId || req.body.transaction_id || `INST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          receipt_url: req.body.receiptUrl || '',
          verified_by_agent: true,
          verifiedByAgent: true,
          verified_at: new Date(),
          verifiedAt: new Date(),
          status: 'completed',
          idempotencyKey: idempotencyKey ? String(idempotencyKey).trim() : null,
        };

        if (session) {
          const [created] = await Payment.create([paymentData], { session });
          paymentDoc = created;
        } else {
          paymentDoc = await Payment.create(paymentData);
        }
      }

      // Atomic update of installment with pipeline update to prevent read-modify-write lost updates
      const updatedInstallment = await FeeInstallment.findOneAndUpdate(
        {
          _id: installmentId,
          leadId: lead._id,
          ...(wsId ? { workspaceId: wsId } : {}),
          status: { $ne: 'paid' },
        },
        [
          {
            $set: {
              paidAmount: { $add: [{ $ifNull: ['$paidAmount', 0] }, payAmount] },
              paidAt: new Date(),
              paymentId: paymentDoc._id,
              status: {
                $cond: [
                  {
                    $or: [
                      { $gte: [{ $add: [{ $ifNull: ['$paidAmount', 0] }, payAmount] }, '$amount'] },
                      Boolean(req.body.markFullyPaid),
                    ],
                  },
                  'paid',
                  'partially_paid',
                ],
              },
              notes: req.body.notes
                ? {
                    $cond: [
                      {
                        $and: [
                          { $ne: ['$notes', null] },
                          { $ne: ['$notes', ''] },
                        ],
                      },
                      { $concat: ['$notes', ' | ', String(req.body.notes).trim()] },
                      String(req.body.notes).trim(),
                    ],
                  }
                : '$notes',
            },
          },
        ],
        { new: true, session: session || null }
      );

      if (!updatedInstallment) {
        const err = new Error('Installment is already fully paid');
        err.status = 400;
        throw err;
      }

      // Atomically append activity log to lead without whole-document replace
      const activityData = {
        action: 'installment_paid',
        performedBy: req.user._id,
        performerName: req.user.name || 'Agent',
        details: `Received ₹${payAmount.toLocaleString('en-IN')} for Installment #${updatedInstallment.installmentNumber} (${updatedInstallment.title}). Status: ${updatedInstallment.status}`,
        timestamp: new Date(),
      };

      const leadUpdateOptions = session ? { session } : {};
      await Lead.updateOne(
        { _id: lead._id },
        { $push: { leadActivities: activityData } },
        leadUpdateOptions
      );

      result = {
        installment: updatedInstallment,
        payment: paymentDoc,
      };
    });

    return res.json({
      success: true,
      message: `Recorded payment of ₹${payAmount.toLocaleString('en-IN')}`,
      installment: result.installment,
      payment: result.payment,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error('recordInstallmentPayment error:', error);
    return res.status(500).json({ message: error.message || 'Server error recording installment payment' });
  }
};

