const Pipeline = require('../models/Pipeline');
const Lead = require('../models/Lead');

/**
 * Get all pipelines for workspace
 */
exports.getPipelines = async (req, res) => {
  try {
    const workspaceId = req.workspaceId;
    let pipelines = await Pipeline.find({ workspaceId, isActive: true }).sort({ isDefault: -1, createdAt: 1 });

    if (!pipelines || pipelines.length === 0) {
      const defaultPipeline = await Pipeline.seedDefaultPipelines(workspaceId, req.user._id);
      pipelines = defaultPipeline ? [defaultPipeline] : [];
    }

    // Get lead count per pipeline if requested
    const pipelineIds = pipelines.map(p => p._id);
    const leadCounts = await Lead.aggregate([
      { $match: { workspaceId: workspaceId, pipelineId: { $in: pipelineIds } } },
      { $group: { _id: { pipelineId: '$pipelineId', stage: '$pipeline_stage' }, count: { $sum: 1 } } }
    ]);

    const leadCountsMap = {};
    leadCounts.forEach(item => {
      const pId = item._id.pipelineId?.toString();
      const stage = item._id.stage;
      if (pId) {
        if (!leadCountsMap[pId]) leadCountsMap[pId] = {};
        leadCountsMap[pId][stage] = item.count;
      }
    });

    const result = pipelines.map(p => {
      const pObj = p.toObject();
      pObj.stageCounts = leadCountsMap[p._id.toString()] || {};
      return pObj;
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('getPipelines error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch pipelines' });
  }
};

/**
 * Get single pipeline with details
 */
exports.getPipelineById = async (req, res) => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspaceId;

    const pipeline = await Pipeline.findOne({ _id: id, workspaceId, isActive: true });
    if (!pipeline) {
      return res.status(404).json({ success: false, message: 'Pipeline not found' });
    }

    res.json({
      success: true,
      data: pipeline,
    });
  } catch (error) {
    console.error('getPipelineById error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch pipeline' });
  }
};

/**
 * Create a new pipeline
 */
exports.createPipeline = async (req, res) => {
  try {
    const workspaceId = req.workspaceId;
    const { name, description, stages, isDefault } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Pipeline name is required' });
    }

    // If making default, remove default flag from existing
    if (isDefault) {
      await Pipeline.updateMany({ workspaceId }, { $set: { isDefault: false } });
    }

    // Ensure valid stages
    let cleanStages = stages;
    if (!cleanStages || !Array.isArray(cleanStages) || cleanStages.length === 0) {
      cleanStages = [
        { stageId: 'inquiry', name: 'Inquiry', category: 'open', order: 0, probability: 20 },
        { stageId: 'contacted', name: 'Contacted', category: 'open', order: 1, probability: 40 },
        { stageId: 'counselled', name: 'Counselled', category: 'open', order: 2, probability: 60 },
        { stageId: 'application_submitted', name: 'Application Submitted', category: 'open', order: 3, probability: 80 },
        { stageId: 'admitted', name: 'Admitted', category: 'won', order: 4, probability: 100 },
        { stageId: 'withdrawn', name: 'Withdrawn', category: 'lost', order: 5, probability: 0 },
      ];
    } else {
      // Validate each stage
      cleanStages = cleanStages.map((st, idx) => ({
        stageId: st.stageId || `stage_${Date.now()}_${idx}`,
        name: st.name || `Stage ${idx + 1}`,
        category: ['open', 'won', 'lost'].includes(st.category) ? st.category : 'open',
        order: typeof st.order === 'number' ? st.order : idx,
        probability: typeof st.probability === 'number' ? st.probability : 50,
        colorCode: st.colorCode || '#6366f1',
        slaHours: typeof st.slaHours === 'number' ? st.slaHours : 24,
      }));
    }

    const pipeline = await Pipeline.create({
      workspaceId,
      name: name.trim(),
      description: description ? description.trim() : '',
      stages: cleanStages,
      isDefault: !!isDefault,
      isActive: true,
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: 'Pipeline created successfully',
      data: pipeline,
    });
  } catch (error) {
    console.error('createPipeline error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create pipeline' });
  }
};

/**
 * Update pipeline
 */
