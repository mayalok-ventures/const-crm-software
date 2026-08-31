const mongoose = require('mongoose');
const User = require('../models/User');
const Lead = require('../models/Lead');
const Project = require('../models/Project');
const FollowUp = require('../models/FollowUp');
const Requirement = require('../models/Requirement');
const Opportunity = require('../models/Opportunity');
const Inventory = require('../models/Inventory');
const EOI = require('../models/EOI');
const Booking = require('../models/Booking');
const PaymentSchedule = require('../models/PaymentSchedule');
const Offer = require('../models/Offer');
const CommissionRule = require('../models/CommissionRule');
const CommissionPayout = require('../models/CommissionPayout');
const Notification = require('../models/Notification');
const ActivityLog = require('../models/ActivityLog');
const { auditService } = require('../monitoring/audit/auditService');

// Helper to resolve canonical tenant ID
const getTenantId = (user) => {
  if (!user) return null;
  if (user.companyId) return user.companyId;
  return user._id;
};

// Canonical team scoping helper
const getManagerTeamUserIds = async (user) => {
  if (!user) return [];
  if (user.role === 'superadmin' || user.role === 'admin' || user.companyRole === 'owner' || user.workStatus === 'company_owner') {
    return null; // Tenant-level scope (all tenant users)
  }
  if (user.role === 'manager' || user.companyRole === 'manager') {
    const tenantId = getTenantId(user);
    const teamAgents = await User.find({
      companyId: tenantId,
      $or: [{ managerId: user._id }, { _id: user._id }],
    }).select('_id').lean();
    return teamAgents.map(a => a._id);
  }
  // Agent scope
  return [user._id];
};

const getLeadIdsForUserScope = async (user, companyId) => {
  const teamUserIds = await getManagerTeamUserIds(user);
  if (teamUserIds === null) return null; // Tenant-level scope

  const leads = await Lead.find({
    $and: [
      { $or: [{ companyId }, { userId: companyId }] },
      {
        $or: [
          { assignedTo: { $in: teamUserIds } },
          { currentOwnerId: { $in: teamUserIds } },
          { assignedManager: user._id },
          { userId: { $in: teamUserIds } },
        ],
      },
    ],
  }).select('_id').lean();
  return leads.map(l => l._id);
};

