const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const Project = require('../models/Project');
const FollowUp = require('../models/FollowUp');
const Requirement = require('../models/Requirement');
const Opportunity = require('../models/Opportunity');
const Inventory = require('../models/Inventory');
const EOI = require('../models/EOI');
const Booking = require('../models/Booking');
const PaymentSchedule = require('../models/PaymentSchedule');
const Pipeline = require('../models/Pipeline');
const { auditService } = require('../monitoring/audit/auditService');

// Helper to resolve canonical tenant ID
const getTenantId = (user) => {
  if (!user) return null;
  if (user.companyId) return user.companyId;
  return user._id;
};

// ─────────────────────────────────────────────────────────────
// 1. LEAD SCORING & TEMPERATURE ENGINE
// ─────────────────────────────────────────────────────────────
const calculateLeadScoreInternal = async (leadId, companyId) => {
  const leadQuery = { _id: leadId };
  if (companyId) {
    leadQuery.$or = [{ companyId }, { userId: companyId }];
  }
  const lead = await Lead.findOne(leadQuery);
  if (!lead) return null;

  const tenantId = lead.companyId || companyId;
  const tenantFilter = tenantId ? { $or: [{ companyId: tenantId }, { userId: tenantId }, { companyId: null }] } : {};

  let score = 0;
  const breakdown = [];

  // Factor 1: Budget Provided (+10)
  if (lead.budget || lead.budgetMin || lead.budgetMax) {
    score += 10;
    breakdown.push({ factor: 'Budget Provided', points: 10 });
  }

  // Factor 2: Preferred Location / Areas of Interest (+10)
  if (lead.location || (lead.areasOfInterest && lead.areasOfInterest.length > 0)) {
    score += 10;
    breakdown.push({ factor: 'Preferred Location Provided', points: 10 });
  }

  // Factor 3: Requirement Captured (+10)
  const reqCount = await Requirement.countDocuments({ leadId, status: 'ACTIVE', ...tenantFilter });
  if (reqCount > 0) {
    score += 10;
    breakdown.push({ factor: 'Active Requirement Captured', points: 10 });
  }

  // Factor 4: Site Visit Scheduled (+20) or Completed (+30)
  const siteVisits = await FollowUp.find({
    $or: [{ lead_id: leadId }, { leadId }],
    type: 'site_visit',
    ...tenantFilter,
  }).lean();

  const hasCompletedVisit = siteVisits.some((v) => v.status === 'done' || v.status === 'completed');
  const hasScheduledVisit = siteVisits.length > 0 || Boolean(lead.siteVisitDate);

  if (hasCompletedVisit) {
    score += 30;
    breakdown.push({ factor: 'Site Visit Completed', points: 30 });
  } else if (hasScheduledVisit) {
    score += 20;
    breakdown.push({ factor: 'Site Visit Scheduled', points: 20 });
  }

  // Factor 5: EOI Submitted (+40)
  const eoiCount = await EOI.countDocuments({
    leadId,
    status: { $in: ['SUBMITTED', 'CONFIRMED', 'CONVERTED_TO_BOOKING'] },
    ...tenantFilter,
  });
  if (eoiCount > 0) {
    score += 40;
    breakdown.push({ factor: 'EOI Submitted', points: 40 });
  }

  // Factor 6: Booking Confirmed (+50)
  const bookingCount = await Booking.countDocuments({
    leadId,
    status: { $ne: 'CANCELLED' },
    ...tenantFilter,
  });
  if (bookingCount > 0) {
    score += 50;
    breakdown.push({ factor: 'Booking Confirmed', points: 50 });
  }

  // Factor 7: Negative Signal - Lost or Inactive (-25)
  if (lead.status === 'deal_lost' || lead.status === 'Lost' || lead.lostReason) {
    score -= 25;
    breakdown.push({ factor: 'Deal Lost / Inactive', points: -25 });
  }

  // Bound score between 0 and 100
  score = Math.max(0, Math.min(100, score));

  // Determine temperature
  let temperature = 'WARM';
  if (score >= 60) {
    temperature = 'HOT';
  } else if (score < 30) {
    temperature = 'COLD';
  }

  // Update lead
  lead.score = score;
  lead.temperature = temperature;
  lead.scoringBreakdown = breakdown;
  await lead.save();

  return { score, temperature, breakdown };
};