exports.updatePipeline = async (req, res) => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspaceId;
    const { name, description, stages, isDefault } = req.body;

    const pipeline = await Pipeline.findOne({ _id: id, workspaceId, isActive: true });
    if (!pipeline) {
      return res.status(404).json({ success: false, message: 'Pipeline not found' });
    }

    if (name) pipeline.name = name.trim();
    if (description !== undefined) pipeline.description = description.trim();

    if (isDefault && !pipeline.isDefault) {
      await Pipeline.updateMany({ workspaceId }, { $set: { isDefault: false } });
      pipeline.isDefault = true;
    }

    if (stages && Array.isArray(stages)) {
      pipeline.stages = stages.map((st, idx) => ({
        stageId: st.stageId || `stage_${Date.now()}_${idx}`,
        name: st.name || `Stage ${idx + 1}`,
        category: ['open', 'won', 'lost'].includes(st.category) ? st.category : 'open',
        order: typeof st.order === 'number' ? st.order : idx,
        probability: typeof st.probability === 'number' ? st.probability : 50,
        colorCode: st.colorCode || '#6366f1',
        slaHours: typeof st.slaHours === 'number' ? st.slaHours : 24,
      }));
    }

    await pipeline.save();

    res.json({
      success: true,
      message: 'Pipeline updated successfully',
      data: pipeline,
    });
  } catch (error) {
    console.error('updatePipeline error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update pipeline' });
  }
};

/**
 * Delete / Archive pipeline
 * Requires reassignment if leads exist
 */
exports.deletePipeline = async (req, res) => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspaceId;
    const { reassignPipelineId } = req.body;

    const pipeline = await Pipeline.findOne({ _id: id, workspaceId, isActive: true });
    if (!pipeline) {
      return res.status(404).json({ success: false, message: 'Pipeline not found' });
    }

    // Check count of active pipelines
    const activeCount = await Pipeline.countDocuments({ workspaceId, isActive: true });
    if (activeCount <= 1) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete the only pipeline in the workspace',
      });
    }

    // Check if leads exist
    const leadCount = await Lead.countDocuments({ workspaceId, pipelineId: pipeline._id });
    if (leadCount > 0) {
      if (!reassignPipelineId) {
        return res.status(400).json({
          success: false,
          code: 'REASSIGNMENT_REQUIRED',
          message: `Cannot delete pipeline: ${leadCount} leads are currently using it. Please provide 'reassignPipelineId' to migrate them.`,
          leadCount,
        });
      }

      const targetPipeline = await Pipeline.findOne({ _id: reassignPipelineId, workspaceId, isActive: true });
      if (!targetPipeline) {
        return res.status(400).json({ success: false, message: 'Target pipeline for reassignment does not exist' });
      }

      // Reassign leads to the first stage of the target pipeline
      const defaultStageId = targetPipeline.stages[0]?.stageId || 'new_lead';
      await Lead.updateMany(
        { workspaceId, pipelineId: pipeline._id },
        {
          $set: {
            pipelineId: targetPipeline._id,
            pipelineStage: defaultStageId,
            pipeline_stage: defaultStageId,
            status: defaultStageId,
          }
        }
      );
    }

    pipeline.isActive = false;
    // If it was default, designate another active pipeline as default
    if (pipeline.isDefault) {
      pipeline.isDefault = false;
      const nextDefault = await Pipeline.findOne({ workspaceId, isActive: true, _id: { $ne: pipeline._id } });
      if (nextDefault) {
        nextDefault.isDefault = true;
        await nextDefault.save();
      }
    }
    await pipeline.save();

    res.json({
      success: true,
      message: 'Pipeline archived successfully',
    });
  } catch (error) {
    console.error('deletePipeline error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to delete pipeline' });
  }
};

/**
 * Reassign leads from one stage to another
 */
exports.remapStageLeads = async (req, res) => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspaceId;
    const { fromStageId, toStageId } = req.body;

    if (!fromStageId || !toStageId) {
      return res.status(400).json({ success: false, message: 'fromStageId and toStageId are required' });
    }

    const pipeline = await Pipeline.findOne({ _id: id, workspaceId, isActive: true });
    if (!pipeline) {
      return res.status(404).json({ success: false, message: 'Pipeline not found' });
    }

    const targetStage = pipeline.stages.find(s => s.stageId === toStageId);
    if (!targetStage) {
      return res.status(400).json({ success: false, message: `Target stage '${toStageId}' does not exist in pipeline` });
    }

    const result = await Lead.updateMany(
      {
        workspaceId,
        pipelineId: pipeline._id,
        $or: [
          { pipelineStage: fromStageId },
          { pipeline_stage: fromStageId },
          { status: fromStageId },
        ],
      },
      {
        $set: {
          pipelineStage: toStageId,
          pipeline_stage: toStageId,
          status: toStageId,
        },
      }
    );

    res.json({
      success: true,
      message: `Successfully remapped ${result.modifiedCount} leads from ${fromStageId} to ${toStageId}`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error('remapStageLeads error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to remap stage leads' });
  }
};