// ─────────────────────────────────────────────────────────────
// 1. LEAD SCORING & DETERMINISTIC TEMPERATURE ENGINE
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

  // Bound score strictly between 0 and 100
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
    let targetLocations = [];
    let targetConfigs = Array.isArray(configurations) ? configurations.map((c) => String(c).trim().toUpperCase()) : [];
    let targetPropertyType = propertyType ? String(propertyType).trim() : '';

    // If requirementId is provided, pull from Requirement
    if (requirementId) {
      const reqDoc = await Requirement.findOne({ _id: requirementId, companyId });
      if (reqDoc) {
        if (reqDoc.budgetMin) targetBudgetMin = reqDoc.budgetMin;
        if (reqDoc.budgetMax) targetBudgetMax = reqDoc.budgetMax;
        if (reqDoc.preferredLocations && reqDoc.preferredLocations.length) {
          targetLocations = reqDoc.preferredLocations;
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
        if (lead.areasOfInterest && lead.areasOfInterest.length) {
          targetLocations = lead.areasOfInterest;
        }
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
      let locationMatched = false;
      if (targetLocations.length > 0) {
        locationMatched = targetLocations.some((loc) => {
          const l = loc.toLowerCase().trim();
          return l && (projLocation.includes(l) || l.includes(projLocation));
        });
      } else if (targetLocation) {
        locationMatched = projLocation.includes(targetLocation) || targetLocation.includes(projLocation);
      }

      if (locationMatched) {
        matchScore += 35;
        matchedFactors.push('Location Match');
      } else if (!targetLocation && targetLocations.length === 0) {
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
      if (targetConfigs.length > 0) {
        const commonConfigs = targetConfigs.filter((c) => projConfigs.some((pc) => pc.includes(c) || c.includes(pc)));
        if (commonConfigs.length > 0) {
          matchScore += 30;
          matchedFactors.push(`Configuration (${commonConfigs.join(', ')})`);
        }
      } else {
        matchScore += 10;
      }

      // Find available inventory units for this project
      const [availableInventoryCount, matchingUnits] = await Promise.all([
        Inventory.countDocuments({ companyId, projectId: project._id, status: 'AVAILABLE' }),
        Inventory.find({ companyId, projectId: project._id, status: 'AVAILABLE' }).limit(5).lean(),
      ]);

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
          matchingUnits: matchingUnits.map((u) => ({
            _id: u._id,
            unitNumber: u.unitNumber,
            tower: u.tower,
            floor: u.floor,
            configuration: u.configuration,
            totalPrice: u.totalPrice,
            carpetArea: u.carpetArea,
          })),
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

    const scopedLeadIds = await getLeadIdsForUserScope(req.user, companyId);
    if (scopedLeadIds !== null) {
      if (query.leadId) {
        const isAllowed = scopedLeadIds.some(id => String(id) === String(query.leadId));
        if (!isAllowed) {
          return res.status(200).json({ success: true, count: 0, data: [] });
        }
      } else {
        query.leadId = { $in: scopedLeadIds };
      }
    }

    const requirements = await Requirement.find(query)
      .populate('leadId', 'name phone email status temperature score assignedTo')
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
    const {
      leadId,
      title,
      propertyType,
      configurations,
      preferredLocations,
      budgetMin,
      budgetMax,
      areaMin,
      areaMax,
      purpose,
      possessionPreference,
      furnishing,
      financingRequired,
      timeline,
      notes,
    } = req.body;

    if (!leadId) {
      return res.status(400).json({ message: 'Lead ID is required' });
    }

    // Normalize propertyType to model enum
    let normalizedPropertyType = 'Apartment';
    if (propertyType) {
      const ptLower = String(propertyType).toLowerCase();
      if (ptLower.includes('villa')) normalizedPropertyType = 'Villa';
      else if (ptLower.includes('plot')) normalizedPropertyType = 'Plot';
      else if (ptLower.includes('commercial')) normalizedPropertyType = 'Commercial';
      else if (ptLower.includes('penthouse')) normalizedPropertyType = 'Penthouse';
      else if (ptLower.includes('floor')) normalizedPropertyType = 'Independent Floor';
      else if (ptLower.includes('office')) normalizedPropertyType = 'Office Space';
      else if (ptLower.includes('other')) normalizedPropertyType = 'Other';
      else normalizedPropertyType = 'Apartment';
    }

    const requirement = await Requirement.create({
      companyId,
      leadId,
      createdBy: req.user._id,
      title: title || `${normalizedPropertyType} Requirement`,
      propertyType: normalizedPropertyType,
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
      status: 'ACTIVE',
    });

    // Auto-recalculate lead score
    await calculateLeadScoreInternal(leadId, companyId);

    // Audit Log
    try {
      await auditService.record({
        req,
        action: 'CREATE',
        resourceType: 'Requirement',
        resourceId: requirement._id,
        organizationId: companyId,
        metadata: { leadId, title: requirement.title, budgetMin, budgetMax },
      });
    } catch {}

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

const toggleRequirementStatus = async (req, res) => {
  try {
    const companyId = getTenantId(req.user);
    const { id } = req.params;
    const { status } = req.body;

    if (!['ACTIVE', 'INACTIVE', 'FULFILLED', 'CANCELLED'].includes(status)) {
      return res.status(400).json({ message: 'Invalid requirement status' });
    }

    const requirement = await Requirement.findOneAndUpdate(
      { _id: id, companyId },
      { $set: { status } },
      { new: true }
    );

    if (!requirement) {
      return res.status(404).json({ message: 'Requirement not found' });
    }

    await calculateLeadScoreInternal(requirement.leadId, companyId);

    return res.status(200).json({ success: true, data: requirement });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to toggle requirement status', error: error.message });
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

    const teamUserIds = await getManagerTeamUserIds(req.user);
    if (teamUserIds !== null) {
      if (query.assignedTo) {
        const isAllowed = teamUserIds.some(id => String(id) === String(query.assignedTo));
        if (!isAllowed) {
          return res.status(200).json({ success: true, count: 0, data: [] });
        }
      } else {
        query.assignedTo = { $in: teamUserIds };
      }
    }

    const opportunities = await Opportunity.find(query)
      .populate('leadId', 'name phone email status temperature score assignedTo')
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
    const {
      leadId,
      requirementId,
      projectId,
      inventoryId,
      title,
      pipelineId,
      stage,
      expectedValue,
      probability,
      assignedTo,
      expectedClosingDate,
      notes,
    } = req.body;

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

    const val = Number(expectedValue) || project.minPrice || 0;
    const prob = Number(probability) !== undefined ? Number(probability) : 50;

    const opportunity = await Opportunity.create({
      companyId,
      leadId,
      requirementId: requirementId || null,
      projectId,
      inventoryId: inventoryId || null,
      title: title || `${lead.name} - ${project.name}`,
      pipelineId: pipelineId || null,
      stage: stage || 'Site Visit Scheduled',
      expectedValue: val,
      probability: prob,
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
    const { stage, probability, remark, lostReason } = req.body;

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
      opportunity.lostReason = lostReason || 'Other';
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

    // Audit Log
    try {
      await auditService.record({
        req,
        action: 'UPDATE',
        resourceType: 'Opportunity',
        resourceId: opportunity._id,
        organizationId: companyId,
        metadata: { fromStage: previousStage, toStage: stage, leadId: opportunity.leadId },
      });
    } catch {}

    return res.status(200).json({ success: true, data: opportunity });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update opportunity stage', error: error.message });
  }
};

const deleteOpportunity = async (req, res) => {
  try {
    const companyId = getTenantId(req.user);
    const { id } = req.params;

    const opportunity = await Opportunity.findOneAndDelete({ _id: id, companyId });
    if (!opportunity) {
      return res.status(404).json({ message: 'Opportunity not found' });
    }

    await calculateLeadScoreInternal(opportunity.leadId, companyId);

    return res.status(200).json({ success: true, message: 'Opportunity deleted' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete opportunity', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// 5. INVENTORY MANAGEMENT & ATOMIC HOLD CONCURRENCY
// ─────────────────────────────────────────────────────────────
const getInventory = async (req, res) => {
  try {
    const companyId = getTenantId(req.user);
    const { projectId, tower, configuration, status, facing, minPrice, maxPrice, minArea, maxArea } = req.query;

    const query = { companyId };
    if (projectId) query.projectId = projectId;
    if (tower) query.tower = tower;
    if (configuration) query.configuration = configuration;
    if (status) query.status = status;
    if (facing) query.facing = facing;

    if (minPrice || maxPrice) {
      query.totalPrice = {};
      if (minPrice) query.totalPrice.$gte = Number(minPrice);
      if (maxPrice) query.totalPrice.$lte = Number(maxPrice);
    }

    if (minArea || maxArea) {
      query.carpetArea = {};
      if (minArea) query.carpetArea.$gte = Number(minArea);
      if (maxArea) query.carpetArea.$lte = Number(maxArea);
    }

    const inventory = await Inventory.find(query)
      .populate('projectId', 'name location developer')
      .populate('bookedByLeadId', 'name phone')
      .populate('holdByLeadId', 'name phone')
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
    const {
      projectId,
      tower,
      floor,
      unitNumber,
      configuration,
      facing,
      carpetArea,
      builtUpArea,
      superArea,
      basePrice,
      additionalCharges,
      totalPrice,
      notes,
    } = req.body;

    if (!projectId || !unitNumber) {
      return res.status(400).json({ message: 'Project ID and Unit Number are mandatory' });
    }

    // Cross-tenant validation
    const project = await Project.findOne({
      _id: projectId,
      $or: [{ companyId }, { userId: companyId }, { userId: req.user._id }],
    });
    if (!project) return res.status(404).json({ message: 'Project not found in this organization' });

    // Explicit duplicate check for deterministic 409 response
    const existingUnit = await Inventory.findOne({
      companyId,
      projectId,
      tower: tower || 'Tower A',
      unitNumber: String(unitNumber).trim(),
    });
    if (existingUnit) {
      return res.status(409).json({ message: 'Unit with this Number and Tower already exists in this project.' });
    }

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

const bulkCreateInventory = async (req, res) => {
  try {
    const companyId = getTenantId(req.user);
    const { projectId, units } = req.body;

    if (!projectId || !Array.isArray(units) || units.length === 0) {
      return res.status(400).json({ message: 'Project ID and an array of units are required' });
    }

    const project = await Project.findOne({
      _id: projectId,
      $or: [{ companyId }, { userId: companyId }, { userId: req.user._id }],
    });
    if (!project) return res.status(404).json({ message: 'Project not found in this organization' });

    const docsToInsert = units.map((u) => ({
      companyId,
      projectId,
      tower: u.tower || 'Tower A',
      floor: Number(u.floor) || 1,
      unitNumber: String(u.unitNumber).trim(),
      configuration: u.configuration || '3BHK',
      facing: u.facing || 'East',
      carpetArea: Number(u.carpetArea) || 0,
      builtUpArea: Number(u.builtUpArea) || 0,
      superArea: Number(u.superArea) || 0,
      basePrice: Number(u.basePrice) || 0,
      additionalCharges: Number(u.additionalCharges) || 0,
      totalPrice: Number(u.totalPrice || (Number(u.basePrice || 0) + Number(u.additionalCharges || 0))),
      status: 'AVAILABLE',
      notes: u.notes || '',
    }));

    const inserted = await Inventory.insertMany(docsToInsert, { ordered: false });

    // Refresh project counters
    const [totalUnits, availableUnits] = await Promise.all([
      Inventory.countDocuments({ companyId, projectId }),
      Inventory.countDocuments({ companyId, projectId, status: 'AVAILABLE' }),
    ]);

    await Project.updateOne({ _id: projectId }, { $set: { totalUnits, availableUnits } });

    return res.status(201).json({ success: true, count: inserted.length, data: inserted });
  } catch (error) {
    return res.status(500).json({ message: 'Bulk inventory creation failed', error: error.message });
  }
};

// Atomic Hold Endpoint
const holdInventoryUnit = async (req, res) => {
  try {
    const companyId = getTenantId(req.user);
    const { id } = req.params;
    const { leadId, durationMinutes } = req.body;

    if (!leadId) {
      return res.status(400).json({ message: 'leadId is required to place a unit on hold' });
    }

    // Validate Lead
    const lead = await Lead.findOne({ _id: leadId, companyId });
    if (!lead) return res.status(404).json({ message: 'Lead not found in this organization' });

    const minutes = Number(durationMinutes) || 1440; // Default 24 hours
    const expiresAt = new Date(Date.now() + minutes * 60 * 1000);

    // ATOMIC conditional update: Must be strictly AVAILABLE
    const unit = await Inventory.findOneAndUpdate(
      {
        _id: id,
        companyId,
        status: 'AVAILABLE',
      },
      {
        $set: {
          status: 'HOLD',
          holdExpiresAt: expiresAt,
          holdByLeadId: leadId,
        },
      },
      { new: true }
    );

    if (!unit) {
      return res.status(409).json({
        code: 'INVENTORY_NOT_AVAILABLE',
        message: 'Conflict: This unit is not currently AVAILABLE. It may be already on HOLD or BOOKED.',
      });
    }

    // Sync project counters
    const availableUnits = await Inventory.countDocuments({ companyId, projectId: unit.projectId, status: 'AVAILABLE' });
    await Project.updateOne({ _id: unit.projectId }, { $set: { availableUnits } });

    // Audit Log
    try {
      await auditService.record({
        req,
        action: 'UPDATE',
        resourceType: 'Inventory',
        resourceId: unit._id,
        organizationId: companyId,
        metadata: { leadId, expiresAt, unitNumber: unit.unitNumber },
      });
    } catch {}

    return res.status(200).json({ success: true, data: unit });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to hold unit', error: error.message });
  }
};

// Atomic Release Endpoint
const releaseInventoryHold = async (req, res) => {
  try {
    const companyId = getTenantId(req.user);
    const { id } = req.params;

    const unit = await Inventory.findOneAndUpdate(
      {
        _id: id,
        companyId,
        status: { $in: ['HOLD', 'BLOCKED'] },
      },
      {
        $set: {
          status: 'AVAILABLE',
          holdExpiresAt: null,
          holdByLeadId: null,
        },
      },
      { new: true }
    );

    if (!unit) {
      return res.status(404).json({ message: 'Unit not found or was not on HOLD/BLOCKED status' });
    }

    const availableUnits = await Inventory.countDocuments({ companyId, projectId: unit.projectId, status: 'AVAILABLE' });
    await Project.updateOne({ _id: unit.projectId }, { $set: { availableUnits } });

    return res.status(200).json({ success: true, data: unit });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to release unit', error: error.message });
  }
};

// Release Expired Holds Job
const releaseExpiredHolds = async (req, res) => {
  try {
    const companyId = getTenantId(req.user);
    const now = new Date();

    const expiredUnits = await Inventory.find({
      companyId,
      status: 'HOLD',
      holdExpiresAt: { $lt: now },
    });

    if (expiredUnits.length > 0) {
      const projectIds = [...new Set(expiredUnits.map((u) => String(u.projectId)))];

      await Inventory.updateMany(
        {
          companyId,
          status: 'HOLD',
          holdExpiresAt: { $lt: now },
        },
        {
          $set: {
            status: 'AVAILABLE',
            holdExpiresAt: null,
            holdByLeadId: null,
          },
        }
      );

      for (const pId of projectIds) {
        const availableUnits = await Inventory.countDocuments({ companyId, projectId: pId, status: 'AVAILABLE' });
        await Project.updateOne({ _id: pId }, { $set: { availableUnits } });
      }
    }

    return res.status(200).json({
      success: true,
      releasedCount: expiredUnits.length,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to release expired holds', error: error.message });
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

    const currentUnit = await Inventory.findOne({ _id: id, companyId });
    if (!currentUnit) {
      return res.status(404).json({ message: 'Inventory unit not found' });
    }

    // Controlled State Machine Rules
    if (currentUnit.status === 'SOLD') {
      return res.status(409).json({ message: 'Cannot mutate unit in SOLD status.' });
    }

    const updateDoc = { status };
    if (status === 'HOLD') {
      const minutes = Number(holdExpiresInMinutes) || 1440;
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

    const scopedLeadIds = await getLeadIdsForUserScope(req.user, companyId);
    if (scopedLeadIds !== null) {
      if (query.leadId) {
        const isAllowed = scopedLeadIds.some(id => String(id) === String(query.leadId));
        if (!isAllowed) {
          return res.status(200).json({ success: true, count: 0, data: [] });
        }
      } else {
        query.leadId = { $in: scopedLeadIds };
      }
    }

    const eois = await EOI.find(query)
      .populate('leadId', 'name phone email assignedTo')
      .populate('projectId', 'name location developer')
      .populate('inventoryId', 'unitNumber tower configuration totalPrice')
      .populate('createdBy', 'name email')
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

    // Audit Log
    try {
      await auditService.record({
        req,
        action: 'CREATE',
        resourceType: 'EOI',
        resourceId: eoi._id,
        organizationId: companyId,
        metadata: { leadId, eoiNumber, tokenAmount },
      });
    } catch {}

    return res.status(201).json({ success: true, data: eoi });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create EOI', error: error.message });
  }
};

const confirmEOI = async (req, res) => {
  try {
    const companyId = getTenantId(req.user);
    const { id } = req.params || {};
    const { paymentReference, paymentMode } = req.body || {};

    const eoi = await EOI.findOneAndUpdate(
      { _id: id, companyId },
      {
        $set: {
          status: 'CONFIRMED',
          paymentStatus: 'PAID',
          paymentReference: paymentReference || '',
          paymentMode: paymentMode || 'UPI',
        },
      },
      { new: true }
    );

    if (!eoi) return res.status(404).json({ message: 'EOI not found' });

    await calculateLeadScoreInternal(eoi.leadId, companyId);

    return res.status(200).json({ success: true, data: eoi });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to confirm EOI', error: error.message });
  }
};

const cancelEOI = async (req, res) => {
  try {
    const companyId = getTenantId(req.user);
    const { id } = req.params || {};
    const { cancellationReason } = req.body || {};

    const eoi = await EOI.findOne({ _id: id, companyId });
    if (!eoi) return res.status(404).json({ message: 'EOI not found' });

    eoi.status = 'CANCELLED';
    eoi.notes = (eoi.notes ? `${eoi.notes}\n` : '') + `Cancelled: ${cancellationReason || 'User request'}`;
    await eoi.save();

    // Release held inventory unit safely
    if (eoi.inventoryId) {
      await Inventory.updateOne(
        { _id: eoi.inventoryId, companyId, holdByLeadId: eoi.leadId },
        { $set: { status: 'AVAILABLE', holdExpiresAt: null, holdByLeadId: null } }
      );

      const availableUnits = await Inventory.countDocuments({ companyId, projectId: eoi.projectId, status: 'AVAILABLE' });
      await Project.updateOne({ _id: eoi.projectId }, { $set: { availableUnits } });
    }

    await calculateLeadScoreInternal(eoi.leadId, companyId);

    return res.status(200).json({ success: true, message: 'EOI cancelled and inventory released' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to cancel EOI', error: error.message });
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

    const scopedLeadIds = await getLeadIdsForUserScope(req.user, companyId);
    if (scopedLeadIds !== null) {
      if (query.leadId) {
        const isAllowed = scopedLeadIds.some(id => String(id) === String(query.leadId));
        if (!isAllowed) {
          return res.status(200).json({ success: true, count: 0, data: [] });
        }
      } else {
        query.leadId = { $in: scopedLeadIds };
      }
    }

    const bookings = await Booking.find(query)
      .populate('leadId', 'name phone email assignedTo')
      .populate('projectId', 'name location developer')
      .populate('inventoryId', 'unitNumber tower floor configuration totalPrice')
      .populate('createdBy', 'name email')
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
    const {
      leadId,
      opportunityId,
      projectId,
      inventoryId,
      eoiId,
      bookingAmount,
      agreementValue,
      paymentPlan,
      notes,
    } = req.body;

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

    // Calculate Commission if active rule exists
    let calculatedCommissionAmount = 0;
    let commissionRuleApplied = null;

    try {
      const activeRule = await CommissionRule.findOne({
        isActive: true,
      });

      if (activeRule) {
        commissionRuleApplied = activeRule._id;
        if (activeRule.commissionType === 'PERCENTAGE') {
          calculatedCommissionAmount = (numAgreementValue * activeRule.value) / 100;
        } else {
          calculatedCommissionAmount = activeRule.value;
        }

        // Record payout
        await CommissionPayout.create({
          userId: req.user._id,
          leadId,
          saleValue: numAgreementValue,
          commissionEarned: calculatedCommissionAmount,
          appliedRuleId: activeRule._id,
          ruleNameSnapshot: activeRule.ruleName,
          status: 'PENDING',
        });
      }
    } catch (e) {
      console.warn('Commission rule evaluation skipped:', e.message);
    }

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
      commissionCalculated: Boolean(calculatedCommissionAmount),
      commissionAmount: calculatedCommissionAmount,
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

    // Audit Log
    try {
      await auditService.record({
        req,
        action: 'CREATE',
        resourceType: 'Booking',
        resourceId: booking._id,
        organizationId: companyId,
        metadata: { bookingNumber, agreementValue: numAgreementValue, leadId },
      });
    } catch {}

    return res.status(201).json({ success: true, data: booking });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create booking', error: error.message });
  }
};

const updateBookingStatus = async (req, res) => {
  try {
    const companyId = getTenantId(req.user);
    const { id } = req.params;
    const { status } = req.body;

    const allowed = ['CONFIRMED', 'AGREEMENT_SIGNED', 'REGISTERED'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: `Status must be one of: ${allowed.join(', ')}` });
    }

    const booking = await Booking.findOneAndUpdate(
      { _id: id, companyId },
      { $set: { status } },
      { new: true }
    );

    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    return res.status(200).json({ success: true, data: booking });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update booking status', error: error.message });
  }
};

const cancelBooking = async (req, res) => {
  try {
    const companyId = getTenantId(req.user);
    const { id } = req.params;
    const { cancellationReason } = req.body;

    const booking = await Booking.findOne({ _id: id, companyId });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    booking.status = 'CANCELLED';
    booking.cancelledAt = new Date();
    booking.cancelledBy = req.user._id;
    booking.cancellationReason = cancellationReason || 'Cancellation requested';
    await booking.save();

    // Release Inventory unit back to AVAILABLE
    if (booking.inventoryId) {
      await Inventory.updateOne(
        { _id: booking.inventoryId, companyId },
        { $set: { status: 'AVAILABLE', bookedByLeadId: null, holdExpiresAt: null, holdByLeadId: null } }
      );

      const availableUnits = await Inventory.countDocuments({ companyId, projectId: booking.projectId, status: 'AVAILABLE' });
      await Project.updateOne({ _id: booking.projectId }, { $set: { availableUnits } });
    }

    // Recalculate lead score
    await calculateLeadScoreInternal(booking.leadId, companyId);

    // Audit Log
    try {
      await auditService.record({
        req,
        action: 'UPDATE',
        resourceType: 'Booking',
        resourceId: booking._id,
        organizationId: companyId,
        metadata: { bookingNumber: booking.bookingNumber, cancellationReason },
      });
    } catch {}

    return res.status(200).json({ success: true, message: 'Booking cancelled and inventory released.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to cancel booking', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// 8. PAYMENT SCHEDULE & RECEIPTS
// ─────────────────────────────────────────────────────────────
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

    // Audit Log
    try {
      await auditService.record({
        req,
        action: 'UPDATE',
        resourceType: 'PaymentSchedule',
        resourceId: schedule._id,
        organizationId: companyId,
        metadata: { paidAmount: numPaid, milestoneName: schedule.milestoneName },
      });
    } catch {}

    return res.status(200).json({ success: true, data: schedule });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to record payment', error: error.message });
  }
};

const getPaymentsSummary = async (req, res) => {
  try {
    const companyId = getTenantId(req.user);
    const now = new Date();

    const scopedLeadIds = await getLeadIdsForUserScope(req.user, companyId);
    const bookingQuery = { companyId, status: { $ne: 'CANCELLED' } };
    if (scopedLeadIds !== null) {
      bookingQuery.leadId = { $in: scopedLeadIds };
    }

    const bookings = await Booking.find(bookingQuery).select('_id agreementValue totalPaid leadId').lean();
    const bookingIds = bookings.map(b => b._id);

    const scheduleQuery = { companyId };
    if (scopedLeadIds !== null) {
      scheduleQuery.bookingId = { $in: bookingIds };
    }

    const allSchedules = await PaymentSchedule.find(scheduleQuery).lean();

    let totalCollected = 0;
    let upcomingAmount = 0;
    let dueAmount = 0;
    let overdueAmount = 0;

    for (const s of allSchedules) {
      const remaining = Math.max(0, s.amount - (s.paidAmount || 0));
      if (s.status === 'PAID') {
        totalCollected += s.paidAmount || 0;
      } else {
        totalCollected += s.paidAmount || 0;
        if (new Date(s.dueDate) < now) {
          overdueAmount += remaining;
        } else if (new Date(s.dueDate) <= new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000)) {
          dueAmount += remaining;
        } else {
          upcomingAmount += remaining;
        }
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        totalCollected,
        upcomingAmount,
        dueAmount,
        overdueAmount,
        totalMilestones: allSchedules.length,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch payments summary', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// 9. OFFERS / SCHEMES ENGINE
// ─────────────────────────────────────────────────────────────
const getOffers = async (req, res) => {
  try {
    const companyId = getTenantId(req.user);
    const { projectId, status } = req.query;

    const query = { companyId };
    if (projectId) query.applicableProjects = projectId;
    if (status) query.status = status;

    const offers = await Offer.find(query)
      .populate('applicableProjects', 'name location')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ success: true, count: offers.length, data: offers });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch offers', error: error.message });
  }
};

const createOffer = async (req, res) => {
  try {
    const companyId = getTenantId(req.user);
    const {
      title,
      code,
      schemeType,
      discountPct,
      discountFixed,
      applicableProjects,
      validFrom,
      validUntil,
    } = req.body;

    if (!title) return res.status(400).json({ message: 'Offer title is required' });

    const offer = await Offer.create({
      companyId,
      title,
      code: code ? String(code).toUpperCase() : `SCHEME-${Date.now().toString().slice(-4)}`,
      schemeType: schemeType || 'flat_discount',
      discountPct: Number(discountPct) || null,
      discountFixed: Number(discountFixed) || null,
      applicableProjects: Array.isArray(applicableProjects) ? applicableProjects : [],
      validFrom: validFrom ? new Date(validFrom) : new Date(),
      validUntil: validUntil ? new Date(validUntil) : null,
      status: 'ACTIVE',
    });

    return res.status(201).json({ success: true, data: offer });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create offer', error: error.message });
  }
};

const deleteOffer = async (req, res) => {
  try {
    const companyId = getTenantId(req.user);
    const { id } = req.params;

    const offer = await Offer.findOneAndDelete({ _id: id, companyId });
    if (!offer) return res.status(404).json({ message: 'Offer not found' });

    return res.status(200).json({ success: true, message: 'Offer removed' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete offer', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// 10. REAL ESTATE ANALYTICS SUMMARY
// ─────────────────────────────────────────────────────────────
const getRealEstateAnalytics = async (req, res) => {
  try {
    const companyId = getTenantId(req.user);
    const teamUserIds = await getManagerTeamUserIds(req.user);
    const scopedLeadIds = await getLeadIdsForUserScope(req.user, companyId);

    const leadBaseQuery = { companyId, deletedAt: null };
    if (scopedLeadIds !== null) {
      leadBaseQuery._id = { $in: scopedLeadIds };
    }

    const reqBaseQuery = { companyId, status: 'ACTIVE' };
    if (scopedLeadIds !== null) {
      reqBaseQuery.leadId = { $in: scopedLeadIds };
    }

    const oppBaseQuery = { companyId, status: 'OPEN' };
    if (teamUserIds !== null) {
      oppBaseQuery.assignedTo = { $in: teamUserIds };
    }

    const eoiBaseQuery = { companyId };
    if (scopedLeadIds !== null) {
      eoiBaseQuery.leadId = { $in: scopedLeadIds };
    }

    const bookingBaseQuery = { companyId, status: { $ne: 'CANCELLED' } };
    if (scopedLeadIds !== null) {
      bookingBaseQuery.leadId = { $in: scopedLeadIds };
    }

    const followUpQuery = { companyId, type: 'site_visit' };
    if (scopedLeadIds !== null) {
      followUpQuery.$or = [{ lead_id: { $in: scopedLeadIds } }, { leadId: { $in: scopedLeadIds } }];
    }

    const allFollowUpsQuery = { companyId };
    if (scopedLeadIds !== null) {
      allFollowUpsQuery.$or = [{ lead_id: { $in: scopedLeadIds } }, { leadId: { $in: scopedLeadIds } }];
    }

    const [
      totalLeads,
      newLeads,
      hotLeads,
      warmLeads,
      coldLeads,
      activeRequirements,
      opportunities,
      totalEOIs,
      pendingEOIs,
      confirmedEOIs,
      expiringEOIs,
      confirmedBookings,
      inventoryStats,
      siteVisits,
      allFollowUps,
    ] = await Promise.all([
      Lead.countDocuments(leadBaseQuery),
      Lead.countDocuments({ ...leadBaseQuery, status: { $in: ['new_lead', 'new'] } }),
      Lead.countDocuments({ ...leadBaseQuery, temperature: 'HOT' }),
      Lead.countDocuments({ ...leadBaseQuery, temperature: 'WARM' }),
      Lead.countDocuments({ ...leadBaseQuery, temperature: 'COLD' }),
      Requirement.countDocuments(reqBaseQuery),
      Opportunity.find(oppBaseQuery).select('expectedValue probability stage').lean(),
      EOI.countDocuments({ ...eoiBaseQuery, status: { $in: ['SUBMITTED', 'CONFIRMED'] } }),
      EOI.countDocuments({ ...eoiBaseQuery, status: 'SUBMITTED' }),
      EOI.countDocuments({ ...eoiBaseQuery, status: 'CONFIRMED' }),
      EOI.countDocuments({
        ...eoiBaseQuery,
        status: { $in: ['SUBMITTED', 'CONFIRMED'] },
        createdAt: { $lt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000) }
      }),
      Booking.find(bookingBaseQuery).select('agreementValue bookingAmount totalPaid status').lean(),
      Inventory.aggregate([
        { $match: { companyId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      FollowUp.find(followUpQuery).select('status siteVisitDetails scheduledAt date time').lean(),
      FollowUp.find(allFollowUpsQuery).select('status date scheduledAt').lean(),
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
    let totalOutstandingAmount = 0;
    for (const bk of confirmedBookings) {
      const agVal = bk.agreementValue || 0;
      const pdVal = bk.totalPaid || 0;
      totalAgreementValue += agVal;
      totalCollectedAmount += pdVal;
      totalOutstandingAmount += Math.max(0, agVal - pdVal);
    }

    // Site Visit Conversion & Metrics
    const totalSiteVisits = siteVisits.length;
    const completedSiteVisits = siteVisits.filter((s) => s.status === 'done' || s.status === 'completed').length;
    const noShowVisits = siteVisits.filter((s) => s.status === 'no_show' || s.status === 'cancelled').length;
    const siteVisitConversionRate = totalSiteVisits > 0 ? ((completedSiteVisits / totalSiteVisits) * 100).toFixed(1) : 0;

    // Follow-ups due
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const todaySiteVisitsCount = siteVisits.filter(s => {
      const visitDate = s.scheduledAt || s.date ? new Date(s.scheduledAt || s.date) : null;
      return visitDate && visitDate >= startOfToday && visitDate <= endOfToday;
    }).length;

    const upcomingSiteVisitsCount = siteVisits.filter(s => {
      const visitDate = s.scheduledAt || s.date ? new Date(s.scheduledAt || s.date) : null;
      return visitDate && visitDate > endOfToday && (s.status === 'pending' || s.status === 'scheduled');
    }).length;

    const overdueFollowUpsCount = allFollowUps.filter(f => {
      const fDate = f.scheduledAt || f.date ? new Date(f.scheduledAt || f.date) : null;
      return fDate && fDate < startOfToday && f.status === 'pending';
    }).length;

    const todayFollowUpsCount = allFollowUps.filter(f => {
      const fDate = f.scheduledAt || f.date ? new Date(f.scheduledAt || f.date) : null;
      return fDate && fDate >= startOfToday && fDate <= endOfToday && f.status === 'pending';
    }).length;

    const upcomingFollowUpsCount = allFollowUps.filter(f => {
      const fDate = f.scheduledAt || f.date ? new Date(f.scheduledAt || f.date) : null;
      return fDate && fDate > endOfToday && f.status === 'pending';
    }).length;

    // EOI conversion rate
    const eoiConversionRate = totalEOIs > 0 ? ((confirmedBookings.length / totalEOIs) * 100).toFixed(1) : 0;
    // Lead conversion rate
    const leadConversionRate = totalLeads > 0 ? ((confirmedBookings.length / totalLeads) * 100).toFixed(1) : 0;

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
          new: newLeads,
          hot: hotLeads,
          warm: warmLeads,
          cold: coldLeads,
          conversionRate: `${leadConversionRate}%`,
        },
        followUps: {
          overdue: overdueFollowUpsCount,
          today: todayFollowUpsCount,
          upcoming: upcomingFollowUpsCount,
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
          today: todaySiteVisitsCount,
          upcoming: upcomingSiteVisitsCount,
          completed: completedSiteVisits,
          noShow: noShowVisits,
          conversionRate: `${siteVisitConversionRate}%`,
        },
        eois: {
          total: totalEOIs,
          pending: pendingEOIs,
          confirmed: confirmedEOIs,
          expiring: expiringEOIs,
          conversionRate: `${eoiConversionRate}%`,
        },
        bookings: {
          count: confirmedBookings.length,
          totalAgreementValue,
          totalCollectedAmount,
          totalOutstandingAmount,
        },
        inventory: inventorySummary,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to generate real estate analytics', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// 11. TEAM MANAGEMENT & AGENT WORKLOAD (MANAGER & ADMIN)
// ─────────────────────────────────────────────────────────────
const getManagerTeamMembers = async (req, res) => {
  try {
    const companyId = getTenantId(req.user);
    const teamUserIds = await getManagerTeamUserIds(req.user);

    const filter = {
      companyId,
      $or: [
        { role: { $in: ['agent', 'manager', 'sales_rep'] } },
        { companyRole: { $in: ['agent', 'manager', 'sales_rep'] } },
      ],
    };

    if (teamUserIds !== null) {
      filter._id = { $in: teamUserIds };
    }

    const members = await User.find(filter)
      .populate('managerId', 'name email')
      .populate('roleId', 'name roleType permissions')
      .select('name email phone role roleId companyRole managerId managerName leadCap isAvailable isAvailableForRouting isActive userStatus employeeStatus createdAt lastLogin')
      .lean();

    return res.status(200).json({ success: true, count: members.length, data: members });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch team members', error: error.message });
  }
};

const getManagerTeamPerformance = async (req, res) => {
  try {
    const companyId = getTenantId(req.user);
    const teamUserIds = await getManagerTeamUserIds(req.user);

    const filter = {
      companyId,
      $or: [
        { role: { $in: ['agent', 'manager', 'sales_rep'] } },
        { companyRole: { $in: ['agent', 'manager', 'sales_rep'] } },
      ],
    };

    if (teamUserIds !== null) {
      filter._id = { $in: teamUserIds };
    }

    const agents = await User.find(filter)
      .select('name email phone role companyRole managerName leadCap isAvailableForRouting isActive incentive_pct')
      .lean();

    const performanceList = [];

    for (const agent of agents) {
      const [
        assignedLeadsCount,
        contactedLeadsCount,
        reqCount,
        siteVisits,
        opps,
        eoisCount,
        bookings,
        commissionAgg
      ] = await Promise.all([
        Lead.countDocuments({ companyId, assignedTo: agent._id, deletedAt: null }),
        Lead.countDocuments({
          companyId,
          assignedTo: agent._id,
          status: { $nin: ['new_lead', 'new'] },
          deletedAt: null
        }),
        Requirement.countDocuments({ companyId, createdBy: agent._id }),
        FollowUp.find({
          companyId,
          type: 'site_visit',
          $or: [{ assignedTo: agent._id }, { userId: agent._id }, { agentId: agent._id }]
        }).select('status').lean(),
        Opportunity.find({ companyId, assignedTo: agent._id }).select('expectedValue stage status').lean(),
        EOI.countDocuments({ companyId, $or: [{ createdBy: agent._id }, { assignedTo: agent._id }] }),
        Booking.find({
          companyId,
          status: { $ne: 'CANCELLED' },
          $or: [{ createdBy: agent._id }, { assignedTo: agent._id }]
        }).select('agreementValue bookingAmount totalPaid').lean(),
        CommissionPayout.aggregate([
          { $match: { companyId, userId: agent._id, status: { $in: ['APPROVED', 'PAID', 'approved', 'paid'] } } },
          { $group: { _id: null, total: { $sum: '$commissionEarned' } } }
        ]),
      ]);

      const totalVisits = siteVisits.length;
      const completedVisits = siteVisits.filter(s => s.status === 'done' || s.status === 'completed').length;
      const totalBookings = bookings.length;
      const totalBookingValue = bookings.reduce((sum, b) => sum + (b.agreementValue || 0), 0);
      const conversionRate = assignedLeadsCount > 0 ? ((totalBookings / assignedLeadsCount) * 100).toFixed(1) : '0.0';
      const commissionEarned = commissionAgg[0]?.total || 0;

      performanceList.push({
        id: agent._id,
        agentId: agent._id,
        name: agent.name,
        email: agent.email,
        phone: agent.phone,
        role: agent.role,
        managerName: agent.managerName || 'Direct',
        leadsAssigned: assignedLeadsCount,
        leadsContacted: contactedLeadsCount,
        requirements: reqCount,
        siteVisits: totalVisits,
        completedVisits,
        opportunities: opps.length,
        eois: eoisCount,
        bookings: totalBookings,
        bookingValue: totalBookingValue,
        conversionRate: `${conversionRate}%`,
        commissionEarned,
        isActive: agent.isActive !== false,
      });
    }

    return res.status(200).json({ success: true, count: performanceList.length, data: performanceList });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch team performance', error: error.message });
  }
};

const getManagerTeamWorkload = async (req, res) => {
  try {
    const companyId = getTenantId(req.user);
    const teamUserIds = await getManagerTeamUserIds(req.user);

    const filter = {
      companyId,
      $or: [
        { role: { $in: ['agent', 'manager', 'sales_rep'] } },
        { companyRole: { $in: ['agent', 'manager', 'sales_rep'] } },
      ],
    };

    if (teamUserIds !== null) {
      filter._id = { $in: teamUserIds };
    }

    const agents = await User.find(filter)
      .select('name email phone role companyRole managerName leadCap isAvailableForRouting isActive')
      .lean();

    const workloadList = [];

    for (const agent of agents) {
      const [
        activeLeadsCount,
        hotLeadsCount,
        pendingFollowUpsCount,
        upcomingVisitsCount,
        openOppsCount
      ] = await Promise.all([
        Lead.countDocuments({
          companyId,
          assignedTo: agent._id,
          status: { $nin: ['converted', 'closed', 'lost', 'deal_lost', 'not_interested'] },
          deletedAt: null
        }),
        Lead.countDocuments({
          companyId,
          assignedTo: agent._id,
          temperature: 'HOT',
          deletedAt: null
        }),
        FollowUp.countDocuments({
          companyId,
          status: 'pending',
          $or: [{ assignedTo: agent._id }, { userId: agent._id }, { agentId: agent._id }]
        }),
        FollowUp.countDocuments({
          companyId,
          type: 'site_visit',
          status: { $in: ['pending', 'scheduled'] },
          $or: [{ assignedTo: agent._id }, { userId: agent._id }, { agentId: agent._id }]
        }),
        Opportunity.countDocuments({
          companyId,
          assignedTo: agent._id,
          status: 'OPEN'
        }),
      ]);

      workloadList.push({
        id: agent._id,
        agentId: agent._id,
        name: agent.name,
        email: agent.email,
        phone: agent.phone,
        role: agent.role,
        leadCap: agent.leadCap || 50,
        isAvailable: agent.isAvailableForRouting !== false,
        activeLeads: activeLeadsCount,
        hotLeads: hotLeadsCount,
        pendingFollowUps: pendingFollowUpsCount,
        upcomingVisits: upcomingVisitsCount,
        openOpportunities: openOppsCount,
      });
    }

    return res.status(200).json({ success: true, count: workloadList.length, data: workloadList });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch team workload', error: error.message });
  }
};

module.exports = {
  scoreLead,
  matchProperties,
  getRequirements,
  createRequirement,
  updateRequirement,
  toggleRequirementStatus,
  deleteRequirement,
  getOpportunities,
  createOpportunity,
  updateOpportunityStage,
  deleteOpportunity,
  getInventory,
  createInventory,
  bulkCreateInventory,
  updateInventoryStatus,
  holdInventoryUnit,
  releaseInventoryHold,
  releaseExpiredHolds,
  getEOIs,
  createEOI,
  confirmEOI,
  cancelEOI,
  getBookings,
  createBooking,
  updateBookingStatus,
  cancelBooking,
  getBookingPaymentSchedule,
  recordPaymentReceipt,
  getPaymentsSummary,
  getOffers,
  createOffer,
  deleteOffer,
  getRealEstateAnalytics,
  getManagerTeamMembers,
  getManagerTeamPerformance,
  getManagerTeamWorkload,
  getManagerTeamUserIds,
  getLeadIdsForUserScope,
  calculateLeadScoreInternal,
};