const scoreLead = async (req, res) => {
  try {
    const companyId = getTenantId(req.user);
    const { id } = req.params;

    const result = await calculateLeadScoreInternal(id, companyId);
    if (!result) {
      return res.status(404).json({ message: 'Lead not found or inaccessible' });
    }

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to score lead', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// 2. DETERMINISTIC PROPERTY MATCHING ENGINE
// ─────────────────────────────────────────────────────────────
const matchProperties = async (req, res) => {
  try {
    const companyId = getTenantId(req.user);
    const { leadId, requirementId, budgetMin, budgetMax, location, configurations, propertyType } = req.body;

    let targetBudgetMin = budgetMin ? Number(budgetMin) : 0;
    let targetBudgetMax = budgetMax ? Number(budgetMax) : Infinity;
    let targetLocation = location ? String(location).trim().toLowerCase() : '';
    let targetConfigs = Array.isArray(configurations) ? configurations.map((c) => String(c).trim().toUpperCase()) : [];
    let targetPropertyType = propertyType ? String(propertyType).trim() : '';

    // If requirementId is provided, pull from Requirement
    if (requirementId) {
      const reqDoc = await Requirement.findOne({ _id: requirementId, companyId });
      if (reqDoc) {
        if (reqDoc.budgetMin) targetBudgetMin = reqDoc.budgetMin;
        if (reqDoc.budgetMax) targetBudgetMax = reqDoc.budgetMax;
        if (reqDoc.preferredLocations && reqDoc.preferredLocations.length) {
          targetLocation = reqDoc.preferredLocations.join(' ').toLowerCase();
        }
        if (reqDoc.configurations && reqDoc.configurations.length) {
          targetConfigs = reqDoc.configurations.map((c) => String(c).trim().toUpperCase());
        }
        if (reqDoc.propertyType) targetPropertyType = reqDoc.propertyType;
      }
    } else if (leadId) {
      const lead = await Lead.findOne({ _id: leadId, companyId });
      if (lead) {
        if (lead.budgetMin) targetBudgetMin = lead.budgetMin;
        if (lead.budgetMax) targetBudgetMax = lead.budgetMax;
        if (lead.location) targetLocation = lead.location.toLowerCase();
        if (lead.preferredConfigurations && lead.preferredConfigurations.length) {
          targetConfigs = lead.preferredConfigurations.map((c) => String(c).trim().toUpperCase());
        }
        if (lead.propertyType) targetPropertyType = lead.propertyType;
      }
    }

    // Find all active projects for the tenant
    const projects = await Project.find({
      $or: [{ companyId }, { userId: companyId }, { userId: req.user._id }],
      isActive: true,
    }).lean();

    const matches = [];

    for (const project of projects) {
      let matchScore = 0;
      const matchedFactors = [];

      const projMinPrice = project.minPrice || 0;
      const projMaxPrice = project.maxPrice || (project.minPrice ? project.minPrice * 1.5 : Infinity);
      const projLocation = (project.location || project.city || '').toLowerCase();
      const projConfigs = (project.configuration || project.productCategory || []).map((c) => String(c).trim().toUpperCase());

      // 1. Location Match (+35 pts)
      if (targetLocation && (projLocation.includes(targetLocation) || targetLocation.includes(projLocation))) {
        matchScore += 35;
        matchedFactors.push('Location Match');
      } else if (!targetLocation) {
        matchScore += 15;
      }

      // 2. Budget Overlap (+35 pts)
      if (targetBudgetMax < Infinity && targetBudgetMin > 0) {
        const isOverlap = projMinPrice <= targetBudgetMax && (projMaxPrice >= targetBudgetMin || projMaxPrice === 0);
        if (isOverlap) {
          matchScore += 35;
          matchedFactors.push('Budget Overlap');
        }
      } else {
        matchScore += 15;
      }

      // 3. Configuration / BHK Match (+30 pts)
      let configMatch = false;
      if (targetConfigs.length > 0) {
        const commonConfigs = targetConfigs.filter((c) => projConfigs.some((pc) => pc.includes(c) || c.includes(pc)));
        if (commonConfigs.length > 0) {
          configMatch = true;
          matchScore += 30;
          matchedFactors.push(`Configuration (${commonConfigs.join(', ')})`);
        }
      } else {
        matchScore += 10;
      }

      // Find available inventory count for this project
      const availableInventoryCount = await Inventory.countDocuments({
        companyId,
        projectId: project._id,
        status: 'AVAILABLE',
      });

      if (matchScore >= 40) {
        matches.push({
          project: {
            _id: project._id,
            name: project.name,
            developer: project.developer || project.vendorOrBrand,
            location: project.location,
            city: project.city,
            basePrice: project.basePrice,
            minPrice: project.minPrice,
            maxPrice: project.maxPrice,
            configurations: project.configuration || [],
            usps: project.usps || [],
            brochureUrl: project.brochureUrl,
            images: project.images || [],
          },
          matchScore,
          matchedFactors,
          availableInventoryCount,
        });
      }
    }

    // Sort by highest match score
    matches.sort((a, b) => b.matchScore - a.matchScore);

    return res.status(200).json({
      success: true,
      count: matches.length,
      data: matches,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Property matching failed', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// 3. REQUIREMENTS CRUD
// ─────────────────────────────────────────────────────────────
const getRequirements = async (req, res) => {
  try {
    const companyId = getTenantId(req.user);
    const { leadId, status } = req.query;

    const query = { companyId };
    if (leadId) query.leadId = leadId;
    if (status) query.status = status;

    const requirements = await Requirement.find(query)
      .populate('leadId', 'name phone email status temperature score')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ success: true, count: requirements.length, data: requirements });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch requirements', error: error.message });
  }
};

const createRequirement = async (req, res) => {
  try {
    const companyId = getTenantId(req.user);
    const { leadId, title, propertyType, configurations, preferredLocations, budgetMin, budgetMax, areaMin, areaMax, purpose, possessionPreference, furnishing, financingRequired, timeline, notes } = req.body;

    if (!leadId) {
      return res.status(400).json({ message: 'Lead ID is required' });
    }

    // Validate Lead belongs to same tenant
    const lead = await Lead.findOne({ _id: leadId, companyId });
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found in this organization' });
    }

    const requirement = await Requirement.create({
      companyId,
      leadId,
      createdBy: req.user._id,
      title: title || `${propertyType || 'Property'} Requirement`,
      propertyType: propertyType || 'Apartment',
      configurations: Array.isArray(configurations) ? configurations : (configurations ? [configurations] : []),
      preferredLocations: Array.isArray(preferredLocations) ? preferredLocations : (preferredLocations ? [preferredLocations] : []),
      budgetMin: Number(budgetMin) || 0,
      budgetMax: Number(budgetMax) || 0,
      areaMin: Number(areaMin) || 0,
      areaMax: Number(areaMax) || 0,
      purpose: purpose || 'End Use',
      possessionPreference: possessionPreference || 'Ready to Move',
      furnishing: furnishing || 'Any',
      financingRequired: Boolean(financingRequired),
      timeline: timeline || 'Immediate (15-30 days)',
      notes: notes || '',
    });

    // Auto-recalculate lead score
    await calculateLeadScoreInternal(leadId, companyId);

    return res.status(201).json({ success: true, data: requirement });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create requirement', error: error.message });
  }
};

const updateRequirement = async (req, res) => {
  try {
    const companyId = getTenantId(req.user);
    const { id } = req.params;

    const requirement = await Requirement.findOneAndUpdate(
      { _id: id, companyId },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!requirement) {
      return res.status(404).json({ message: 'Requirement not found' });
    }

    await calculateLeadScoreInternal(requirement.leadId, companyId);

    return res.status(200).json({ success: true, data: requirement });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update requirement', error: error.message });
  }
};

const deleteRequirement = async (req, res) => {
  try {
    const companyId = getTenantId(req.user);
    const { id } = req.params;

    const requirement = await Requirement.findOneAndDelete({ _id: id, companyId });
    if (!requirement) {
      return res.status(404).json({ message: 'Requirement not found' });
    }

    await calculateLeadScoreInternal(requirement.leadId, companyId);

    return res.status(200).json({ success: true, message: 'Requirement deleted' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete requirement', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// 4. OPPORTUNITIES / DEALS CRUD
// ─────────────────────────────────────────────────────────────
const getOpportunities = async (req, res) => {
  try {
    const companyId = getTenantId(req.user);
    const { leadId, projectId, status, stage, assignedTo } = req.query;

    const query = { companyId };
    if (leadId) query.leadId = leadId;
    if (projectId) query.projectId = projectId;
    if (status) query.status = status;
    if (stage) query.stage = stage;
    if (assignedTo) query.assignedTo = assignedTo;

    const opportunities = await Opportunity.find(query)
      .populate('leadId', 'name phone email status temperature score')
      .populate('projectId', 'name location developer basePrice minPrice maxPrice')
      .populate('inventoryId', 'unitNumber tower floor configuration status totalPrice')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ success: true, count: opportunities.length, data: opportunities });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch opportunities', error: error.message });
  }
};

const createOpportunity = async (req, res) => {
  try {
    const companyId = getTenantId(req.user);
    const { leadId, requirementId, projectId, inventoryId, title, pipelineId, stage, expectedValue, probability, assignedTo, expectedClosingDate, notes } = req.body;

    if (!leadId || !projectId) {
      return res.status(400).json({ message: 'Lead ID and Project ID are mandatory' });
    }

    // Cross-tenant validation
    const [lead, project] = await Promise.all([
      Lead.findOne({ _id: leadId, companyId }),
      Project.findOne({ _id: projectId, $or: [{ companyId }, { userId: companyId }, { userId: req.user._id }] }),
    ]);

    if (!lead) return res.status(404).json({ message: 'Lead not found in this organization' });
    if (!project) return res.status(404).json({ message: 'Project not found in this organization' });

    const opportunity = await Opportunity.create({
      companyId,
      leadId,
      requirementId: requirementId || null,
      projectId,
      inventoryId: inventoryId || null,
      title: title || `${lead.name} - ${project.name}`,
      pipelineId: pipelineId || null,
      stage: stage || 'Site Visit Scheduled',
      expectedValue: Number(expectedValue) || project.minPrice || 0,
      probability: Number(probability) !== undefined ? Number(probability) : 50,
      assignedTo: assignedTo || lead.assignedTo || req.user._id,
      expectedClosingDate: expectedClosingDate ? new Date(expectedClosingDate) : null,
      notes: notes || '',
      stageHistory: [{
        fromStage: 'Initial Creation',
        toStage: stage || 'Site Visit Scheduled',
        movedAt: new Date(),
        movedBy: req.user._id,
      }],
    });

    await calculateLeadScoreInternal(leadId, companyId);

    return res.status(201).json({ success: true, data: opportunity });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create opportunity', error: error.message });
  }
};

const updateOpportunityStage = async (req, res) => {
  try {
    const companyId = getTenantId(req.user);
    const { id } = req.params;
    const { stage, probability, remark } = req.body;

    if (!stage) {
      return res.status(400).json({ message: 'Target stage is required' });
    }

    const opportunity = await Opportunity.findOne({ _id: id, companyId });
    if (!opportunity) {
      return res.status(404).json({ message: 'Opportunity not found' });
    }

    const previousStage = opportunity.stage;
    opportunity.stage = stage;

    // Stage Probability Mapping
    if (probability !== undefined) {
      opportunity.probability = Number(probability);
    } else {
      const stageProbabilities = {
        'New Inquiry': 10,
        'Contacted': 20,
        'Requirement Qualified': 30,
        'Property Shared': 40,
        'Site Visit Scheduled': 50,
        'Site Visit Completed': 70,
        'Negotiation': 80,
        'EOI Submitted': 90,
        'Booking Confirmed': 100,
        'Closed Won': 100,
        'Closed Lost': 0,
      };
      if (stageProbabilities[stage] !== undefined) {
        opportunity.probability = stageProbabilities[stage];
      }
    }

    if (stage === 'Booking Confirmed' || stage === 'Closed Won') {
      opportunity.status = 'WON';
    } else if (stage === 'Closed Lost') {
      opportunity.status = 'LOST';
      opportunity.lostReason = req.body.lostReason || 'Other';
      opportunity.lostRemarks = remark || '';
    } else {
      opportunity.status = 'OPEN';
    }

    opportunity.stageHistory.push({
      fromStage: previousStage,
      toStage: stage,
      movedAt: new Date(),
      movedBy: req.user._id,
      remark: remark || '',
    });

    await opportunity.save();
    await calculateLeadScoreInternal(opportunity.leadId, companyId);

    return res.status(200).json({ success: true, data: opportunity });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update opportunity stage', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// 5. INVENTORY MANAGEMENT & CONCURRENCY
// ─────────────────────────────────────────────────────────────
const getInventory = async (req, res) => {
  try {
    const companyId = getTenantId(req.user);
    const { projectId, tower, configuration, status } = req.query;

    const query = { companyId };
    if (projectId) query.projectId = projectId;
    if (tower) query.tower = tower;
    if (configuration) query.configuration = configuration;
    if (status) query.status = status;

    const inventory = await Inventory.find(query)
      .populate('projectId', 'name location developer')
      .populate('bookedByLeadId', 'name phone')
      .sort({ tower: 1, floor: 1, unitNumber: 1 })
      .lean();

    return res.status(200).json({ success: true, count: inventory.length, data: inventory });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch inventory', error: error.message });
  }
};

const createInventory = async (req, res) => {
  try {
    const companyId = getTenantId(req.user);
    const { projectId, tower, floor, unitNumber, configuration, facing, carpetArea, builtUpArea, superArea, basePrice, additionalCharges, totalPrice, notes } = req.body;

    if (!projectId || !unitNumber) {
      return res.status(400).json({ message: 'Project ID and Unit Number are mandatory' });
    }

    // Cross-tenant validation
    const project = await Project.findOne({
      _id: projectId,
      $or: [{ companyId }, { userId: companyId }, { userId: req.user._id }],
    });
    if (!project) return res.status(404).json({ message: 'Project not found in this organization' });

    const calculatedTotal = totalPrice || (Number(basePrice || 0) + Number(additionalCharges || 0));

    const unit = await Inventory.create({
      companyId,
      projectId,
      tower: tower || 'Tower A',
      floor: Number(floor) || 1,
      unitNumber: String(unitNumber).trim(),
      configuration: configuration || '3BHK',
      facing: facing || 'East',
      carpetArea: Number(carpetArea) || 0,
      builtUpArea: Number(builtUpArea) || 0,
      superArea: Number(superArea) || 0,
      basePrice: Number(basePrice) || 0,
      additionalCharges: Number(additionalCharges) || 0,
      totalPrice: Number(calculatedTotal) || 0,
      status: 'AVAILABLE',
      notes: notes || '',
    });

    // Update project unit counters
    const [totalUnits, availableUnits] = await Promise.all([
      Inventory.countDocuments({ companyId, projectId }),
      Inventory.countDocuments({ companyId, projectId, status: 'AVAILABLE' }),
    ]);

    await Project.updateOne({ _id: projectId }, { $set: { totalUnits, availableUnits } });

    return res.status(201).json({ success: true, data: unit });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Unit with this Number and Tower already exists in this project.' });
    }
    return res.status(500).json({ message: 'Failed to create inventory unit', error: error.message });
  }
};

const updateInventoryStatus = async (req, res) => {
  try {
    const companyId = getTenantId(req.user);
    const { id } = req.params;
    const { status, holdExpiresInMinutes, leadId } = req.body;

    const allowedStatuses = ['AVAILABLE', 'HOLD', 'BLOCKED', 'BOOKED', 'SOLD'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Must be one of ${allowedStatuses.join(', ')}` });
    }

    const updateDoc = { status };
    if (status === 'HOLD') {
      const minutes = Number(holdExpiresInMinutes) || 1440; // Default 24 hours
      updateDoc.holdExpiresAt = new Date(Date.now() + minutes * 60 * 1000);
      if (leadId) updateDoc.holdByLeadId = leadId;
    } else if (status === 'AVAILABLE') {
      updateDoc.holdExpiresAt = null;
      updateDoc.holdByLeadId = null;
      updateDoc.bookedByLeadId = null;
    }

    const unit = await Inventory.findOneAndUpdate(
      { _id: id, companyId },
      { $set: updateDoc },
      { new: true }
    );

    if (!unit) {
      return res.status(404).json({ message: 'Inventory unit not found' });
    }

    // Refresh Project availableUnits counter
    const availableUnits = await Inventory.countDocuments({ companyId, projectId: unit.projectId, status: 'AVAILABLE' });
    await Project.updateOne({ _id: unit.projectId }, { $set: { availableUnits } });

    return res.status(200).json({ success: true, data: unit });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update inventory status', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// 6. EOI (EXPRESSION OF INTEREST) LIFECYCLE
// ─────────────────────────────────────────────────────────────
const getEOIs = async (req, res) => {
  try {
    const companyId = getTenantId(req.user);
    const { leadId, projectId, status } = req.query;

    const query = { companyId };
    if (leadId) query.leadId = leadId;
    if (projectId) query.projectId = projectId;
    if (status) query.status = status;

    const eois = await EOI.find(query)
      .populate('leadId', 'name phone email')
      .populate('projectId', 'name location developer')
      .populate('inventoryId', 'unitNumber tower configuration totalPrice')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ success: true, count: eois.length, data: eois });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch EOIs', error: error.message });
  }
};

const createEOI = async (req, res) => {
  try {
    const companyId = getTenantId(req.user);
    const { leadId, opportunityId, projectId, inventoryId, tokenAmount, paymentMode, paymentReference, notes } = req.body;

    if (!leadId || !projectId || !tokenAmount) {
      return res.status(400).json({ message: 'Lead ID, Project ID, and Token Amount are required' });
    }

    // Cross-tenant validation
    const [lead, project] = await Promise.all([
      Lead.findOne({ _id: leadId, companyId }),
      Project.findOne({ _id: projectId, $or: [{ companyId }, { userId: companyId }, { userId: req.user._id }] }),
    ]);

    if (!lead) return res.status(404).json({ message: 'Lead not found in this organization' });
    if (!project) return res.status(404).json({ message: 'Project not found in this organization' });

    // If specific inventory unit requested, atomically place on HOLD
    if (inventoryId) {
      const holdUpdated = await Inventory.findOneAndUpdate(
        { _id: inventoryId, companyId, status: 'AVAILABLE' },
        {
          $set: {
            status: 'HOLD',
            holdExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48h hold
            holdByLeadId: leadId,
          },
        },
        { new: true }
      );

      if (!holdUpdated) {
        return res.status(409).json({ message: 'Selected inventory unit is not currently AVAILABLE for EOI hold.' });
      }
    }

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const eoiNumber = `EOI-${Date.now().toString().slice(-6)}-${randomSuffix}`;

    const eoi = await EOI.create({
      companyId,
      leadId,
      opportunityId: opportunityId || null,
      projectId,
      inventoryId: inventoryId || null,
      eoiNumber,
      tokenAmount: Number(tokenAmount),
      paymentStatus: paymentReference ? 'PAID' : 'PENDING',
      paymentReference: paymentReference || '',
      paymentMode: paymentMode || 'UPI',
      status: 'SUBMITTED',
      submittedAt: new Date(),
      notes: notes || '',
      createdBy: req.user._id,
    });

    // Recalculate lead score & temperature
    await calculateLeadScoreInternal(leadId, companyId);

    return res.status(201).json({ success: true, data: eoi });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create EOI', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// 7. BOOKING & PAYMENT SCHEDULE (TRANSACTION-SAFE)
// ─────────────────────────────────────────────────────────────
const getBookings = async (req, res) => {
  try {
    const companyId = getTenantId(req.user);
    const { leadId, projectId, status } = req.query;

    const query = { companyId };
    if (leadId) query.leadId = leadId;
    if (projectId) query.projectId = projectId;
    if (status) query.status = status;

    const bookings = await Booking.find(query)
      .populate('leadId', 'name phone email')
      .populate('projectId', 'name location developer')
      .populate('inventoryId', 'unitNumber tower floor configuration totalPrice')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ success: true, count: bookings.length, data: bookings });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch bookings', error: error.message });
  }
};

const createBooking = async (req, res) => {
  try {
    const companyId = getTenantId(req.user);
    const { leadId, opportunityId, projectId, inventoryId, eoiId, bookingAmount, agreementValue, paymentPlan, notes } = req.body;

    if (!leadId || !projectId || !inventoryId || !bookingAmount || !agreementValue) {
      return res.status(400).json({ message: 'Lead, Project, Inventory, Booking Amount, and Agreement Value are mandatory.' });
    }

    // Atomic unit reservation lock: Unit must be AVAILABLE or on HOLD for this same lead
    const unit = await Inventory.findOneAndUpdate(
      {
        _id: inventoryId,
        companyId,
        $or: [
          { status: 'AVAILABLE' },
          { status: 'HOLD', holdByLeadId: leadId },
        ],
      },
      {
        $set: {
          status: 'BOOKED',
          bookedByLeadId: leadId,
          holdExpiresAt: null,
        },
      },
      { new: true }
    );

    if (!unit) {
      return res.status(409).json({
        code: 'INVENTORY_UNAVAILABLE',
        message: 'This inventory unit is no longer available for booking. It may have been booked or held by another agent.',
      });
    }

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const bookingNumber = `BK-${Date.now().toString().slice(-6)}-${randomSuffix}`;

    const numBookingAmount = Number(bookingAmount);
    const numAgreementValue = Number(agreementValue);

    const booking = await Booking.create({
      companyId,
      leadId,
      opportunityId: opportunityId || null,
      projectId,
      inventoryId,
      eoiId: eoiId || null,
      bookingNumber,
      bookingAmount: numBookingAmount,
      agreementValue: numAgreementValue,
      paymentPlan: paymentPlan || 'CLP',
      totalPaid: numBookingAmount,
      status: 'CONFIRMED',
      createdBy: req.user._id,
      notes: notes || '',
    });

    // Auto-create milestone Payment Schedule (Default CLP breakdown)
    const now = new Date();
    const milestones = [
      { name: 'Booking Token', percentage: 10, days: 0, status: 'PAID', paid: numBookingAmount },
      { name: 'Agreement Signing', percentage: 10, days: 30, status: 'UPCOMING', paid: 0 },
      { name: 'Foundation Completion', percentage: 20, days: 90, status: 'UPCOMING', paid: 0 },
      { name: 'Structure Completion', percentage: 30, days: 180, status: 'UPCOMING', paid: 0 },
      { name: 'Finishing & Plaster', percentage: 20, days: 270, status: 'UPCOMING', paid: 0 },
      { name: 'Offer of Possession', percentage: 10, days: 365, status: 'UPCOMING', paid: 0 },
    ];

    const scheduleDocs = milestones.map((m) => {
      const milestoneAmount = (numAgreementValue * m.percentage) / 100;
      const dueDate = new Date(now.getTime() + m.days * 24 * 60 * 60 * 1000);
      return {
        companyId,
        bookingId: booking._id,
        milestoneName: m.name,
        dueDate,
        percentage: m.percentage,
        amount: milestoneAmount,
        paidAmount: m.paid,
        paidDate: m.status === 'PAID' ? now : null,
        status: m.status,
      };
    });

    await PaymentSchedule.insertMany(scheduleDocs);

    // If linked to EOI, mark EOI as converted
    if (eoiId) {
      await EOI.updateOne(
        { _id: eoiId, companyId },
        { $set: { status: 'CONVERTED_TO_BOOKING', convertedBookingId: booking._id } }
      );
    }

    // If linked to Opportunity, mark Won
    if (opportunityId) {
      await Opportunity.updateOne(
        { _id: opportunityId, companyId },
        {
          $set: {
            stage: 'Booking Confirmed',
            status: 'WON',
            probability: 100,
          },
          $push: {
            stageHistory: {
              fromStage: 'Negotiation',
              toStage: 'Booking Confirmed',
              movedAt: new Date(),
              movedBy: req.user._id,
              remark: `Booking created: ${bookingNumber}`,
            },
          },
        }
      );
    }

    // Update Lead status and recalculate score
    await Lead.updateOne(
      { _id: leadId, companyId },
      {
        $set: {
          status: 'deal_won',
          closedDealAmount: numAgreementValue,
        },
      }
    );
    await calculateLeadScoreInternal(leadId, companyId);

    // Refresh Project counters
    const availableUnits = await Inventory.countDocuments({ companyId, projectId, status: 'AVAILABLE' });
    await Project.updateOne({ _id: projectId }, { $set: { availableUnits } });

    return res.status(201).json({ success: true, data: booking });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create booking', error: error.message });
  }
};

const getBookingPaymentSchedule = async (req, res) => {
  try {
    const companyId = getTenantId(req.user);
    const { id } = req.params;

    const schedules = await PaymentSchedule.find({ bookingId: id, companyId })
      .sort({ dueDate: 1 })
      .lean();

    return res.status(200).json({ success: true, count: schedules.length, data: schedules });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch payment schedule', error: error.message });
  }
};

const recordPaymentReceipt = async (req, res) => {
  try {
    const companyId = getTenantId(req.user);
    const { scheduleId } = req.params;
    const { paidAmount, paymentMode, transactionRef, notes } = req.body;

    const schedule = await PaymentSchedule.findOne({ _id: scheduleId, companyId });
    if (!schedule) {
      return res.status(404).json({ message: 'Payment schedule milestone not found' });
    }

    const numPaid = Number(paidAmount);
    if (!numPaid || numPaid <= 0) {
      return res.status(400).json({ message: 'Valid positive paidAmount is required' });
    }

    const newTotalPaid = (schedule.paidAmount || 0) + numPaid;
    const isFullyPaid = newTotalPaid >= schedule.amount;

    schedule.paidAmount = newTotalPaid;
    schedule.paidDate = new Date();
    schedule.paymentMode = paymentMode || 'UPI';
    schedule.transactionRef = transactionRef || '';
    schedule.status = isFullyPaid ? 'PAID' : 'PARTIALLY_PAID';
    if (notes) schedule.notes = notes;
    await schedule.save();

    // Increment booking totalPaid
    await Booking.updateOne(
      { _id: schedule.bookingId, companyId },
      { $inc: { totalPaid: numPaid } }
    );

    return res.status(200).json({ success: true, data: schedule });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to record payment', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// 8. REAL ESTATE ANALYTICS SUMMARY
// ─────────────────────────────────────────────────────────────
const getRealEstateAnalytics = async (req, res) => {
  try {
    const companyId = getTenantId(req.user);

    const [
      totalLeads,
      hotLeads,
      warmLeads,
      coldLeads,
      activeRequirements,
      opportunities,
      totalEOIs,
      confirmedBookings,
      inventoryStats,
      siteVisits,
    ] = await Promise.all([
      Lead.countDocuments({ companyId, deletedAt: null }),
      Lead.countDocuments({ companyId, deletedAt: null, temperature: 'HOT' }),
      Lead.countDocuments({ companyId, deletedAt: null, temperature: 'WARM' }),
      Lead.countDocuments({ companyId, deletedAt: null, temperature: 'COLD' }),
      Requirement.countDocuments({ companyId, status: 'ACTIVE' }),
      Opportunity.find({ companyId, status: 'OPEN' }).select('expectedValue probability stage').lean(),
      EOI.countDocuments({ companyId, status: { $in: ['SUBMITTED', 'CONFIRMED'] } }),
      Booking.find({ companyId, status: { $ne: 'CANCELLED' } }).select('agreementValue bookingAmount totalPaid').lean(),
      Inventory.aggregate([
        { $match: { companyId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      FollowUp.find({ companyId, type: 'site_visit' }).select('status siteVisitDetails').lean(),
    ]);

    // Pipeline Calculations
    let totalPipelineValue = 0;
    let weightedPipelineValue = 0;
    const stageBreakdown = {};

    for (const opp of opportunities) {
      const val = opp.expectedValue || 0;
      const prob = opp.probability || 0;
      totalPipelineValue += val;
      weightedPipelineValue += (val * prob) / 100;

      const stg = opp.stage || 'Unassigned';
      stageBreakdown[stg] = (stageBreakdown[stg] || 0) + 1;
    }

    // Revenue Calculations
    let totalAgreementValue = 0;
    let totalCollectedAmount = 0;
    for (const bk of confirmedBookings) {
      totalAgreementValue += bk.agreementValue || 0;
      totalCollectedAmount += bk.totalPaid || 0;
    }

    // Site Visit Conversion
    const totalSiteVisits = siteVisits.length;
    const completedSiteVisits = siteVisits.filter((s) => s.status === 'done' || s.status === 'completed').length;
    const siteVisitConversionRate = totalSiteVisits > 0 ? ((completedSiteVisits / totalSiteVisits) * 100).toFixed(1) : 0;

    // Inventory status map
    const inventorySummary = {
      available: 0,
      hold: 0,
      booked: 0,
      sold: 0,
      blocked: 0,
    };
    for (const item of inventoryStats) {
      const key = (item._id || '').toLowerCase();
      if (inventorySummary[key] !== undefined) {
        inventorySummary[key] = item.count;
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        leads: {
          total: totalLeads,
          hot: hotLeads,
          warm: warmLeads,
          cold: coldLeads,
        },
        requirements: {
          active: activeRequirements,
        },
        pipeline: {
          openDeals: opportunities.length,
          totalValue: totalPipelineValue,
          weightedValue: Math.round(weightedPipelineValue),
          stageBreakdown,
        },
        siteVisits: {
          total: totalSiteVisits,
          completed: completedSiteVisits,
          conversionRate: `${siteVisitConversionRate}%`,
        },
        eois: {
          active: totalEOIs,
        },
        bookings: {
          count: confirmedBookings.length,
          totalAgreementValue,
          totalCollectedAmount,
        },
        inventory: inventorySummary,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to generate real estate analytics', error: error.message });
  }
};

module.exports = {
  scoreLead,
  matchProperties,
  getRequirements,
  createRequirement,
  updateRequirement,
  deleteRequirement,
  getOpportunities,
  createOpportunity,
  updateOpportunityStage,
  getInventory,
  createInventory,
  updateInventoryStatus,
  getEOIs,
  createEOI,
  getBookings,
  createBooking,
  getBookingPaymentSchedule,
  recordPaymentReceipt,
  getRealEstateAnalytics,
  calculateLeadScoreInternal,
};
