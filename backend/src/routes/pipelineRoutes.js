const express = require('express');
const router = express.Router();
const pipelineController = require('../controllers/pipelineController');
const { protect } = require('../middleware/auth');
const { resolveWorkspace, requirePermission } = require('../middleware/permission');

router.use(protect);
router.use(resolveWorkspace);

// List all pipelines
router.get('/', requirePermission('pipelines.view'), pipelineController.getPipelines);

// Get single pipeline
router.get('/:id', requirePermission('pipelines.view'), pipelineController.getPipelineById);

// Create pipeline
router.post('/', requirePermission('pipelines.manage'), pipelineController.createPipeline);

// Update pipeline
router.put('/:id', requirePermission('pipelines.manage'), pipelineController.updatePipeline);

// Delete pipeline (with safe lead reassignment)
router.delete('/:id', requirePermission('pipelines.manage'), pipelineController.deletePipeline);

// Remap leads between stages
router.post('/:id/remap-stage', requirePermission('pipelines.manage'), pipelineController.remapStageLeads);

module.exports = router;
